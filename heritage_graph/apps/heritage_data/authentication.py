import jwt
from django.contrib.auth.models import User
from jwt import PyJWKClient
from rest_framework import authentication, exceptions

from .models import UserProfile  # import your UserProfile model

# Keycloak configuration
KEYCLOAK_ISSUER = "http://keycloak.localhost/realms/HeritageRealm"
KEYCLOAK_AUDIENCE = "account"
KEYCLOAK_JWKS_URL = f"{KEYCLOAK_ISSUER}/protocol/openid-connect/certs"


class KeycloakJWTAuthentication(authentication.BaseAuthentication):
    """
    Authenticate requests using Keycloak JWT tokens
    and sync with Django User + UserProfile.
    """

    def authenticate(self, request):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None

        token = auth_header.split(" ")[1]

        try:
            # Fetch signing key from Keycloak JWKS
            jwks_client = PyJWKClient(KEYCLOAK_JWKS_URL)
            signing_key = jwks_client.get_signing_key_from_jwt(token)

            # Decode and verify token
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=KEYCLOAK_AUDIENCE,
                issuer=KEYCLOAK_ISSUER,
            )

            print("=========================================")
            print("Payload: ", payload)
            print("=========================================")

        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed("Token has expired.")
        except jwt.InvalidTokenError as e:
            raise exceptions.AuthenticationFailed(f"Invalid token: {str(e)}")

        # Map Keycloak payload to Django User
        username = payload.get("preferred_username")
        if not username:
            raise exceptions.AuthenticationFailed("Token missing username.")

        user, created = User.objects.get_or_create(username=username)

        # Update Django user fields
        user.email = payload.get("email", user.email)
        user.first_name = payload.get("given_name", user.first_name)
        user.last_name = payload.get("family_name", user.last_name)
        user.save()

        # --- Sync UserProfile ---
        profile, _ = UserProfile.objects.get_or_create(user=user)

        # Populate from Keycloak claims if available
        profile.first_name = payload.get("given_name", profile.first_name)
        profile.last_name = payload.get("family_name", profile.last_name)
        profile.email = payload.get("email", profile.email)
        profile.clerk_user_id = payload.get(
            "sub", profile.clerk_user_id
        )  # Keycloak UUID
        profile.organization = payload.get("organization", profile.organization)
        profile.position = payload.get("position", profile.position)
        profile.university_school = payload.get("university", profile.university_school)

        # map birthdate if Keycloak provides it
        birthdate = payload.get("birthdate")
        if birthdate:
            try:
                from datetime import datetime

                profile.birth_date = datetime.strptime(birthdate, "%Y-%m-%d").date()
            except ValueError:
                pass  # ignore invalid formats

        profile.save()

        return (user, None)
