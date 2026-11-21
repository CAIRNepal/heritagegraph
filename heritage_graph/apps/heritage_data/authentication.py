"""
Authentication backends for Django REST Framework.

Three backends are provided:

- **Primary:** `GoogleTokenAuthentication`
  Verifies Google-issued ID tokens (sent by NextAuth frontend as
  Bearer tokens) and auto-creates/syncs Django User + UserProfile.
  This is the main auth method for all environments.

- **Secondary (placeholder):** `GitHubTokenAuthentication`
  Verifies GitHub OAuth access tokens (sent by NextAuth frontend as
  Bearer tokens) and auto-creates/syncs Django User + UserProfile.
  Ready for use — enable by setting GITHUB_ID / GITHUB_SECRET env vars.

- **Dev helper:** `DevSessionAuthentication`
  Uses Django's built-in session auth for admin panel access.
  Included in the dev auth chain for convenience.
"""

import logging
import os

import requests as http_requests
from apps.users.auth_audit import record_auth_event
from apps.users.models import AuthEvent
from django.contrib.auth import get_user_model
from rest_framework import authentication, exceptions
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from .dev_auth_utils import dev_auth_enabled
from .models import UserProfile

logger = logging.getLogger(__name__)
User = get_user_model()


# ====================================================================
# Development Authentication — X-Dev-User header (DEBUG only)
# ====================================================================


class DevHeaderAuthentication(authentication.BaseAuthentication):
    """
    Authenticate via ``X-Dev-User: email@example.com`` when dev auth is enabled.

    Useful for curl/Postman without OAuth. Disabled when ``DEBUG=False``.
    """

    def authenticate(self, request):
        if not dev_auth_enabled():
            return None

        email = (request.headers.get("X-Dev-User") or "").strip().lower()
        if not email:
            return None

        user, _created = User.objects.get_or_create(email=email)
        UserProfile.objects.get_or_create(user=user)
        record_auth_event(
            request,
            event_type=AuthEvent.EVENT_LOGIN_SUCCESS,
            provider=AuthEvent.PROVIDER_DEV,
            email=email,
        )
        return (user, None)


# ====================================================================
# Development Authentication — Session + SimpleJWT (no Google needed)
# ====================================================================


class DevSessionAuthentication(authentication.SessionAuthentication):
    """
    Wraps Django's session auth for development use.

    Allows login via:
      - Django admin (/admin/) — session cookie
      - SimpleJWT (/api/token/) — Bearer token
      - DRF browsable API login

    Also auto-creates a UserProfile for newly authenticated users
    so downstream code that expects profile data doesn't break.
    """

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            user, _ = result
            # Ensure UserProfile exists (mirrors GoogleTokenAuth behavior)
            UserProfile.objects.get_or_create(user=user)
        return result


# ====================================================================
# Production Authentication — Google OAuth Access Token
# ====================================================================

GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def _email_verified_from_google_payload(payload: dict) -> bool:
    """Whether Google claims mark the email verified (bool or string in payload)."""
    raw = payload.get("email_verified", False)
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, str):
        return raw.strip().lower() in ("true", "1", "yes")
    return False


class GoogleTokenAuthentication(authentication.BaseAuthentication):
    """
    Authenticate Bearer tokens from NextAuth + Google.

    Accepts either:
    - **OAuth access token** — verified via Google's userinfo endpoint, or
    - **OIDC ID token (JWT)** — verified with `google-auth` against `GOOGLE_CLIENT_ID`.

    NextAuth may send either during sign-in; userinfo rejects ID tokens, so both paths
    are required for reliable Django verification.
    """

    @staticmethod
    def _claims_from_bearer_token(token: str, google_client_id: str) -> dict | None:
        try:
            resp = http_requests.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
        except http_requests.RequestException:
            return None

        if resp.status_code == 200:
            return resp.json()

        # ID token (JWT): userinfo returns 401; verify audience with google-auth
        if token.count(".") == 2 and google_client_id:
            try:
                from google.auth.transport import requests as google_requests
                from google.oauth2 import id_token as google_id_token

                return google_id_token.verify_oauth2_token(
                    token, google_requests.Request(), google_client_id
                )
            except ValueError:
                logger.debug("Google Bearer token is not a valid access or ID token")
                return None

        return None

    @staticmethod
    def _user_from_google_claims(payload: dict, request=None):
        email = payload.get("email")
        if not email:
            record_auth_event(
                request,
                event_type=AuthEvent.EVENT_LOGIN_FAILURE,
                provider=AuthEvent.PROVIDER_GOOGLE,
                failure_reason="missing_email",
            )
            raise exceptions.AuthenticationFailed("Token missing email claim.")

        if not _email_verified_from_google_payload(payload):
            record_auth_event(
                request,
                event_type=AuthEvent.EVENT_LOGIN_FAILURE,
                provider=AuthEvent.PROVIDER_GOOGLE,
                email=email,
                failure_reason="email_unverified",
            )
            raise exceptions.AuthenticationFailed("Google email not verified.")

        user, created = User.objects.get_or_create(
            email=email,
        )

        user.email = email
        if hasattr(user, "first_name"):
            user.first_name = (
                payload.get("given_name", getattr(user, "first_name", "")) or ""
            )
        if hasattr(user, "last_name"):
            user.last_name = (
                payload.get("family_name", getattr(user, "last_name", "")) or ""
            )
        user.save()

        if created:
            logger.info("Created new Django user from Google sign-in: %s", email)

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.first_name = payload.get("given_name", profile.first_name) or ""
        profile.last_name = payload.get("family_name", profile.last_name) or ""
        profile.email = email
        profile.avatar_url = payload.get("picture", profile.avatar_url)
        profile.clerk_user_id = payload.get("sub", profile.clerk_user_id)
        profile.save()

        record_auth_event(
            request,
            event_type=AuthEvent.EVENT_LOGIN_SUCCESS,
            provider=AuthEvent.PROVIDER_GOOGLE,
            email=email,
        )

        return (user, None)

    def authenticate(self, request):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None

        google_client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
        if not google_client_id:
            return None

        token = auth_header.split(" ", 1)[1].strip()
        if not token:
            return None

        payload = self._claims_from_bearer_token(token, google_client_id)
        if payload is None:
            return None

        return self._user_from_google_claims(payload, request=request)


# ====================================================================
# Production Authentication — GitHub OAuth Access Token
# ====================================================================

GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET", "")


class GitHubTokenAuthentication(authentication.BaseAuthentication):
    """
    Authenticate requests using GitHub OAuth access tokens.

    The frontend (NextAuth + GitHubProvider) sends the GitHub access_token
    as a Bearer token in the Authorization header. This backend:

    1. Calls GitHub's /user API to verify the token and get user info
    2. Maps GitHub claims → Django User fields
    3. Auto-creates User + UserProfile on first login (get_or_create)

    This backend returns None (instead of raising) for tokens that aren't
    GitHub tokens, so the next auth class in the DRF chain can try.
    """

    GITHUB_USER_API = "https://api.github.com/user"
    GITHUB_EMAILS_API = "https://api.github.com/user/emails"

    def authenticate(self, request):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None

        # If GitHub auth is not configured, skip entirely
        if not GITHUB_CLIENT_ID:
            return None

        token = auth_header.split(" ")[1]

        # Try to get user info from GitHub API
        try:
            resp = http_requests.get(
                self.GITHUB_USER_API,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                },
                timeout=10,
            )
        except http_requests.RequestException:
            return None

        # If GitHub rejects the token, let the next auth class try
        if resp.status_code != 200:
            return None

        gh_user = resp.json()

        # Verify this is a real GitHub response (has expected fields)
        github_id = gh_user.get("id")
        github_login = gh_user.get("login")
        if not github_id or not github_login:
            return None

        # Get primary verified email
        email = gh_user.get("email")
        if not email:
            # Some GitHub users have private emails — fetch from /user/emails
            try:
                email_resp = http_requests.get(
                    self.GITHUB_EMAILS_API,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/json",
                    },
                    timeout=10,
                )
                if email_resp.status_code == 200:
                    emails = email_resp.json()
                    for em in emails:
                        if em.get("primary") and em.get("verified"):
                            email = em["email"]
                            break
                    if not email and emails:
                        email = emails[0].get("email")
            except http_requests.RequestException:
                pass

        if not email:
            raise exceptions.AuthenticationFailed(
                "Could not retrieve email from GitHub. "
                "Please make sure your GitHub account has a verified email."
            )

        # Parse name
        full_name = gh_user.get("name") or github_login
        name_parts = full_name.split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        user, created = User.objects.get_or_create(
            email=email,
        )

        # Always sync core fields from GitHub
        user.email = email
        if hasattr(user, "first_name"):
            user.first_name = first_name
        if hasattr(user, "last_name"):
            user.last_name = last_name
        user.save()

        if created:
            logger.info(
                "Created new Django user from GitHub sign-in: %s (gh: %s)",
                email,
                github_login,
            )

        record_auth_event(
            request,
            event_type=AuthEvent.EVENT_LOGIN_SUCCESS,
            provider=AuthEvent.PROVIDER_GITHUB,
            email=email,
        )

        # --- Sync UserProfile ---
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.first_name = first_name
        profile.last_name = last_name
        profile.email = email
        profile.avatar_url = gh_user.get("avatar_url", profile.avatar_url)
        # Store GitHub's unique ID for reference
        profile.clerk_user_id = str(github_id)
        profile.save()

        return (user, None)


# ====================================================================
# Safe SimpleJWT — decline (return None) instead of raising on tokens
# that are not valid SimpleJWT access tokens.
# ====================================================================


class SafeJWTAuthentication(JWTAuthentication):
    """SimpleJWT authentication that fails *soft*.

    The default ``JWTAuthentication`` **raises** ``InvalidToken`` for any Bearer
    token it cannot parse as a SimpleJWT access token. Because HeritageGraph also
    accepts **Google ID tokens** as Bearer credentials, an expired or non-SimpleJWT
    token would otherwise reach this backend and 403 the request with the confusing
    ``"Given token not valid for any token type"`` — even on public endpoints, since
    DRF runs authentication before permission checks.

    Returning ``None`` instead lets the request fall through to anonymous access:
    public endpoints still serve, and protected endpoints respond with the clear
    ``"Authentication credentials were not provided."`` (re-authenticate / refresh).
    Genuine SimpleJWT access tokens still authenticate normally.
    """

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except (InvalidToken, TokenError):
            return None
