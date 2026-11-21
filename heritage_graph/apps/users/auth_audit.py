"""Authentication audit helpers — persist events to AuthEvent, not application logs."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.http import HttpRequest


def get_client_ip(request: HttpRequest) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def get_user_agent(request: HttpRequest) -> str:
    return (request.META.get("HTTP_USER_AGENT") or "")[:512]


def record_auth_event(
    request: HttpRequest | None,
    *,
    event_type: str,
    provider: str,
    email: str | None = None,
    failure_reason: str = "",
) -> None:
    from .models import AuthEvent

    ip_address = None
    user_agent = ""
    if request is not None:
        ip_address = get_client_ip(request)
        user_agent = get_user_agent(request)

    AuthEvent.objects.create(
        event_type=event_type,
        provider=provider,
        email=(email or "").strip().lower(),
        ip_address=ip_address,
        user_agent=user_agent,
        failure_reason=(failure_reason or "")[:64],
    )
