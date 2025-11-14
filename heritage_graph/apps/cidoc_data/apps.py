from django.apps import AppConfig


class CidocDataConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.cidoc_data"

    # def ready(self):
    #     import apps.cidoc_data.signals
