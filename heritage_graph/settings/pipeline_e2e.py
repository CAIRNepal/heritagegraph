"""
Settings for KG pipeline E2E tests inside Docker.

Uses development config (no django.contrib.gis / GDAL) with PostgreSQL from env.
"""

import os

from .development import *  # noqa: F403

DATABASES = {
    "default": {
        "ENGINE": os.environ.get("DB_ENGINE", "django.db.backends.postgresql"),
        "NAME": os.environ.get("DB_NAME", "heritage_db"),
        "USER": os.environ.get("DB_USER", "heritage_user"),
        "PASSWORD": os.environ.get("DB_PASSWORD", "changeme"),
        "HOST": os.environ.get("DB_HOST", "postgres"),
        "PORT": os.environ.get("DB_PORT", "5432"),
    }
}

CELERY_TASK_ALWAYS_EAGER = True

# base.py only defines staticfiles; media uploads need default storage
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
        "OPTIONS": {"location": str(BASE_DIR / "media")},  # noqa: F405
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}
