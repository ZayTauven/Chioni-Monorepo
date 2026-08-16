"""Routes du réseau côté CENTRE et côté PATIENT — racine de `/api/v1/`.

Deux familles d'URL, et une troisième interdite :

- ``centers/<center_pk>/…`` — l'annuaire, l'envoi d'une recherche depuis une
  ordonnance, le fil des recherches du centre ;
- ``patients/me/prescriptions/<pk>/availability/`` — la lecture du patient,
  dans son carnet ;
- **aucune route ``guardian/``**, et il n'y en aura pas : la disponibilité
  d'un traitement est une information clinique, et le verrou tuteur de S3
  tient tel quel. L'interdit est explicite plutôt qu'accidentel — la sonde
  de routes parcourt ces urlpatterns et refuse toute route tuteur portant un
  marqueur de pharmacie ou de disponibilité.

Les routes de l'espace pharmacie vivent dans ``space_urls.py`` (préfixe
``pharmacy/``) et celles du back-office dans ``platform_urls.py`` : trois
fichiers pour trois audiences, comme dans ``apps/centers``.
"""

from django.urls import path

from apps.pharmacy.views import (
    CenterAvailabilityRequestCloseView,
    CenterAvailabilityRequestDetailView,
    CenterAvailabilityRequestListView,
    CenterPharmacyDirectoryView,
    MyPrescriptionAvailabilityView,
    PrescriptionAvailabilityRequestView,
)

app_name = "pharmacy"

urlpatterns = [
    # L'annuaire des officines validées — tout staff actif du centre.
    path(
        "centers/<int:center_pk>/pharmacies/",
        CenterPharmacyDirectoryView.as_view(),
        name="center-pharmacies",
    ),
    # Le geste du sprint : diffuser les lignes COCHÉES d'une ordonnance.
    path(
        "centers/<int:center_pk>/prescriptions/<int:prescription_pk>/"
        "availability-requests/",
        PrescriptionAvailabilityRequestView.as_view(),
        name="prescription-availability-requests",
    ),
    # Le fil des recherches du centre.
    path(
        "centers/<int:center_pk>/availability-requests/",
        CenterAvailabilityRequestListView.as_view(),
        name="center-availability-requests",
    ),
    path(
        "centers/<int:center_pk>/availability-requests/<int:pk>/",
        CenterAvailabilityRequestDetailView.as_view(),
        name="center-availability-request-detail",
    ),
    path(
        "centers/<int:center_pk>/availability-requests/<int:pk>/close/",
        CenterAvailabilityRequestCloseView.as_view(),
        name="center-availability-request-close",
    ),
    # Le patient consulte — il ne lance pas (arbitrage PO n° 3).
    path(
        "patients/me/prescriptions/<int:prescription_pk>/availability/",
        MyPrescriptionAvailabilityView.as_view(),
        name="my-prescription-availability",
    ),
]
