from apps.graph.partner_views import PartnerInstitutionViewSet
from django.urls import include, path
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(
    r"partner-institutions",
    PartnerInstitutionViewSet,
    basename="partner-institution",
)

urlpatterns = [
    path("", include(router.urls)),
]
