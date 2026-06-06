from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.graph.partner_views import PartnerInstitutionViewSet

router = DefaultRouter()
router.register(
    r"partner-institutions",
    PartnerInstitutionViewSet,
    basename="partner-institution",
)

urlpatterns = [
    path("", include(router.urls)),
]
