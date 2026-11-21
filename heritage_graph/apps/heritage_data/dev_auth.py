"""DEBUG-gated development authentication (disabled when DEBUG=False)."""

from __future__ import annotations

from apps.users.auth_audit import record_auth_event
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .dev_auth_utils import dev_auth_enabled
from .models import UserProfile
from .throttles import DevLoginThrottle

User = get_user_model()


class DevLoginView(APIView):
    """Email-only dev login. Returns SimpleJWT pair. Never available in production."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [DevLoginThrottle]

    def post(self, request):
        if not dev_auth_enabled():
            return Response(
                {"detail": "Dev authentication is disabled."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        email = (request.data.get("email") or "").strip().lower()
        if not email or "@" not in email:
            record_auth_event(
                request,
                event_type="login_failure",
                provider="dev",
                email=email or None,
                failure_reason="invalid_email",
            )
            return Response(
                {"detail": "A valid email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user, _created = User.objects.get_or_create(email=email)
        UserProfile.objects.get_or_create(user=user)

        refresh = RefreshToken.for_user(user)
        record_auth_event(
            request,
            event_type="login_success",
            provider="dev",
            email=email,
        )

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_200_OK,
        )
