"""
Celery application initialization.

This module must NOT be named `celery.py` because it can shadow the `celery`
distribution on Python's import path (breaking `from celery import ...`).

Configuration is loaded from Django settings (CELERY_* variables).
"""

import os

from celery import Celery

# Set the default Django settings module
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "heritage_graph.settings.production")

app = Celery("heritage_graph")

# Load configuration from Django settings
# Namespace='CELERY' means all celery-related config keys should have that prefix
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks from all registered Django apps
app.autodiscover_tasks()


@app.task(bind=True)
def debug_task(self):
    """Simple debug task for testing Celery setup."""
    print(f"Request: {self.request!r}")
