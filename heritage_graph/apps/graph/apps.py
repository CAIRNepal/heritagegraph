from django.apps import AppConfig


class GraphConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.graph"
    verbose_name = "Graph / RDF Sync"

    def ready(self) -> None:
        import apps.graph.models  # noqa: F401

