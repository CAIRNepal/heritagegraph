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
    "apps.graph",

    "django_prometheus",
    # "djoser",
    "rest_framework_simplejwt.token_blacklist",
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
    "DEFAULT_THROTTLE_RATES": {
        "project_create": "10/hour",
        "project_asset_upload": "50/day",
        "token_obtain": "10/min",
        "register": "5/hour",
        "dev_login": "20/hour",
    },
}

# Sessions: Redis-backed when REDIS_URL is set (see caching.py); DB fallback otherwise.
_redis_url = os.environ.get("REDIS_URL", "").strip()
if _redis_url:
    SESSION_ENGINE = "django.contrib.sessions.backends.cache"
    SESSION_CACHE_ALIAS = "default"

SESSION_COOKIE_AGE = 60 * 60 * 12  # 12 hours absolute
SESSION_SAVE_EVERY_REQUEST = True

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

# The frontend fetches several endpoints (e.g. the ontology schema registry) with
# `credentials: "include"`. Browsers block such responses unless the server sends
# `Access-Control-Allow-Credentials: true`; without it the fetch throws and the UI
# falls back to the stale ontology snapshot. (Production also sets this.)
CORS_ALLOW_CREDENTIALS = True

# Custom headers the frontend sends that aren't in the django-cors-headers default
# (which only allows accept, authorization, content-type, user-agent, x-csrftoken,
# x-requested-with). Idempotency-Key is required by /projects/ POST and several
# contribution endpoints; without it the browser blocks the preflight and fetch
# throws "Unable to reach the server".
from corsheaders.defaults import default_headers as _cors_default_headers  # noqa: E402

CORS_ALLOW_HEADERS = (
    *_cors_default_headers,
    "idempotency-key",
)

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
# OCR / document-to-graph ingestion is SUSPENDED (future functionality), so it is
# disabled by default. The upload signal short-circuits gracefully when off
# (uploads still succeed; no OCR task is enqueued). Set OCR_ENABLED=true to revive.
OCR_ENABLED = (os.environ.get("OCR_ENABLED", "false").lower() in {"1", "true", "yes", "y", "on"})
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
OCR_MAX_RUNS_PER_PROJECT_PER_DAY = int(
    os.environ.get("OCR_MAX_RUNS_PER_PROJECT_PER_DAY", "10")
)
# Project workspace asset uploads (separate ceiling from OCR pipeline max)
PROJECT_ASSET_UPLOAD_MAX_BYTES = int(
    os.environ.get(
        "PROJECT_ASSET_UPLOAD_MAX_BYTES",
        str(50 * 1024 * 1024),
    )
)
# Optional override for the Tesseract binary location (useful in containers)
TESSERACT_PATH = os.environ.get("TESSERACT_PATH", "")

# POST target when a project enters ``in_review`` (moderation bridge)
REVIEW_WEBHOOK_URL = os.environ.get("REVIEW_WEBHOOK_URL", "")

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

# ── Oxigraph / RDF graph store ────────────────────────────────────────────────
# Canonical namespaces must match published ontology and resolvers.
OXIGRAPH_URL = os.environ.get("OXIGRAPH_URL", "http://localhost:7878")
HERITAGE_NAMESPACE = os.environ.get("HERITAGE_NAMESPACE", "https://w3id.org/heritagegraph/")
HERITAGE_RESOURCE_NS = os.environ.get(
    "HERITAGE_RESOURCE_NS",
    "https://w3id.org/heritagegraph/resource/",
)

# RDF_ENDPOINT_URL is the SPARQL UPDATE endpoint used by post_save signals to
# write contributions as triples. Oxigraph exposes updates at `/update` and
# queries at `/query`; older configs that point at a combined `/sparql` still
# work. Leave empty to use the local pyoxigraph file store at
# OXIGRAPH_STORE_PATH (good for laptop dev without the oxigraph container).
RDF_ENDPOINT_URL = os.environ.get("RDF_ENDPOINT_URL", "")
# RDF_QUERY_URL is the SPARQL QUERY endpoint used by SparqlProxyView for reads.
# Falls back to RDF_ENDPOINT_URL (legacy), then to the local file store.
RDF_QUERY_URL = os.environ.get("RDF_QUERY_URL", "")
RDF_RESOURCE_BASE_URI = os.environ.get(
    "RDF_RESOURCE_BASE_URI",
    HERITAGE_RESOURCE_NS,
)
# RDF_SYNC_ENABLED is now ON by default so contribution saves project triples
# without needing manual env setup. When no SPARQL endpoint is configured, the
# signal falls back to writing into the local pyoxigraph store at
# OXIGRAPH_STORE_PATH. Set RDF_SYNC_ENABLED=false to opt out (e.g. tests).
RDF_SYNC_ENABLED = os.environ.get("RDF_SYNC_ENABLED", "true").lower() in {
    "1",
    "true",
    "yes",
    "y",
    "on",
}
# Where the local file Oxigraph store lives when no HTTP endpoint is set.
# Defaults to <BASE_DIR>/oxigraph_db so the path is stable regardless of cwd.
OXIGRAPH_STORE_PATH = os.environ.get(
    "OXIGRAPH_STORE_PATH",
    str(BASE_DIR / "oxigraph_db"),
)
# Published instance triples go into this named graph (empty = default graph only).
RDF_PUBLIC_GRAPH_URI = os.environ.get(
    "RDF_PUBLIC_GRAPH_URI",
    "https://w3id.org/heritagegraph/graph/public",
)
# Optional SHACL gate on contribution projection (uses generated minimal shapes).
RDF_SHACL_VALIDATE_ON_WRITE = os.environ.get(
    "RDF_SHACL_VALIDATE_ON_WRITE", "false"
).lower() in {"1", "true", "yes", "y", "on"}
RDF_SHACL_STRICT_ON_WRITE = os.environ.get("RDF_SHACL_STRICT_ON_WRITE", "false").lower() in {
    "1",
    "true",
    "yes",
    "y",
    "on",
}
RDF_SHACL_FAIL_OPEN_ON_ERROR = os.environ.get(
    "RDF_SHACL_FAIL_OPEN_ON_ERROR", "true"
).lower() in {"1", "true", "yes", "y", "on"}
RDF_SCHEMA_GRAPH_URI = os.environ.get(
    "RDF_SCHEMA_GRAPH_URI",
    "https://w3id.org/heritagegraph/graph/schema",
)
RDF_DOCUMENT_GRAPH_BASE_URI = os.environ.get(
    "RDF_DOCUMENT_GRAPH_BASE_URI",
    "https://w3id.org/heritagegraph/graph/document",
)
RDF_PROVENANCE_GRAPH_BASE_URI = os.environ.get(
    "RDF_PROVENANCE_GRAPH_BASE_URI",
    "https://w3id.org/heritagegraph/graph/prov",
)
# Promote OCR/agent auto-accepted triples into the public graph.
RDF_KG_PROMOTE_ON_AUTO_ACCEPT = os.environ.get(
    "RDF_KG_PROMOTE_ON_AUTO_ACCEPT", "true"
).lower() in {"1", "true", "yes", "y", "on"}
# Enqueue failed Oxigraph writes for ``manage.py rdf_drain_outbox``.
RDF_KG_OUTBOX_ENABLED = os.environ.get("RDF_KG_OUTBOX_ENABLED", "true").lower() in {
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
