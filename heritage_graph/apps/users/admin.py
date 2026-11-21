from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import AuthEvent, User


@admin.register(AuthEvent)
class AuthEventAdmin(admin.ModelAdmin):
    list_display = (
        "created_at",
        "event_type",
        "provider",
        "email",
        "ip_address",
        "failure_reason",
    )
    list_filter = ("event_type", "provider", "created_at")
    search_fields = ("email", "ip_address", "failure_reason")
    readonly_fields = (
        "id",
        "event_type",
        "provider",
        "email",
        "ip_address",
        "user_agent",
        "failure_reason",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("email",)
    list_display = ("email", "username", "is_staff", "is_active", "created_at")
    search_fields = ("email", "username")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("username",)}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "created_at")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "password1", "password2")}),
    )

    readonly_fields = ("created_at",)
    filter_horizontal = ("groups", "user_permissions")

