from django.apps import AppConfig


class CidocDataConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.cidoc_data"

    def ready(self):
        import apps.cidoc_data.signals
        from apps.cidoc_data import rdf_signals

        rdf_signals.connect_signals()
