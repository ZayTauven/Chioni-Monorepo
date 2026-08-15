"""Subscription routes — TENANT side, mounted at the ROOT of `/api/v1/`.

One family (`centers/<center_pk>/subscription/…`), like the Trust Bridge
module: the app owns the object, the URL says which audience reads it.
Everything here is READ-ONLY and DIRECTOR-ONLY — a center consults its
contract and its SaaS invoices; Chioni is the one who issues, records and
cancels (routes in ``platform_urls``).
"""

from django.urls import path

from apps.billing.views import (
    CenterSubscriptionInvoiceDetailView,
    CenterSubscriptionInvoiceListView,
    CenterSubscriptionView,
)

app_name = "billing"

urlpatterns = [
    path(
        "centers/<int:center_pk>/subscription/",
        CenterSubscriptionView.as_view(),
        name="center-subscription",
    ),
    path(
        "centers/<int:center_pk>/subscription/invoices/",
        CenterSubscriptionInvoiceListView.as_view(),
        name="center-subscription-invoices",
    ),
    path(
        "centers/<int:center_pk>/subscription/invoices/<int:pk>/",
        CenterSubscriptionInvoiceDetailView.as_view(),
        name="center-subscription-invoice-detail",
    ),
]
