from pathlib import Path

from .base import *  # noqa: F403

BASE_DIR = Path(__file__).resolve().parent.parent

# print("print", BASE_DIR)

SECRET_KEY = "django-insecure-03eebp+*3833bj!9v)r41dvnv8eg%#avt!eyq7s=kk8@&plg^$"
DEBUG = True
ALLOWED_HOSTS = ["127.0.0.1", "localhost", "0.0.0.0", "app.localhost","backend.localhost"]

STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")  # noqa: F405

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# --------------------------------------------------------------------
# Dev Authentication: Session + SimpleJWT + Google fallback
# --------------------------------------------------------------------
# Login via:
#   - Django admin (/admin/) for session cookie
#   - POST /api/token/ with {username, password} for JWT Bearer token
#   - DRF browsable API login button
#   - Google OAuth (if GOOGLE_CLIENT_ID is set in env)
#
# Order matters: DRF tries each class in sequence and STOPS if one
# raises AuthenticationFailed (SimpleJWT does this for bad tokens).
# GoogleTokenAuthentication must come BEFORE JWTAuthentication because
# it returns None (not raises) for non-Google tokens, allowing the
# chain to continue.
#   1. DevSessionAuthentication — handles session cookies from /admin/
#   2. GoogleTokenAuthentication — handles Google id_tokens (returns None if not a Google token)
#   3. JWTAuthentication — handles SimpleJWT access tokens from /api/token/
# --------------------------------------------------------------------
REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"] = (  # noqa: F405
    "apps.heritage_data.authentication.DevSessionAuthentication",
    "apps.heritage_data.authentication.GoogleTokenAuthentication",
    "rest_framework_simplejwt.authentication.JWTAuthentication",
)
