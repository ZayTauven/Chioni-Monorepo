"""Routes des relances — montées à la RACINE de `/api/v1/` (patron S6→S9).

**Une seule famille d'URL : celle du TENANT** (`centers/<center_pk>/crm/…`).
Une file de travail appartient au centre qui la traite ; aucune lecture
transversale n'a de sens ici.

**Aucune route `patients/me/`, `guardian/`, `platform/` ni `pharmacy/`, et
il n'y en aura pas.** Un patient ne consulte pas la file de relance qui le
concerne, un tuteur encore moins (il reçoit son SMS, c'est tout), et un
exploitant Chioni n'a jamais accès à un patient (invariant S4). L'interdit
est explicite plutôt qu'accidentel : la sonde structurelle de
``tests/test_adversarial_s3.py``, étendue par S10 (marqueurs ``crm``,
``contacts``, ``unpaid-followups``, ``missed-appointments``), parcourt ces
urlpatterns et vérifie de front que ce module n'expose rien hors
``centers/``.
"""

from django.urls import path

from apps.crm.views import (
    CenterContactLogCreateView,
    CenterMissedAppointmentListView,
    CenterUnpaidFollowupListView,
)

app_name = "crm"

urlpatterns = [
    # La file « à relancer » — rôles BILLING (vue d'argent).
    path(
        "centers/<int:center_pk>/crm/unpaid-followups/",
        CenterUnpaidFollowupListView.as_view(),
        name="center-unpaid-followups",
    ),
    # La file « à recontacter » — tout staff actif (exploitation).
    path(
        "centers/<int:center_pk>/crm/missed-appointments/",
        CenterMissedAppointmentListView.as_view(),
        name="center-missed-appointments",
    ),
    # « J'ai appelé » — le geste humain, journalisé sans un mot de texte.
    path(
        "centers/<int:center_pk>/crm/contacts/",
        CenterContactLogCreateView.as_view(),
        name="center-contacts",
    ),
]
