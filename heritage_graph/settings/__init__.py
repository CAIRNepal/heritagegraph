import os

env = os.getenv("DJANGO_ENV", "development")
if env == "production":
    from .production import *  # noqa: F403
else:
    from .development import *  # noqa: F403
