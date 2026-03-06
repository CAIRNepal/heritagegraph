"""
Authentication backends for Django REST Framework.

Three backends are provided, selected via DJANGO_ENV:

- **Development:** `DevSessionAuthentication`
  Uses Django's built-in session auth + simple JWT (SimpleJWT).
  No external OAuth setup required — just create a user via
  `manage.py createsuperuser` and login at /api/token/.

- **Production:** `GoogleTokenAuthentication`
  Verifies Google-issued ID tokens (sent by NextAuth frontend as
  Bearer tokens) and auto-creates/syncs Django User + UserProfile.

- **Production:** `GitHubTokenAuthentication`
  Verifies GitHub OAuth access tokens (sent by NextAuth frontend as
  Bearer tokens) and auto-creates/syncs Django User + UserProfile.
"""

import logging
import os

import requests as http_requests
from django.contrib.auth.models import User
from rest_framework import authentication, exceptions

from .models import UserProfile

logger = logging.getLogger(__name__)


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
# Production Authentication — Google OAuth ID Token
# ====================================================================

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")


class GoogleTokenAuthentication(authentication.BaseAuthentication):
    """
    Authenticate requests using Google ID tokens.

    The frontend (NextAuth + GoogleProvider) sends the Google id_token
    as a Bearer token in the Authorization header. This backend:

    1. Verifies the token signature & claims via Google's public keys
    2. Maps Google claims → Django User fields
    3. Auto-creates User + UserProfile on first login (get_or_create)
    """

    def authenticate(self, request):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None

        # If GOOGLE_CLIENT_ID is not configured, skip this backend entirely
        # so the next auth class in the chain can handle the token.
        if not GOOGLE_CLIENT_ID:
            return None

        token = auth_header.split(" ")[1]

        try:
            from google.auth.transport import requests as google_requests
            from google.oauth2 import id_token as google_id_token

            # Verify the Google ID token against Google's public certs.
            # This checks signature, expiry, issuer, and audience.
            payload = google_id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                GOOGLE_CLIENT_ID,
            )
        except ValueError:
            # Token is not a valid Google token — return None so the next
            # auth class in the chain can try (e.g. JWTAuthentication).
            return None

        # Ensure the token was issued by Google
        issuer = payload.get("iss", "")
        if issuer not in ("accounts.google.com", "https://accounts.google.com"):
            raise exceptions.AuthenticationFailed("Token not issued by Google.")

        email = payload.get("email")
        if not email:
            raise exceptions.AuthenticationFailed("Token missing email claim.")

        if not payload.get("email_verified", False):
            raise exceptions.AuthenticationFailed("Google email not verified.")

        # --- Map Google claims to Django User ---
        username = email

        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": email},
        )

        # Always sync core fields from Google
        user.email = email
        user.first_name = payload.get("given_name", user.first_name) or ""
        user.last_name = payload.get("family_name", user.last_name) or ""
        user.save()

        if created:
            logger.info("Created new Django user from Google sign-in: %s", email)

        # --- Sync UserProfile ---
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.first_name = payload.get("given_name", profile.first_name) or ""
        profile.last_name = payload.get("family_name", profile.last_name) or ""
        profile.email = email
        # Store Google's unique subject ID for reference
        profile.clerk_user_id = payload.get("sub", profile.clerk_user_id)
        profile.save()

        return (user, None)


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

        # --- Map GitHub user → Django User ---
        username = email  # consistent with Google auth

        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": email},
        )

        # Always sync core fields from GitHub
        user.email = email
        user.first_name = first_name
        user.last_name = last_name
        user.save()

        if created:
            logger.info("Created new Django user from GitHub sign-in: %s (gh: %s)", email, github_login)

        # --- Sync UserProfile ---
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.first_name = first_name
        profile.last_name = last_name
        profile.email = email
        # Store GitHub's unique ID for reference
        profile.clerk_user_id = str(github_id)
        if gh_user.get("avatar_url") and not profile.profile_image:
            # Don't overwrite existing profile images
            pass
        profile.save()

        return (user, None)
