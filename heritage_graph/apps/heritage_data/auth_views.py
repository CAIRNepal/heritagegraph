"""Authentication API views with throttling and audit logging."""

from apps.users.auth_audit import record_auth_event
from apps.users.models import AuthEvent
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .throttles import TokenObtainThrottle, TokenRefreshThrottle


class ThrottledTokenObtainPairView(TokenObtainPairView):
    throttle_classes = [TokenObtainThrottle]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        email = (request.data.get("email") or "").strip().lower()
        if response.status_code == 200:
            record_auth_event(
                request,
                event_type=AuthEvent.EVENT_LOGIN_SUCCESS,
                provider=AuthEvent.PROVIDER_JWT,
                email=email or None,
            )
        else:
            record_auth_event(
                request,
                event_type=AuthEvent.EVENT_LOGIN_FAILURE,
                provider=AuthEvent.PROVIDER_JWT,
                email=email or None,
                failure_reason="invalid_credentials",
            )
        return response


class ThrottledTokenRefreshView(TokenRefreshView):
    throttle_classes = [TokenRefreshThrottle]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            record_auth_event(
                request,
                event_type=AuthEvent.EVENT_TOKEN_REFRESH,
                provider=AuthEvent.PROVIDER_JWT,
            )
        return response
