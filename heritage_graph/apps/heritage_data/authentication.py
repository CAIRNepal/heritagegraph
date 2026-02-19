"""
Google ID Token Authentication for Django REST Framework.

Verifies Google-issued ID tokens (sent by NextAuth frontend as Bearer tokens)
and auto-creates/syncs Django User + UserProfile records.

Replaces the former KeycloakJWTAuthentication class.
"""

import logging

from django.contrib.auth.models import User
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from rest_framework import authentication, exceptions

from .models import UserProfile

logger = logging.getLogger(__name__)

# Google OAuth Client ID — must match the one used in the NextAuth frontend.
# Set via environment variable in production; falls back to empty string.
import os

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

        token = auth_header.split(" ")[1]

        try:
            # Verify the Google ID token against Google's public certs.
            # This checks signature, expiry, issuer, and audience.
            payload = google_id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                GOOGLE_CLIENT_ID,
            )
        except ValueError as e:
            raise exceptions.AuthenticationFailed(f"Invalid Google token: {str(e)}")

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
        # Use email as username (Google has no separate username concept)
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
