"""``create_platform_staff`` — the offline bootstrap of the back-office.

S5 lot 3, ADR 0018 décision 6. Until this sprint the very first Chioni
operator could only be born in the Django admin, which is why
``PlatformStaffAdmin`` stayed writable (« c'est le prix du bootstrap »,
ADR 0017 lot 1 §13, consigned again by the S4 adversarial review). The
admin is now read-only, so the bootstrap moves where a bootstrap belongs:
a management command, on the model of ``createsuperuser``.

Three properties, each deliberate:

- **usable IN PRODUCTION** — unlike ``seed_demo`` and
  ``simulate_psp_payment``, there is NO ``DEBUG`` guard: this command IS
  the day-one installation gesture, and it grants no credential (see
  below). Access to it is access to the server;
- **no password, ever** — the account is created as a SHADOW
  (``get_or_create_shadow_user``) and its holder takes possession of it by
  OTP SMS, exactly like every other human of the platform (ADR 0010).
  Nothing secret transits through a terminal, a chat or an e-mail;
- **explicit about duplicates** — an account already holding an operator
  row is refused by name of the situation, with the route to use instead;
  it never silently « re-creates » or upgrades a role.

The phone is normalised to E.164 (région KM) by the shared helper, so
« 3312345 », « 2693312345 » and « +2693312345 » converge on ONE account —
and an invalid number stops the command with a French message rather than
creating an operator nobody can log in as.

Usage::

    python manage.py create_platform_staff --phone +2693440020 --role admin
    python manage.py create_platform_staff --phone 3312345 --role support \\
        --first-name Zaïnaba --last-name Combo
"""

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import PlatformStaff
from apps.accounts.services import create_platform_staff


class Command(BaseCommand):
    help = (
        "Crée un membre de l'équipe Chioni (4ᵉ casquette). Amorçage hors "
        "ligne du back-office : aucun mot de passe n'est transmis, la "
        "personne prend possession de son compte par OTP."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--phone",
            required=True,
            help="Numéro de téléphone (E.164 ou national comorien).",
        )
        parser.add_argument(
            "--role",
            required=True,
            choices=list(PlatformStaff.Role.values),
            help="« support » lit ; « admin » écrit (et gère l'équipe).",
        )
        parser.add_argument("--first-name", default="", help="Prénom (facultatif).")
        parser.add_argument("--last-name", default="", help="Nom (facultatif).")

    def handle(self, *args, **options):
        try:
            operator = create_platform_staff(
                # Système : l'amorçage n'a pas d'acteur authentifié, et
                # l'entrée d'audit le dit (``actor=None``) plutôt que de
                # prêter le geste à quelqu'un.
                actor=None,
                phone=options["phone"],
                role=options["role"],
                first_name=options["first_name"],
                last_name=options["last_name"],
            )
        except ValidationError as exc:
            # Toutes les refus du service sont en français et actionnables
            # (numéro invalide, compte déjà exploitant, casquette de
            # tenant) : on les rend tels quels.
            raise CommandError(" ".join(exc.messages))

        self.stdout.write(
            self.style.SUCCESS(
                f"Exploitant #{operator.pk} créé — rôle « {operator.role} », "
                f"compte utilisateur #{operator.user_id}."
            )
        )
        self.stdout.write(
            "Aucun mot de passe n'a été créé : la personne se connecte par "
            "OTP SMS sur son numéro, puis ouvre l'espace plateforme."
        )
