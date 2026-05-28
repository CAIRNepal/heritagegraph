"""Scoped API throttles for contributor project endpoints."""

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class ProjectCreateThrottle(UserRateThrottle):
    scope = "project_create"


class ProjectAssetUploadThrottle(UserRateThrottle):
    scope = "project_asset_upload"


class TokenObtainThrottle(AnonRateThrottle):
    scope = "token_obtain"


class TokenRefreshThrottle(AnonRateThrottle):
    scope = "token_obtain"


class RegisterThrottle(AnonRateThrottle):
    scope = "register"


class DevLoginThrottle(AnonRateThrottle):
    scope = "dev_login"
