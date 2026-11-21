from apps.graph.partner_views import PartnerInstitutionViewSet
from apps.graph.sparql_proxy import CARESparqlProxyView
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
    path("sparql/", CARESparqlProxyView.as_view(), name="graph-sparql-proxy"),
]
