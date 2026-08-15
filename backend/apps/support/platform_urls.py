"""Back-office support routes — mounted under `/api/v1/platform/`.

FIFTH module on that prefix (S5 lot 3, after centers/KYC, PSP
reconciliation, RGPD and the SaaS subscription): Django resolves several
includes on one prefix without conflict, and the structural guard-rail
(``tests/test_permissions_platform.py``) covers this module automatically
— every route below MUST declare ``IsPlatformStaff``.
"""

from django.urls import path

from apps.support.platform_views import (
    PlatformSupportAttachmentDownloadView,
    PlatformSupportMessageView,
    PlatformSupportTicketDetailView,
    PlatformSupportTicketListView,
    PlatformSupportTicketStatusView,
)

app_name = "platform-support"

urlpatterns = [
    path(
        "support/tickets/",
        PlatformSupportTicketListView.as_view(),
        name="ticket-list",
    ),
    path(
        "support/tickets/<int:pk>/",
        PlatformSupportTicketDetailView.as_view(),
        name="ticket-detail",
    ),
    path(
        "support/tickets/<int:pk>/messages/",
        PlatformSupportMessageView.as_view(),
        name="ticket-messages",
    ),
    path(
        "support/tickets/<int:pk>/status/",
        PlatformSupportTicketStatusView.as_view(),
        name="ticket-status",
    ),
    path(
        "support/tickets/<int:pk>/attachments/<int:attachment_pk>/download/",
        PlatformSupportAttachmentDownloadView.as_view(),
        name="ticket-attachment-download",
    ),
]
