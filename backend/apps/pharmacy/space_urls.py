"""Routes du 5ᵉ espace — montées sous `/api/v1/pharmacy/` (S9, ADR 0022).

Toute route d'ici DOIT déclarer ``IsPharmacyMember`` : la sonde structurelle
(``tests/test_pharmacy.py``) parcourt cet arbre et échoue sur une vue non
gardée — même garde-fou que les rails ``/guardian/`` et ``/platform/``, et
il vérifie aussi qu'aucune vue n'hérite en silence de l'``IsAuthenticated``
par défaut de DRF (leçon S4).

Le préfixe porte l'identifiant de la pharmacie (``pharmacy/<pharmacy_pk>/``)
comme le rail des centres porte celui du centre : une même personne peut
appartenir à deux officines (rare, mais réel), et l'ambiguïté « laquelle ? »
ne doit jamais être tranchée en silence par le serveur.
"""

from django.urls import path

from apps.pharmacy.space_views import (
    PharmacyDocumentArchiveView,
    PharmacyDocumentDownloadView,
    PharmacyDocumentListCreateView,
    PharmacyInboxDetailView,
    PharmacyInboxView,
    PharmacyMemberDeactivateView,
    PharmacyMemberListCreateView,
    PharmacyProfileView,
    PharmacyRespondView,
)

app_name = "pharmacy-space"

urlpatterns = [
    path("<int:pharmacy_pk>/", PharmacyProfileView.as_view(), name="profile"),
    # La boîte de réception — par les lignes de diffusion, jamais par un
    # filtre de commune recalculé.
    path(
        "<int:pharmacy_pk>/requests/",
        PharmacyInboxView.as_view(),
        name="requests",
    ),
    path(
        "<int:pharmacy_pk>/requests/<int:pk>/",
        PharmacyInboxDetailView.as_view(),
        name="request-detail",
    ),
    path(
        "<int:pharmacy_pk>/requests/<int:pk>/respond/",
        PharmacyRespondView.as_view(),
        name="request-respond",
    ),
    # Les gens de l'officine — sans rôle, sans hiérarchie.
    path(
        "<int:pharmacy_pk>/members/",
        PharmacyMemberListCreateView.as_view(),
        name="members",
    ),
    path(
        "<int:pharmacy_pk>/members/<int:pk>/deactivate/",
        PharmacyMemberDeactivateView.as_view(),
        name="member-deactivate",
    ),
    # Les pièces justificatives — stockage privé, jamais d'URL.
    path(
        "<int:pharmacy_pk>/documents/",
        PharmacyDocumentListCreateView.as_view(),
        name="documents",
    ),
    path(
        "<int:pharmacy_pk>/documents/<int:pk>/download/",
        PharmacyDocumentDownloadView.as_view(),
        name="document-download",
    ),
    path(
        "<int:pharmacy_pk>/documents/<int:pk>/archive/",
        PharmacyDocumentArchiveView.as_view(),
        name="document-archive",
    ),
]
