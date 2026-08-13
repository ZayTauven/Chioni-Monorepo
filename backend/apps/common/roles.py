"""Role groups shared across apps — SINGLE SOURCE (S1, audit C.5.2).

``BILLING_ROLES`` used to be defined three times (trustbridge, patients,
frontend) with a comment promising they stayed in sync; ``CLINICAL_ROLES``
was about to gain a second definition with the practitioner directory.
Groups needed by MORE THAN ONE app live here and ONLY here — an app-local
group (prescribers, care-confirmers, dispute resolvers) stays in its app
as long as it has a single consumer.

``apps.common`` sits below every business app in the dependency graph
(it already imports ``apps.centers.models`` for the permission toolkit),
so importing from here never creates a cycle and never couples two
business apps to each other (the old ``stats_views`` →
``trustbridge.views`` import is gone).
"""

from apps.centers.models import StaffMembership

Role = StaffMembership.Role

#: Roles allowed to bill and manage money on behalf of the center
#: (factures, caisse, demandes de paiement, litiges en lecture, fusion de
#: dossiers au guichet — ADR 0008/0015).
BILLING_ROLES = (Role.DIRECTOR, Role.SECRETARY, Role.CASHIER)

#: Roles allowed to produce AND read clinical content (R-API-1) — also the
#: perimeter of the practitioner directory (S1: annuaire praticiens).
CLINICAL_ROLES = (Role.DOCTOR, Role.NURSE, Role.MIDWIFE)
