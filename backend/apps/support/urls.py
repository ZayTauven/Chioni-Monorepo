"""Support routes — TENANT side, mounted at the ROOT of `/api/v1/`.

One family (`centers/<center_pk>/support/tickets/…`), like the billing and
Trust Bridge modules: the app owns the object, the URL says which audience
reads it.
"""

from django.urls import path

from apps.support.views import (
    CenterSupportAttachmentDownloadView,
    CenterSupportAttachmentView,
    CenterSupportMessageView,
    CenterSupportTicketDetailView,
    CenterSupportTicketListCreateView,
)

app_name = "support"

urlpatterns = [
    path(
        "centers/<int:center_pk>/support/tickets/",
        CenterSupportTicketListCreateView.as_view(),
        name="ticket-list",
    ),
    path(
        "centers/<int:center_pk>/support/tickets/<int:pk>/",
        CenterSupportTicketDetailView.as_view(),
        name="ticket-detail",
    ),
    path(
        "centers/<int:center_pk>/support/tickets/<int:pk>/messages/",
        CenterSupportMessageView.as_view(),
        name="ticket-messages",
    ),
    path(
        "centers/<int:center_pk>/support/tickets/<int:pk>/attachments/",
        CenterSupportAttachmentView.as_view(),
        name="ticket-attachments",
    ),
    path(
        "centers/<int:center_pk>/support/tickets/<int:pk>/attachments/"
        "<int:attachment_pk>/download/",
        CenterSupportAttachmentDownloadView.as_view(),
        name="ticket-attachment-download",
    ),
]
