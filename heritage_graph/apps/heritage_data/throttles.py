"""Scoped API throttles for contributor project endpoints."""

from rest_framework.throttling import UserRateThrottle


class ProjectCreateThrottle(UserRateThrottle):
    scope = "project_create"


class ProjectAssetUploadThrottle(UserRateThrottle):
    scope = "project_asset_upload"
