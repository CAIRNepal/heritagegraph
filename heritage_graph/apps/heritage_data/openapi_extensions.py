"""
drf-spectacular OpenApiAuthenticationExtension subclasses.

These tell Spectacular how to represent our custom auth backends
(GoogleTokenAuthentication, GitHubTokenAuthentication, DevSessionAuthentication)
in the generated OpenAPI schema so it no longer warns about unresolved
authenticators.

Auto-discovered by drf-spectacular because we register the module
in SPECTACULAR_SETTINGS["EXTENSIONS"] (see settings/base.py).
"""

from drf_spectacular.extensions import OpenApiAuthenticationExtension


class GoogleTokenAuthExtension(OpenApiAuthenticationExtension):
    """Describe GoogleTokenAuthentication for the OpenAPI schema."""

    target_class = "apps.heritage_data.authentication.GoogleTokenAuthentication"
    name = "GoogleOAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "Google OAuth Access Token or OIDC ID Token",
            "description": (
                "Authenticate with a Google-issued OAuth access token or "
                "OIDC ID token obtained via NextAuth. Pass it in the "
                "Authorization header as: `Bearer <token>`."
            ),
        }


class GitHubTokenAuthExtension(OpenApiAuthenticationExtension):
    """Describe GitHubTokenAuthentication for the OpenAPI schema."""

    target_class = "apps.heritage_data.authentication.GitHubTokenAuthentication"
    name = "GitHubOAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "GitHub OAuth Access Token",
            "description": (
                "Authenticate with a GitHub OAuth access token obtained via "
                "NextAuth GitHubProvider. Pass it in the Authorization header "
                "as: `Bearer <token>`. Requires GITHUB_CLIENT_ID to be set."
            ),
        }


class DevSessionAuthExtension(OpenApiAuthenticationExtension):
    """Describe DevSessionAuthentication for the OpenAPI schema."""

    target_class = "apps.heritage_data.authentication.DevSessionAuthentication"
    name = "SessionAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "apiKey",
            "in": "cookie",
            "name": "sessionid",
            "description": (
                "Django session-based authentication (development only). "
                "Log in via the Django admin or DRF browsable API."
            ),
        }
