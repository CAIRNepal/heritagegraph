# keycloak_auth.py
import jwt
from django.contrib.auth.models import User
from jwt import PyJWKClient
from rest_framework import authentication, exceptions

# Keycloak configuration
KEYCLOAK_ISSUER = "http://localhost:8080/realms/heritageRealm"
KEYCLOAK_AUDIENCE = "account"
KEYCLOAK_JWKS_URL = f"{KEYCLOAK_ISSUER}/protocol/openid-connect/certs"


class KeycloakJWTAuthentication(authentication.BaseAuthentication):
    """
    Authenticate requests using Keycloak JWT tokens.
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

        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed("Token has expired.")
        except jwt.InvalidTokenError as e:
            raise exceptions.AuthenticationFailed(f"Invalid token: {str(e)}")

        # Map Keycloak payload to Django User
        username = payload.get("preferred_username")
        if not username:
            raise exceptions.AuthenticationFailed("Token missing username.")

        user, created = User.objects.get_or_create(username=username)
        # Optional: update user details
        user.email = payload.get("email", user.email)
        user.first_name = payload.get("given_name", user.first_name)
        user.last_name = payload.get("family_name", user.last_name)
        user.save()

        return (user, None)
