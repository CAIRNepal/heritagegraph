from django.apps import AppConfig


class HeritageDataConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'heritage_data'

    def ready(self):
        import heritage_data.signals