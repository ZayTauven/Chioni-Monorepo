"""Back-office subscription routes — mounted under `/api/v1/platform/`.

FOURTH module on that prefix (S5, after centers/KYC, PSP reconciliation
and RGPD): Django resolves several includes on one prefix without
conflict, and the structural guard-rail
(``tests/test_permissions_platform.py``) covers this module automatically
— every route below MUST declare ``IsPlatformStaff``.
"""

from django.urls import path

from apps.billing.platform_views import (
    PlatformPlanDetailView,
    PlatformPlanListCreateView,
    PlatformSubscriptionDetailView,
    PlatformSubscriptionInvoiceCancelView,
    PlatformSubscriptionInvoiceDetailView,
    PlatformSubscriptionInvoiceListCreateView,
    PlatformSubscriptionInvoiceListView,
    PlatformSubscriptionInvoicePaymentView,
    PlatformSubscriptionListCreateView,
    PlatformSubscriptionPaymentReverseView,
    PlatformSubscriptionPlanChangeView,
    PlatformSubscriptionStatusView,
)

app_name = "platform-billing"

urlpatterns = [
    path("plans/", PlatformPlanListCreateView.as_view(), name="plan-list"),
    path("plans/<int:pk>/", PlatformPlanDetailView.as_view(), name="plan-detail"),
    path(
        "subscriptions/",
        PlatformSubscriptionListCreateView.as_view(),
        name="subscription-list",
    ),
    path(
        "subscriptions/<int:pk>/",
        PlatformSubscriptionDetailView.as_view(),
        name="subscription-detail",
    ),
    path(
        "subscriptions/<int:pk>/plan/",
        PlatformSubscriptionPlanChangeView.as_view(),
        name="subscription-plan",
    ),
    path(
        "subscriptions/<int:pk>/status/",
        PlatformSubscriptionStatusView.as_view(),
        name="subscription-status",
    ),
    # --- Facturation SaaS (S5 lot 2). Deux familles : celles d'UN contrat
    # (émission manuelle) et le registre transverse des factures.
    path(
        "subscriptions/<int:pk>/invoices/",
        PlatformSubscriptionInvoiceListCreateView.as_view(),
        name="subscription-invoice-list",
    ),
    path(
        "subscription-invoices/",
        PlatformSubscriptionInvoiceListView.as_view(),
        name="subscription-invoices",
    ),
    path(
        "subscription-invoices/<int:pk>/",
        PlatformSubscriptionInvoiceDetailView.as_view(),
        name="subscription-invoice-detail",
    ),
    path(
        "subscription-invoices/<int:pk>/payments/",
        PlatformSubscriptionInvoicePaymentView.as_view(),
        name="subscription-invoice-payments",
    ),
    path(
        "subscription-invoices/<int:invoice_pk>/payments/<int:pk>/reverse/",
        PlatformSubscriptionPaymentReverseView.as_view(),
        name="subscription-payment-reverse",
    ),
    path(
        "subscription-invoices/<int:pk>/cancel/",
        PlatformSubscriptionInvoiceCancelView.as_view(),
        name="subscription-invoice-cancel",
    ),
]
