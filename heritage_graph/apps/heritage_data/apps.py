from django.apps import AppConfig


class HeritageDataConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.heritage_data"

    def ready(self):
        from . import signals  # noqa: F401
