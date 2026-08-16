"""Equipment routes — mounted at the ROOT of `/api/v1/` (patron S6/S7).

**Une seule famille d'URL : celle du TENANT** (`centers/<center_pk>/
equipment/…`). Le parc appartient à un centre, comme les chambres et les
tarifs ; aucune lecture transversale n'a de sens (un tensiomètre n'est pas
un objet de carnet, ni d'abonnement).

**Aucune route `guardian/`, aucune route `patients/me/`, aucune route
`platform/`, et il n'y en aura pas** : un tuteur, un patient et un
exploitant Chioni n'ont rien à voir avec le matériel d'un établissement.
L'interdit est explicite plutôt qu'accidentel — la sonde structurelle de
``tests/test_adversarial_s3.py``, étendue par S8, parcourt ces urlpatterns
et refuse toute route `guardian/` portant un marqueur d'équipement, puis
vérifie de front que ce module n'expose AUCUNE route tuteur, patient ou
plateforme, quel que soit son nom.
"""

from django.urls import path

from apps.equipment.views import (
    CenterEquipmentDetailView,
    CenterEquipmentListCreateView,
    CenterEquipmentReportListCreateView,
    CenterEquipmentStatusView,
)

app_name = "equipment"

urlpatterns = [
    # Le parc : lecture tout staff actif, écriture DIRECTEUR.
    path(
        "centers/<int:center_pk>/equipment/",
        CenterEquipmentListCreateView.as_view(),
        name="center-equipments",
    ),
    path(
        "centers/<int:center_pk>/equipment/<int:pk>/",
        CenterEquipmentDetailView.as_view(),
        name="center-equipment-detail",
    ),
    # L'état officiel : le geste du DIRECTEUR (machine à états).
    path(
        "centers/<int:center_pk>/equipment/<int:pk>/status/",
        CenterEquipmentStatusView.as_view(),
        name="center-equipment-status",
    ),
    # Le constat : TOUT membre actif — et rien ne le ferme.
    path(
        "centers/<int:center_pk>/equipment/<int:pk>/reports/",
        CenterEquipmentReportListCreateView.as_view(),
        name="center-equipment-reports",
    ),
]
