"""DRF pagination tuned for knowledge tables."""

from rest_framework.pagination import LimitOffsetPagination


class HeritageLimitOffsetPagination(LimitOffsetPagination):
    default_limit = 20
    max_limit = 100
