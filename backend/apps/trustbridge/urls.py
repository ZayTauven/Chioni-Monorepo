"""Trust Bridge routes — mounted at the ROOT of `/api/v1/`.

Four URL families:
- `centers/<center_pk>/…`          — staff of the invoicing center
- `patients/me/…`                  — the patient
- `guardian/…`                     — a guardian (diaspora)
- `trustbridge/webhooks/…`         — the PSP (signature-authenticated)
"""

from django.urls import path

from apps.trustbridge.views import (
    CenterCashJournalView,
    CenterCashPaymentReverseView,
    CenterDisputeListView,
    CenterDisputeResolveView,
    CenterInvoiceDetailView,
    CenterInvoiceIssueView,
    CenterInvoiceListCreateView,
    CenterUnpaidInvoiceListView,
    CenterInvoicePaymentListCreateView,
    CenterInvoicePaymentRequestCreateView,
    CenterPaymentRequestCloseView,
    CenterPaymentRequestConfirmCareView,
    CenterPaymentRequestDetailView,
    CenterPaymentRequestListView,
    CenterPaymentRequestSendView,
    CenterPaymentRequestShareView,
    CenterPaymentRequestUnshareView,
    GuardianPaymentRequestDetailView,
    GuardianPaymentRequestDisputeView,
    GuardianPaymentRequestListView,
    GuardianPaymentRequestPayView,
    GuardianPaymentRequestQuoteView,
    GuardianReceiptListView,
    MyCashReceiptListView,
    MyPaymentRequestAcknowledgeView,
    MyPaymentRequestDetailView,
    MyPaymentRequestDisputeView,
    MyPaymentRequestListView,
    MyPaymentRequestShareView,
    MyReceiptListView,
    PspWebhookView,
)

app_name = "trustbridge"

urlpatterns = [
    # Audience: staff of the invoicing center
    path(
        "centers/<int:center_pk>/invoices/",
        CenterInvoiceListCreateView.as_view(),
        name="center-invoice-list",
    ),
    # « unpaid » n'est pas un <int:pk> : les deux familles coexistent sans
    # ambiguïté, mais on la déclare avant le détail pour la lisibilité.
    path(
        "centers/<int:center_pk>/invoices/unpaid/",
        CenterUnpaidInvoiceListView.as_view(),
        name="center-invoice-unpaid",
    ),
    path(
        "centers/<int:center_pk>/invoices/<int:pk>/",
        CenterInvoiceDetailView.as_view(),
        name="center-invoice-detail",
    ),
    path(
        "centers/<int:center_pk>/invoices/<int:pk>/issue/",
        CenterInvoiceIssueView.as_view(),
        name="center-invoice-issue",
    ),
    path(
        "centers/<int:center_pk>/invoices/<int:pk>/payment-requests/",
        CenterInvoicePaymentRequestCreateView.as_view(),
        name="center-invoice-payment-request",
    ),
    # Caisse du centre (ADR 0015)
    path(
        "centers/<int:center_pk>/invoices/<int:pk>/payments/",
        CenterInvoicePaymentListCreateView.as_view(),
        name="center-invoice-payments",
    ),
    path(
        "centers/<int:center_pk>/invoices/<int:invoice_pk>/payments/<int:pk>/reverse/",
        CenterCashPaymentReverseView.as_view(),
        name="center-cash-payment-reverse",
    ),
    path(
        "centers/<int:center_pk>/cash-journal/",
        CenterCashJournalView.as_view(),
        name="center-cash-journal",
    ),
    path(
        "centers/<int:center_pk>/payment-requests/",
        CenterPaymentRequestListView.as_view(),
        name="center-payment-request-list",
    ),
    path(
        "centers/<int:center_pk>/payment-requests/<int:pk>/",
        CenterPaymentRequestDetailView.as_view(),
        name="center-payment-request-detail",
    ),
    path(
        "centers/<int:center_pk>/payment-requests/<int:pk>/share/",
        CenterPaymentRequestShareView.as_view(),
        name="center-payment-request-share",
    ),
    path(
        "centers/<int:center_pk>/payment-requests/<int:pk>/unshare/",
        CenterPaymentRequestUnshareView.as_view(),
        name="center-payment-request-unshare",
    ),
    path(
        "centers/<int:center_pk>/payment-requests/<int:pk>/send/",
        CenterPaymentRequestSendView.as_view(),
        name="center-payment-request-send",
    ),
    path(
        "centers/<int:center_pk>/payment-requests/<int:pk>/confirm-care/",
        CenterPaymentRequestConfirmCareView.as_view(),
        name="center-payment-request-confirm-care",
    ),
    path(
        "centers/<int:center_pk>/payment-requests/<int:pk>/close/",
        CenterPaymentRequestCloseView.as_view(),
        name="center-payment-request-close",
    ),
    path(
        "centers/<int:center_pk>/disputes/",
        CenterDisputeListView.as_view(),
        name="center-dispute-list",
    ),
    path(
        "centers/<int:center_pk>/disputes/<int:pk>/resolve/",
        CenterDisputeResolveView.as_view(),
        name="center-dispute-resolve",
    ),
    # Audience: the patient
    path(
        "patients/me/payment-requests/",
        MyPaymentRequestListView.as_view(),
        name="my-payment-request-list",
    ),
    path(
        "patients/me/payment-requests/<int:pk>/",
        MyPaymentRequestDetailView.as_view(),
        name="my-payment-request-detail",
    ),
    path(
        "patients/me/payment-requests/<int:pk>/share/",
        MyPaymentRequestShareView.as_view(),
        name="my-payment-request-share",
    ),
    path(
        "patients/me/payment-requests/<int:pk>/acknowledge/",
        MyPaymentRequestAcknowledgeView.as_view(),
        name="my-payment-request-acknowledge",
    ),
    path(
        "patients/me/payment-requests/<int:pk>/dispute/",
        MyPaymentRequestDisputeView.as_view(),
        name="my-payment-request-dispute",
    ),
    path("patients/me/receipts/", MyReceiptListView.as_view(), name="my-receipts"),
    path(
        "patients/me/cash-receipts/",
        MyCashReceiptListView.as_view(),
        name="my-cash-receipts",
    ),
    # Audience: a guardian
    path(
        "guardian/payment-requests/",
        GuardianPaymentRequestListView.as_view(),
        name="guardian-payment-request-list",
    ),
    path(
        "guardian/payment-requests/<int:pk>/",
        GuardianPaymentRequestDetailView.as_view(),
        name="guardian-payment-request-detail",
    ),
    path(
        "guardian/payment-requests/<int:pk>/quote/",
        GuardianPaymentRequestQuoteView.as_view(),
        name="guardian-payment-request-quote",
    ),
    path(
        "guardian/payment-requests/<int:pk>/pay/",
        GuardianPaymentRequestPayView.as_view(),
        name="guardian-payment-request-pay",
    ),
    path(
        "guardian/payment-requests/<int:pk>/dispute/",
        GuardianPaymentRequestDisputeView.as_view(),
        name="guardian-payment-request-dispute",
    ),
    path(
        "guardian/receipts/",
        GuardianReceiptListView.as_view(),
        name="guardian-receipts",
    ),
    # System: PSP webhook
    path(
        "trustbridge/webhooks/psp/",
        PspWebhookView.as_view(),
        name="psp-webhook",
    ),
]
