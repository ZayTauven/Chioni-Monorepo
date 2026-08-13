"""Global DRF exception handling.

Domain services raise ``django.core.exceptions.ValidationError`` (they are
framework-agnostic and also guard non-HTTP paths like Celery tasks). DRF
only translates its OWN ValidationError into a 400 — without this bridge,
every business refusal would surface as a 500. Registered in
``REST_FRAMEWORK["EXCEPTION_HANDLER"]``.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.views import exception_handler as drf_default_handler


def exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, "message_dict"):
            detail = exc.message_dict
        else:
            detail = exc.messages
        exc = DRFValidationError(detail=detail)
    return drf_default_handler(exc, context)
