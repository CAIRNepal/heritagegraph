"""
HeritageGraph Django package initialization.

Initialize Celery app on startup.
"""

# Ensure Celery app is loaded when Django starts
from .celery import app as celery_app

__all__ = ('celery_app',)
