"""``simulate_psp_payment`` — play the provider's part, in dev only.

After ``POST /guardian/payment-requests/{pk}/pay/`` the FakePSP never
calls back on its own: the intent stays ``en_cours`` forever and the
end-to-end flow cannot be demonstrated from the frontend. This command
builds the signed webhook the provider would send (via
``FakePsp.build_webhook`` — the signature is never re-implemented here)
and POSTs it on the REAL HTTP path ``/api/v1/trustbridge/webhooks/psp/``
through ``django.test.Client``: in-process, same database, exercising
the actual webhook view — never a shortcut to the service layer.

Dev-only by design (same posture as the PSP/SMS boot guards in
``config/settings.py``): refuses to run when ``DEBUG`` is False or when
the active PSP backend is not ``fake``.

Usage::

    python manage.py simulate_psp_payment fake_pi_<idempotency_key>
    python manage.py simulate_psp_payment --latest
    python manage.py simulate_psp_payment --latest --fail
"""

import json

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.test import Client

from apps.trustbridge.models import PaymentIntent
from apps.trustbridge.psp.fake import FakePsp

WEBHOOK_PATH = "/api/v1/trustbridge/webhooks/psp/"

#: Statuses a provider callback can still act on.
NON_TERMINAL_STATUSES = (
    PaymentIntent.Status.CREATED,
    PaymentIntent.Status.PROCESSING,
)


class Command(BaseCommand):
    help = (
        "Simule le retour du PSP (FakePSP) en POSTant un webhook signé sur "
        f"{WEBHOOK_PATH} — outil de développement uniquement (DEBUG=True, "
        "PSP_BACKEND=fake)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "reference",
            nargs="?",
            default=None,
            help="Référence PSP (psp_reference) d'une intention de paiement.",
        )
        parser.add_argument(
            "--latest",
            action="store_true",
            help=(
                "Prend la dernière intention non terminale (cree/en_cours) "
                "au lieu d'une référence explicite."
            ),
        )
        parser.add_argument(
            "--fail",
            action="store_true",
            help="Envoie « failed » au lieu de « succeeded ».",
        )

    def handle(self, *args, **options):
        # Same philosophy as the boot guards (R-API-3): a deployed instance
        # must never be able to fabricate provider confirmations.
        if not settings.DEBUG:
            raise CommandError(
                "simulate_psp_payment est un outil de développement : "
                "interdit hors DEBUG (même posture que les gardes-fous "
                "boot PSP/SMS)."
            )
        if settings.PSP_BACKEND != "fake":
            raise CommandError(
                f"Backend PSP actif « {settings.PSP_BACKEND} » : cette "
                "commande ne sait simuler que le backend « fake »."
            )
        intent = self._resolve_intent(options["reference"], options["latest"])
        webhook_status = "failed" if options["fail"] else "succeeded"
        payload, signature = FakePsp.build_webhook(
            reference=intent.psp_reference, status=webhook_status
        )

        # The REAL HTTP path, in-process on the same database: the actual
        # webhook view runs (signature check included).
        client = Client(SERVER_NAME="localhost")
        response = client.generic(
            "POST",
            WEBHOOK_PATH,
            data=payload,
            content_type="application/json",
            HTTP_X_PSP_SIGNATURE=signature,
        )

        raw = response.content.decode(errors="replace")
        try:
            body = json.dumps(json.loads(raw), ensure_ascii=False)
        except ValueError:
            body = raw
        style = (
            self.style.SUCCESS if response.status_code == 200 else self.style.ERROR
        )
        self.stdout.write(f"Référence : {intent.psp_reference}")
        self.stdout.write(f"Webhook   : {webhook_status}")
        self.stdout.write(style(f"HTTP {response.status_code} — {body}"))

    def _resolve_intent(self, reference, latest):
        if reference and latest:
            raise CommandError("Donnez une référence OU --latest, pas les deux.")
        if reference:
            intent = PaymentIntent.objects.filter(psp_reference=reference).first()
            if intent is None:
                raise CommandError(
                    f"Aucune intention de paiement avec la référence "
                    f"« {reference} »."
                )
            return intent
        if latest:
            intent = (
                PaymentIntent.objects.filter(status__in=NON_TERMINAL_STATUSES)
                .exclude(psp_reference="")
                .order_by("-created_at", "-pk")
                .first()
            )
            if intent is None:
                raise CommandError(
                    "Aucune intention de paiement non terminale (cree/en_cours). "
                    "Lancez d'abord un paiement via "
                    "POST /api/v1/guardian/payment-requests/{pk}/pay/."
                )
            return intent
        raise CommandError(
            "Indiquez la référence PSP d'une intention, ou --latest pour "
            "prendre la dernière intention non terminale."
        )
