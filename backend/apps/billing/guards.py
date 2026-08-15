"""The administrative freeze — S5, ADR 0018 décision 2.

ONE guard, `require_center_can_administer`, and it is **distinct from
`_require_center_can_collect`** (the KYC guard of the diaspora rail) on
purpose. That one is wired at exactly four points of the Trust Bridge and
nowhere else; reusing it here would cut the Trust Bridge of a solvent
center — and this one must never be wired into the diaspora rail, because
**the rail stays OPEN on an unpaid center** (décision 2: closing it would
punish the guardian and the patient, not the center).

Same proven patron though, including the lesson of the S4 adversarial
review:

- **the status is re-read from the DATABASE**, never from the caller's
  in-memory object — a service composed with a ``HealthCenter`` loaded
  before a suspension would otherwise carry a stale « actif » straight
  through the guard;
- an explicit FRENCH message that says what is frozen, what to do about
  it, and — just as importantly — **what keeps working**: a refusal that
  let a secretary believe the whole product is down would send a center
  back to paper, which is precisely what Chioni exists to avoid;
- **never on the tail of an operation already engaged**: the guard sits at
  the START of an administrative write, never between a debit and its
  receipt.

Where it is called (the closed list, ADR 0018 décision 2):

- ``apps.centers.services``: ``add_staff_member``, ``update_staff_member``,
  ``reactivate_staff_member``, ``create_tariff``, ``update_tariff``;
- ``apps.centers.stats_views``: activity and finance statistics.

Where it is deliberately NOT called (each one a tested contract):

- everything clinical (``apps.medical``), appointments
  (``apps.scheduling``), the desk registration of a patient
  (``apps.patients``), patient invoicing, the cash desk and receipts
  (``apps.trustbridge``) — the freeze is commercial, care is not;
- ``deactivate_staff_member`` — revoking somebody's access is a SECURITY
  act, never a paid feature, and the RGPD anonymisation depends on it
  (see the ADR 0018 lot 1 addendum);
- every read, the RGPD export, the director's audit journal;
- the PLATFORM's own doors (``add_center_director``): Chioni must always
  be able to seed a director back into a tenant it has frozen.
"""

from django.core.exceptions import ValidationError

from apps.billing.models import CenterSubscription

#: What continues, appended to every refusal below. The sentence is the
#: whole ethic of the sprint in one line — and it is TRUE (tested).
_WHAT_KEEPS_WORKING = (
    "Les soins, les rendez-vous, l'inscription des patients, la "
    "facturation et la caisse continuent normalement."
)

SUBSCRIPTION_SUSPENDED_MESSAGE = (
    "L'abonnement Chioni de ce centre est suspendu : la gestion "
    "administrative (personnel, tarifs, statistiques) est gelée jusqu'à "
    "la régularisation. Contactez Chioni pour régulariser — le motif est "
    "visible par le directeur du centre. " + _WHAT_KEEPS_WORKING
)

SUBSCRIPTION_TERMINATED_MESSAGE = (
    "L'abonnement Chioni de ce centre est résilié : la gestion "
    "administrative (personnel, tarifs, statistiques) est fermée. Vos "
    "données restent lisibles et exportables ; contactez Chioni pour "
    "reprendre un abonnement. " + _WHAT_KEEPS_WORKING
)

#: Status → refusal. Two frozen states, two different stories (patron
#: ``KYC_PENDING_MESSAGE`` / ``KYC_SUSPENDED_MESSAGE``): « régularisez »
#: and « le contrat est terminé » are not the same news.
_FROZEN_MESSAGES = {
    CenterSubscription.Status.SUSPENDED: SUBSCRIPTION_SUSPENDED_MESSAGE,
    CenterSubscription.Status.TERMINATED: SUBSCRIPTION_TERMINATED_MESSAGE,
}


def center_subscription_status(center):
    """The center's subscription status **as the database has it**, or None.

    ``None`` means « this center has no subscription row » — which is a
    real, frequent situation (every center born before S5) and freezes
    NOTHING. A tenant with no contract in the table is not a tenant in
    default: the commercial sanction is a decision an operator takes, it
    is never the default state of the product.
    """
    return (
        CenterSubscription.objects.filter(center_id=center.pk)
        .values_list("status", flat=True)
        .first()
    )


def require_center_can_administer(center):
    """Refuse an ADMINISTRATIVE write on a frozen center (400, in French).

    Frozen = ``suspendu`` or ``resilie``. ``essai``, ``actif`` and —
    critically — ``impaye`` close nothing at all: the grace period is a
    banner and reminders, not a lockout.
    """
    message = _FROZEN_MESSAGES.get(center_subscription_status(center))
    if message is not None:
        raise ValidationError(message)
