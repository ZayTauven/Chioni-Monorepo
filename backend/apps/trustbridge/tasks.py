"""Celery tasks of the trustbridge app — money-flow hygiene.

Beat wiring lives in ``config/settings.py`` (``CELERY_BEAT_SCHEDULE``),
which references tasks BY NAME only — settings never import application
code. ``CELERY_TASK_ALWAYS_EAGER`` follows ``DEBUG``: dev and tests run
inline, deployed environments go through Redis workers.
"""

from celery import shared_task

from apps.trustbridge.services import cancel_stale_intents


@shared_task(name="trustbridge.cancel_stale_intents")
def cancel_stale_intents_task() -> int:
    """Cancel zombie ``PaymentIntent`` rows (ADR 0009 addendum, point 3).

    Delegates to :func:`apps.trustbridge.services.cancel_stale_intents`,
    the ONLY write path (per-intent row lock, ``save()`` transition,
    system-actor audit) — never a raw ``update()``.

    IMPORTANT (exigence actée à l'addendum ADR 0009) : quand
    ``psp/stripe.py`` existera, cette tâche devra AUSSI annuler l'intent
    côté PSP (``payment_intent.cancel``) — l'annulation locale seule
    laisse un client secret Stripe confirmable pendant des heures. Le
    Fake PSP n'a aucun état côté fournisseur, rien à annuler à distance.

    Returns the number of intents cancelled (surfaced in worker logs via
    the task result).
    """
    return cancel_stale_intents()
