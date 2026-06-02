from pathlib import Path

from .base import *  # noqa: F403
from .caching import build_caches_config

BASE_DIR = Path(__file__).resolve().parent.parent

# print("print", BASE_DIR)

SECRET_KEY = "django-insecure-03eebp+*3833bj!9v)r41dvnv8eg%#avt!eyq7s=kk8@&plg^$"
DEBUG = True
ALLOWED_HOSTS = ["127.0.0.1", "localhost", "0.0.0.0", "app.localhost","backend.localhost", "backend"]

STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")  # noqa: F405

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

CACHES = build_caches_config()

# --------------------------------------------------------------------
# Authentication: Google OAuth (primary) + GitHub (placeholder)
# --------------------------------------------------------------------
# Order matters: DRF tries each class in sequence and STOPS if one
# raises AuthenticationFailed.
# GoogleTokenAuthentication returns None (not raises) for non-Google
# tokens, allowing the chain to continue.
#
#   1. DevHeaderAuthentication   — X-Dev-User header (DEBUG + HERITAGEGRAPH_DEV_AUTH)
#   2. GoogleTokenAuthentication — primary: verifies Google id_tokens
#   3. GitHubTokenAuthentication — secondary: verifies GitHub access_tokens
#   4. DevSessionAuthentication  — allows Django admin session access
#   5. JWTAuthentication          — fallback for SimpleJWT tokens
# --------------------------------------------------------------------
REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"] = (  # noqa: F405
    "apps.heritage_data.authentication.DevHeaderAuthentication",
    "apps.heritage_data.authentication.GoogleTokenAuthentication",
    "apps.heritage_data.authentication.GitHubTokenAuthentication",
    "apps.heritage_data.authentication.DevSessionAuthentication",
    "apps.heritage_data.authentication.SafeJWTAuthentication",
)


# Development-specific SimpleJWT settings: increase token lifetimes for easier local testing
# These override the base `SIMPLE_JWT` dict imported from base.py
from datetime import timedelta

SIMPLE_JWT.update({
    "ACCESS_TOKEN_LIFETIME": timedelta(days=7),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
})

# ── Celery Development Configuration ──────────────────────────────────────
# In development, run tasks synchronously (eager mode) for easier debugging
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# OCR / document processing guardrails (read from environment in `settings.base`)
# - OCR_ENABLED, OCR_MAX_FILE_BYTES, OCR_MAX_PAGES_PER_DOCUMENT, OCR_CLAUDE_VISION_MAX_CALLS_PER_DOCUMENT, TESSERACT_PATH, ...
