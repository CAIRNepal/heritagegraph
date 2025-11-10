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
