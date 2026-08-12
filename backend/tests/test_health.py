"""Smoke test for the public health endpoint."""

from django.urls import reverse


def test_health_endpoint_is_public_and_returns_ok(client):
    """`/api/v1/health/` must answer 200 without any authentication."""
    response = client.get(reverse("health"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "chioni-backend"}
