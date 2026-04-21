import os
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent


env = environ.Env(DEBUG=(bool, False))
environ.Env.read_env(os.path.join(BASE_DIR, ".env"))

INSTALLED_APPS = [
    "rest_framework",
    "apps.users",
    "apps.heritage_data",
    "apps.cidoc_data",
    "apps.document_processing",
    "apps.assistant",

    "django_prometheus",
    # "djoser",
    # "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_extensions",
    "drf_spectacular",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",

    # prometheus
    "django_prometheus.middleware.PrometheusBeforeMiddleware",
    "django_prometheus.middleware.PrometheusAfterMiddleware",
]

ROOT_URLCONF = "urls"

CSRF_TRUSTED_ORIGINS = [
    'https://heritagegraph.xyz',
    'https://api.heritagegraph.xyz',
    'https://www.heritagegraph.xyz',
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "wsgi.application"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
        )
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ── Internationalization ─────────────────────────────────────────────────────
LANGUAGE_CODE = "en"
TIME_ZONE = "Asia/Kathmandu"
USE_I18N = True
USE_L10N = True
USE_TZ = True

LANGUAGES = [
    ("en", "English"),
    ("ne", "नेपाली"),
]

LOCALE_PATHS = [
    BASE_DIR / "locale",
]

STATIC_URL = "static/"

# WhiteNoise: serve and compress static files from the app itself
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "users.User"

REST_FRAMEWORK = {
    # Auth classes are set per-environment in development.py / production.py
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # Versioning: prefer URL-based (/api/v1/...)
    "DEFAULT_VERSIONING_CLASS": "rest_framework.versioning.URLPathVersioning",
    "DEFAULT_VERSION": "v1",
    "ALLOWED_VERSIONS": ["v1"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.LimitOffsetPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
}

SPECTACULAR_SETTINGS = {
    "TITLE": "HeritageGraph API Documentation",
    "DESCRIPTION": "Detailed documentation for all available APIs.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    # Register custom auth extensions so Spectacular resolves our custom authenticators
    "EXTENSIONS": [
        "apps.heritage_data.openapi_extensions",
    ],
}

SIMPLE_JWT = {
    "AUTH_HEADER_TYPES": ("Bearer",),
}

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

DJOSER = {
    "PASSWORD_RESET_CONFIRM_URL": (
        "auth/password/reset-password-confirmation/?" "uid={uid}&token={token}"
    ),
    "ACTIVATION_URL": "#/activate/{uid}/{token}",
    "SEND_ACTIVATION_EMAIL": False,
    "SERIALIZERS": {},
    "LOGIN_FIELD": "email",
}

SITE_NAME = "Heritage Graph"
DOMAIN = "localhost:3000"

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost",
    "http://app.localhost",
    "http://heritagegraph.olinabin.com.np",
]

# ── Celery Configuration ──────────────────────────────────────────────────────
# Async task queue for OCR, NER extraction, and heavy processing
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/1')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Asia/Kathmandu'
CELERY_ENABLE_UTC = True
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes hard limit
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60  # 25 minutes soft limit
CELERY_WORKER_PREFETCH_MULTIPLIER = 1  # Process one task at a time
CELERY_WORKER_MAX_TASKS_PER_CHILD = 1000  # Restart worker after 1000 tasks to prevent memory leaks

# ── Document OCR / processing ────────────────────────────────────────────────
# These are *defaults*; tune per environment via .env
OCR_ENABLED = (os.environ.get("OCR_ENABLED", "true").lower() in {"1", "true", "yes", "y", "on"})
OCR_CONFIDENCE_THRESHOLD = float(os.environ.get("OCR_CONFIDENCE_THRESHOLD", "0.6"))
OCR_MAX_PAGES_PER_DOCUMENT = int(os.environ.get("OCR_MAX_PAGES_PER_DOCUMENT", "100"))
OCR_CLAUDE_VISION_MAX_CALLS_PER_DOCUMENT = int(
    os.environ.get("OCR_CLAUDE_VISION_MAX_CALLS_PER_DOCUMENT", "1")
)
OCR_MAX_FILE_BYTES = int(
    os.environ.get(
        "OCR_MAX_FILE_BYTES",
        str(25 * 1024 * 1024),
    )
)
# Optional override for the Tesseract binary location (useful in containers)
TESSERACT_PATH = os.environ.get("TESSERACT_PATH", "")

# ── Ontology / schema registry (LinkML YAML → API, see specs/004-yaml-driven-schema) ──
HERITAGEGRAPH_SCHEMA_PATH = os.environ.get(
    "HERITAGEGRAPH_SCHEMA_PATH",
    str(BASE_DIR / "ontology" / "HeritageGraph.yaml"),
)
HERITAGEGRAPH_SCHEMA_EXTENSION_PATH = os.environ.get(
    "HERITAGEGRAPH_SCHEMA_EXTENSION_PATH", ""
)
HERITAGEGRAPH_SCHEMA_CACHE_TTL = int(os.environ.get("HERITAGEGRAPH_SCHEMA_CACHE_TTL", "60"))
HERITAGEGRAPH_SCHEMA_REGISTRY_PREFER_FRESH = os.environ.get(
    "HERITAGEGRAPH_SCHEMA_REGISTRY_PREFER_FRESH", "false"
).lower() in {"1", "true", "yes", "y", "on"}
RDF_ENDPOINT_URL = os.environ.get("RDF_ENDPOINT_URL", "")
RDF_SYNC_ENABLED = os.environ.get("RDF_SYNC_ENABLED", "false").lower() in {
    "1",
    "true",
    "yes",
    "y",
    "on",
}

GRAPH_MODELS = {
    "all_applications": True,
    "graph_models": True,
}
