import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

from .base import *  # noqa: F403, E402
from .caching import build_caches_config  # noqa: E402

# GeoDjango loads native GDAL at startup (admin autodiscover). Enable only when your
# image has GDAL/GEOS/proj and Postgres has PostGIS; see Dockerfile + DB engine docs.
_POSTGIS_ENV = os.environ.get("HERITAGEGRAPH_ENABLE_POSTGIS", "").strip().lower()
if _POSTGIS_ENV in ("1", "true", "yes"):
    INSTALLED_APPS.insert(  # noqa: F405
        INSTALLED_APPS.index("django.contrib.admin"),  # noqa: F405
        "django.contrib.gis",
    )

# --------------------------------------------------------------------
# Core Security Settings
# --------------------------------------------------------------------
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
# Reject empty and well-known insecure defaults so a misconfigured deploy fails
# fast instead of silently running with a guessable key (session/CSRF forgery).
_INSECURE_SECRET_KEYS = {
    "",
    "dev-key-change-in-production",
    "dev-nextauth-secret-change-in-production",
    "changeme",
}
if not SECRET_KEY or SECRET_KEY.strip() in _INSECURE_SECRET_KEYS:
    raise ValueError(
        "DJANGO_SECRET_KEY must be set to a secure, non-default value in production."
    )

DEBUG = os.environ.get("DEBUG", "False").lower() == "true"
_allowed_raw = os.environ.get("ALLOWED_HOSTS", "")
ALLOWED_HOSTS = [h.strip() for h in _allowed_raw.split(",") if h.strip()]

# Operator must declare the public hostnames. Check BEFORE adding the internal
# docker hostname, otherwise this guard can never fire (it would be ["backend"]).
if not ALLOWED_HOSTS:
    raise ValueError("ALLOWED_HOSTS must be set for production.")

# Allow internal docker network requests from Next.js frontend to 'backend:8000'
if "backend" not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append("backend")

# Behind Coolify / Traefik: correct scheme and host for redirects and OpenAPI URLs
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# --------------------------------------------------------------------
# Database Configuration
# --------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME"),
        "USER": os.environ.get("DB_USER"),
        "PASSWORD": os.environ.get("DB_PASSWORD"),
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT", "5432"),
        "ATOMIC_REQUESTS": True,  # safer transactions
        "CONN_MAX_AGE": 300,  # persistent connections
    }
}

# Sanity check for required DB vars
for var in ("DB_NAME", "DB_USER", "DB_PASSWORD"):
    if not os.environ.get(var):
        raise ValueError(f"Missing required database environment variable: {var}")

CACHES = build_caches_config()

# --------------------------------------------------------------------
# Authentication: Google OAuth (primary) + GitHub (placeholder)
# --------------------------------------------------------------------
# Google is the primary auth provider. GitHub is ready for future use.
# Both backends return None for unrecognized tokens, allowing the
# chain to fall through gracefully.
# --------------------------------------------------------------------
REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"] = (  # noqa: F405
    "apps.heritage_data.authentication.GoogleTokenAuthentication",
    "apps.heritage_data.authentication.SafeJWTAuthentication",
)

# Spectacular (/docs, /redoc/, /schema/) must stay public; do not inherit Google/JWT auth
SPECTACULAR_SETTINGS.update(  # noqa: F405
    {
        "SERVE_PERMISSIONS": ["rest_framework.permissions.AllowAny"],
        "SERVE_AUTHENTICATION": [],
    }
)

# --------------------------------------------------------------------
# Security Middleware (TLS terminated at Traefik; SSL redirect off by default)
# --------------------------------------------------------------------
SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "31536000"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = os.environ.get("SECURE_SSL_REDIRECT", "False").lower() == "true"

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
X_FRAME_OPTIONS = "DENY"
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True

SIMPLE_JWT.update(  # noqa: F405
    {
        "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
        "REFRESH_TOKEN_LIFETIME": timedelta(hours=12),
        "ROTATE_REFRESH_TOKENS": True,
        "BLACKLIST_AFTER_ROTATION": True,
    }
)

# --------------------------------------------------------------------
# Email Configuration
# --------------------------------------------------------------------
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend"
)
EMAIL_HOST = os.environ.get("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", 587))
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "True").lower() == "true"
EMAIL_USE_SSL = os.environ.get("EMAIL_USE_SSL", "False").lower() == "true"
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "webmaster@localhost")

# --------------------------------------------------------------------
# Logging (useful for production debugging)
# --------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    "root": {
        "handlers": ["console"],
        "level": os.environ.get("LOG_LEVEL", "INFO"),
    },
}

# --------------------------------------------------------------------
# Static & Media (if not handled by CDN)
# --------------------------------------------------------------------
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = BASE_DIR / "media"
STATIC_URL = "/static/"
MEDIA_URL = "/media/"

# --------------------------------------------------------------------
# CORS Configuration
# --------------------------------------------------------------------
# When set (including empty), replace base.py defaults so production uses only listed origins.
if "CORS_ALLOWED_ORIGINS" in os.environ:
    _cors_origins = os.environ["CORS_ALLOWED_ORIGINS"]
    CORS_ALLOWED_ORIGINS = [
        origin.strip() for origin in _cors_origins.split(",") if origin.strip()
    ]

CORS_ALLOW_CREDENTIALS = True

# --------------------------------------------------------------------
# CSRF trusted origins
# --------------------------------------------------------------------
# base.py pins the known heritagegraph.xyz origins. Any deployment on another
# domain — a staging host, a rename, a fork — then fails CSRF on Django admin
# login with no configuration-level fix, which is why new hostnames have been
# appended to base.py by hand. Additive, so the pinned list keeps working.
_csrf_extra = os.environ.get("CSRF_TRUSTED_ORIGINS", "")
for _origin in (o.strip() for o in _csrf_extra.split(",")):
    if _origin and _origin not in CSRF_TRUSTED_ORIGINS:  # noqa: F405
        CSRF_TRUSTED_ORIGINS.append(_origin)  # noqa: F405

# OCR / document processing configuration is read from environment in `settings.base`
# (OCR_ENABLED, OCR_MAX_FILE_BYTES, OCR_MAX_PAGES_PER_DOCUMENT, etc.)
