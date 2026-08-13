"""Central permission toolkit — audiences (« casquettes ») are defined HERE.

Chioni serves three audiences and a user may hold several hats at once
(doctor in a center AND guardian of a relative — ADR 0001). Cross-hat
privilege bleed is prevented by construction: every view declares exactly
ONE audience through these classes/helpers, and derives its queryset from
that audience only — never from "any right the user happens to hold".

The three audiences:

- **Staff of a center** — ``IsStaffOfCenter(*roles)`` + ``CenterScopedViewMixin``.
  Operating data is tenant-scoped (ADR 0002): the mixin resolves the center
  from the URL among the centers where the user has an ACTIVE membership,
  raising 404 otherwise. Querysets then go through ``for_center()``.

- **The patient themself** — ``IsPatientSelf``. Only a CLAIMED profile
  (``user`` set, claim_status active) opens the personal space; querysets
  go through ``for_patient(claimed_patient_profile(user))``.

- **A guardian** — ``IsGuardianWithScope(scope)`` + the queryset helpers
  ``guardian_links_with_scope`` / ``patients_visible_to_guardian``.
  F3 trap, closed here: ``Consent.objects.active_scopes(link)`` says what
  KIND of data a link opens, never WHICH rows. The helpers below are the
  single place where the two halves are combined (scope × link perimeter);
  guardian views must build their querysets from them and nothing else.

IDOR policy (mission rule "jamais de 404-par-hasard"): scoping happens in
the QUERYSET, so an object outside the caller's perimeter is structurally
indistinguishable from a non-existent one — deterministic 404, for both
cross-center and cross-patient probes.
"""

from django.utils.functional import cached_property
from rest_framework.exceptions import NotFound
from rest_framework.permissions import BasePermission

from apps.centers.models import HealthCenter, StaffMembership
from apps.medical.models import Consent
from apps.patients.models import GuardianLink, GuardianProfile, PatientProfile

# ---------------------------------------------------------------------------
# Shared low-level helpers
# ---------------------------------------------------------------------------


def active_membership_qs(user, center=None, roles=None):
    """Active staff memberships of ``user`` (optionally per center / roles)."""
    qs = StaffMembership.objects.filter(user=user, is_active=True)
    if center is not None:
        qs = qs.for_center(center)
    if roles:
        qs = qs.filter(role__in=roles)
    return qs


def user_centers_qs(user):
    """Centers where ``user`` holds at least one ACTIVE membership.

    THE queryset for `/centers/` style views: a center outside it does not
    exist for this user (404), whatever their other hats.
    """
    return HealthCenter.objects.filter(
        staff_memberships__user=user, staff_memberships__is_active=True
    ).distinct()


def claimed_patient_profile(user):
    """The user's CLAIMED patient profile, or None.

    An unclaimed/invited profile never opens the patient space: claiming
    (OTP, dedicated chantier) is what turns identity into rights.
    """
    try:
        profile = user.patient_profile
    except PatientProfile.DoesNotExist:
        return None
    return profile if profile.is_claimed else None


def guardian_profile(user):
    """The user's guardian profile, or None."""
    try:
        return user.guardian_profile
    except GuardianProfile.DoesNotExist:
        return None


# ---------------------------------------------------------------------------
# F3 — the ONE place where consent scopes are combined with link perimeter
# ---------------------------------------------------------------------------


def guardian_links_with_scope(user, scope):
    """Active guardian links of ``user`` whose effective scopes include ``scope``.

    This is the ONLY legal derivation of a guardian's accessible rows:

    - ``Consent.objects.active_scopes(link)`` — the single source of truth
      (ADR 0004) for what KIND of data the link opens;
    - the link's ``patient`` — WHICH rows belong to the shared perimeter.

    A guardian view that queries anything else than through this helper (or
    :func:`patients_visible_to_guardian`) is a review-blocking defect.
    """
    profile = guardian_profile(user)
    if profile is None:
        return GuardianLink.objects.none()
    links = GuardianLink.objects.filter(
        guardian=profile, status=GuardianLink.Status.ACTIVE
    ).select_related("patient")
    allowed_pks = [
        link.pk
        for link in links
        if scope in Consent.objects.active_scopes(link)
    ]
    return GuardianLink.objects.filter(pk__in=allowed_pks)


def patients_visible_to_guardian(user, scope):
    """Patient profiles inside the guardian's perimeter for ``scope``."""
    return PatientProfile.objects.filter(
        guardian_links__in=guardian_links_with_scope(user, scope)
    ).distinct()


def payment_requests_shared_with_guardian(user):
    """Payment requests a guardian may see — F3 applied to money (phase B).

    BOTH halves, combined here and nowhere else:

    - :func:`guardian_links_with_scope` with the ``paiements`` scope — the
      link is active and the consent layer opens payment data;
    - ``PaymentRequestShare`` — the request was EXPLICITLY shared with one
      of those links (an active link alone shows nothing).

    A revoked link or a withdrawn share removes the row instantly (404).
    """
    from apps.trustbridge.models import PaymentRequest

    links = guardian_links_with_scope(user, Consent.Scope.PAYMENTS)
    return PaymentRequest.objects.filter(
        shares__guardian_link__in=links
    ).distinct()


def receipts_visible_to_guardian(user):
    """Receipts inside the guardian's payment perimeter (ADR 0004: the
    ``paiements`` scope covers receipts). Same double derivation as
    :func:`payment_requests_shared_with_guardian`."""
    from apps.trustbridge.models import Receipt

    return Receipt.objects.filter(
        payment_request__in=payment_requests_shared_with_guardian(user)
    ).distinct()


# ---------------------------------------------------------------------------
# Audience: staff of a center
# ---------------------------------------------------------------------------


class CenterScopedViewMixin:
    """Resolves ``self.center`` from the URL, scoped to the user's centers.

    A center where the caller holds NO active membership is invisible:
    resolution raises 404 (NotFound), which is exactly the cross-tenant
    IDOR answer we want. Role requirements are layered on top by
    ``IsStaffOfCenter(*roles)`` and answer 403 (member, wrong hat).
    """

    center_url_kwarg = "center_pk"

    @cached_property
    def center(self):
        center = (
            user_centers_qs(self.request.user)
            .filter(pk=self.kwargs[self.center_url_kwarg])
            .first()
        )
        if center is None:
            raise NotFound("Centre introuvable.")
        return center


def IsStaffOfCenter(*roles):
    """Factory: permission class requiring an ACTIVE membership in the
    center resolved by :class:`CenterScopedViewMixin` (``view.center``).

    - anonymous                     → 401 (denied before touching the URL)
    - no membership in this center  → 404 (raised by the mixin: invisible)
    - member but none of ``roles``  → 403

    Called without arguments, any active role of the center is accepted.
    """

    class _IsStaffOfCenter(BasePermission):
        message = "Vous n'avez pas le rôle requis dans ce centre."
        required_roles = tuple(roles)

        def has_permission(self, request, view):
            if not (request.user and request.user.is_authenticated):
                return False  # 401 — never leak center existence to anonymous
            return active_membership_qs(
                request.user, center=view.center, roles=self.required_roles
            ).exists()

    return _IsStaffOfCenter


def StaffOfObjectCenter(*roles):
    """Factory: object-level variant for views whose object IS a center or
    CARRIES a ``center`` FK (used by `/centers/{id}/` update — director only).
    """

    class _StaffOfObjectCenter(BasePermission):
        message = "Vous n'avez pas le rôle requis dans ce centre."
        required_roles = tuple(roles)

        def has_permission(self, request, view):
            return bool(request.user and request.user.is_authenticated)

        def has_object_permission(self, request, view, obj):
            center = obj if isinstance(obj, HealthCenter) else obj.center
            return active_membership_qs(
                request.user, center=center, roles=self.required_roles
            ).exists()

    return _StaffOfObjectCenter


# ---------------------------------------------------------------------------
# Audience: the patient themself
# ---------------------------------------------------------------------------


class IsPatientSelf(BasePermission):
    """The caller owns a CLAIMED patient profile — their carnet, nothing else.

    Views under `/patients/me/` resolve the profile via
    :func:`claimed_patient_profile` and scope every queryset with it; the
    permission only opens the door to the personal space.
    """

    message = "Réservé au patient titulaire d'un profil revendiqué."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and claimed_patient_profile(request.user) is not None
        )


# ---------------------------------------------------------------------------
# Audience: a guardian
# ---------------------------------------------------------------------------
#
# TWO permission levels since S1 (audit C.5.1 — the scope passed to
# ``IsGuardianWithScope`` was never tested: the whole guardian perimeter
# rested on queryset discipline alone):
#
# - ``IsGuardian`` — the guardian-SPACE door: profile, invitations,
#   protégé creation, link lifecycle (accept/decline/revoke). These
#   endpoints act on the links THEMSELVES; a link awaiting acceptance is
#   not ACTIVE and thus carries no scope by definition — requiring one
#   would lock a brand-new guardian out of their own first invitation.
# - ``IsGuardianWithScope(scope)`` — the scoped-DATA door (payment
#   requests, receipts, future clinical reads): the caller must hold at
#   least one ACTIVE link whose effective scopes include ``scope``.
#   A guardian with no such link answers 403 BEFORE any queryset runs:
#   a view that forgot its scope filter no longer leaks to guardians who
#   were never granted that scope (the queryset helpers remain the second,
#   row-level layer — F3: the permission gates the KIND, the helpers gate
#   the ROWS).
#
# Testable guard-rail: both classes expose ``guardian_gate``/``required_scope``
# markers so the structural test (tests/test_permissions_guardian_scope.py)
# can walk every ``/guardian/…`` route and refuse a view that declares no
# guardian permission — a future guardian endpoint cannot ship unguarded.


class IsGuardian(BasePermission):
    """The caller owns a guardian profile — opens the guardian SPACE only.

    Views using this permission act on the guardian's own links/profile;
    any view serving scoped data must use :func:`IsGuardianWithScope`.
    """

    message = "Réservé aux tuteurs."
    guardian_gate = True
    required_scope = None

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and guardian_profile(request.user) is not None
        )


def IsGuardianWithScope(scope):
    """Factory: guardian profile AND at least one ACTIVE link whose
    effective scopes (``Consent.objects.active_scopes``) include ``scope``.

    The view MUST still build its queryset via
    :func:`guardian_links_with_scope`/:func:`patients_visible_to_guardian`
    (or the trustbridge helpers built on them) with the SAME scope — the
    permission gates what KIND of data the caller may enter at all, the
    helpers gate WHICH rows (F3: never one without the other).

    Denial semantics: no guardian profile → 403 « Réservé aux tuteurs. » ;
    profile but no active link carrying the scope → 403 with an honest
    message about the caller's OWN state (nothing about anyone's data).
    """

    class _IsGuardianWithScope(IsGuardian):
        required_scope = scope

        def has_permission(self, request, view):
            if not super().has_permission(request, view):
                return False
            if guardian_links_with_scope(request.user, self.required_scope).exists():
                return True
            self.message = (
                "Aucun lien de tutelle actif ne vous ouvre cette information."
            )
            return False

    return _IsGuardianWithScope
