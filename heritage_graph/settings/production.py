import os
from pathlib import Path
from dotenv import load_dotenv

from .base import *  # noqa: F403

# Load .env file from project root
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

# print("=========================================================")
# print("Loading production settings...")
# print(f"BASE_DIR: {BASE_DIR}")

# print("DB_HOST:", os.environ.get("DB_HOST"))
# print("DB_USER:", os.environ.get("DB_USER"))
# print("DB_PASSWORD:", os.environ.get("DB_PASSWORD"))

# print("=========================================================")


# SECURITY
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "fallback-key")
DEBUG = True
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost").split(",")  # e.g., "localhost,example.com"

# DATABASE
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME", "appdb"),
        "USER": os.environ.get("DB_USER", "appuser"),
        "PASSWORD": os.environ.get("DB_PASSWORD", "supersecret123"),
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT", "5432"),
    }
}

# SECURITY MIDDLEWARE SETTINGS
# SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", 3600))
# SECURE_HSTS_INCLUDE_SUBDOMAINS = os.environ.get("SECURE_HSTS_INCLUDE_SUBDOMAINS", "True") == "True"
# SECURE_HSTS_PRELOAD = os.environ.get("SECURE_HSTS_PRELOAD", "True") == "True"
# SECURE_SSL_REDIRECT = os.environ.get("SECURE_SSL_REDIRECT", "True") == "True"
# SESSION_COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", "True") == "True"
# CSRF_COOKIE_SECURE = os.environ.get("CSRF_COOKIE_SECURE", "True") == "True"

# EMAIL
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend"
)
EMAIL_HOST = os.environ.get("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", 25))
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "False") == "True"
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
