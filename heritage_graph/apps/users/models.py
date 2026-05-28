import uuid

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=50, unique=True, blank=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def _unique_username(self, base):
        username = base
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base}{counter}"
            counter += 1
        return username

    def save(self, *args, **kwargs):
        if not self.username and self.email:
            base = self.email.split("@")[0]
            self.username = self._unique_username(base)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def get_short_name(self):
        return self.first_name or self.email


class AuthEvent(models.Model):
    """Append-only audit trail for authentication attempts (no secrets stored)."""

    EVENT_LOGIN_SUCCESS = "login_success"
    EVENT_LOGIN_FAILURE = "login_failure"
    EVENT_TOKEN_REFRESH = "token_refresh"
    EVENT_LOGOUT = "logout"

    EVENT_TYPE_CHOICES = [
        (EVENT_LOGIN_SUCCESS, "Login success"),
        (EVENT_LOGIN_FAILURE, "Login failure"),
        (EVENT_TOKEN_REFRESH, "Token refresh"),
        (EVENT_LOGOUT, "Logout"),
    ]

    PROVIDER_GOOGLE = "google"
    PROVIDER_GITHUB = "github"
    PROVIDER_JWT = "jwt"
    PROVIDER_DEV = "dev"

    PROVIDER_CHOICES = [
        (PROVIDER_GOOGLE, "Google"),
        (PROVIDER_GITHUB, "GitHub"),
        (PROVIDER_JWT, "JWT"),
        (PROVIDER_DEV, "Dev"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=32, choices=EVENT_TYPE_CHOICES)
    provider = models.CharField(max_length=16, choices=PROVIDER_CHOICES)
    email = models.EmailField(blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default="")
    failure_reason = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "users_auth_event"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["email", "-created_at"]),
            models.Index(fields=["ip_address", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.event_type} ({self.provider}) {self.email or '—'}"

