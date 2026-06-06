import json
import os
import re

from apps.heritage_data.permissions import IsExpertCurator, IsReviewerOrAdmin
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
from django.utils.cache import patch_cache_control
from rest_framework import permissions, viewsets
from rest_framework import status as drf_status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from . import identity_services

User = get_user_model()
from .cidoc_registry_keys import registry_class_key_for_model
from .models import *
from .registry_validation import coerce_for_jsonschema, validate_payload_for_class_drf
from .serializers import *

_REGISTRY_VALIDATION_STRIP = frozenset(
    {"assertion", "assertions", "cultural_entity_id"}
)


# =====================================================================
# CONTRIBUTION MIXIN — hooks CIDOC creates into the review workflow
# =====================================================================


def _get_category_for_model(model_class):
    """Map a CIDOC model class to a CulturalEntity category."""
    mapping = {
        "Person": "other",
        "Location": "other",
        "Event": "other",
        "HistoricalPeriod": "other",
        "Tradition": "tradition",
        "Source": "document",
        "Deity": "other",
        "Guthi": "tradition",
        "ArchitecturalStructure": "monument",
        "RitualEvent": "ritual",
        "Festival": "festival",
        "Production": "production",
        "Consecration": "consecration",
        "Enshrinement": "enshrinement",
        "TransferOfCustody": "transfer_of_custody",
        "IconographicObject": "artifact",
        "Monument": "monument",
        "KumariTenure": "ritual",
        "KumariSelection": "ritual",
        "KumariRetirement": "ritual",
        "SyncreticRelationship": "other",
        "CasteGroup": "other",
        "CalendarSystem": "other",
    }
    return mapping.get(model_class.__name__, "other")


class ContributionFlowMixin:
    """
    Mixin for CIDOC ViewSets that hooks every create into the
    CulturalEntity → Notification → Review queue workflow.

    On POST (create):
      1. Requires authentication
      2. Sets contributor = username, status = pending_review
      3. Creates a CulturalEntity wrapper in heritage_data
      4. Creates a first Revision with the submitted data as JSON
      5. Fires notifications to the contributor and all active reviewers

    Validates create/update payloads against ``registry_jsonschema`` when a
    registry class key exists for the model (see ``cidoc_registry_keys``).
    """

    def _payload_for_registry_validation(self, serializer, *, instance=None):
        """Build a dict of model field values suitable for JSON Schema validation."""
        model = getattr(serializer.Meta, "model", None) or self.queryset.model
        out: dict = {}
        for k, v in serializer.validated_data.items():
            if k in _REGISTRY_VALIDATION_STRIP:
                continue
            out[k] = coerce_for_jsonschema(v)
        if instance is not None:
            for field in model._meta.concrete_fields:
                name = field.name
                if name in out or name == "id":
                    continue
                try:
                    val = getattr(instance, name)
                except Exception:
                    continue
                out[name] = coerce_for_jsonschema(val)
        return out

    def _validate_registry_payload(self, serializer, *, instance=None):
        from apps.cidoc_data.linkml_loader import get_effective_registry_payload

        model = getattr(serializer.Meta, "model", None) or self.queryset.model
        class_key = registry_class_key_for_model(model)
        if not class_key:
            return
        payload = self._payload_for_registry_validation(serializer, instance=instance)
        registry = get_effective_registry_payload()
        validate_payload_for_class_drf(
            class_key=class_key,
            payload=payload,
            registry_jsonschema=registry.get("registry_jsonschema"),
        )

    def get_permissions(self):
        if self.action in ("update", "partial_update", "destroy"):
            from .permissions import CidocObjectEditPermission

            return [
                permissions.IsAuthenticated(),
                CidocObjectEditPermission(),
            ]
        if self.action == "create":
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def perform_update(self, serializer):
        self._validate_registry_payload(serializer, instance=serializer.instance)
        serializer.save()

    def perform_create(self, serializer):
        self._validate_registry_payload(serializer, instance=None)
        # Set contributor info on the CIDOC record
        instance = serializer.save(
            contributor=self.request.user.username,
            status="pending_review",
        )

        # Create a CulturalEntity wrapper for the review queue
        try:
            from apps.heritage_data.models import (
                Activity,
                CulturalEntity,
                Notification,
                Revision,
            )

            entity_name = (
                getattr(instance, "name", None)
                or getattr(instance, "title", "")
                or str(instance)
            )
            entity_description = getattr(instance, "description", "") or ""
            category = _get_category_for_model(instance.__class__)

            entity = CulturalEntity.objects.create(
                name=entity_name,
                description=entity_description,
                category=category,
                status="pending_review",
                contributor=self.request.user,
            )

            # Build revision data from the serialized instance
            revision_data = serializer.data.copy()
            revision_data["_cidoc_model"] = instance.__class__.__name__
            revision_data["_cidoc_id"] = instance.pk

            revision = Revision.objects.create(
                entity=entity,
                data=revision_data,
                revision_number=1,
                created_by=self.request.user,
            )
            entity.current_revision = revision
            entity.save(update_fields=["current_revision"])

            Activity.objects.create(
                entity=entity,
                user=self.request.user,
                activity_type="submitted",
                comment=f'Submitted "{entity_name}" via {instance.__class__.__name__} form',
            )

            # Determine where the user should land when clicking this notification.
            # For CIDOC "Source", we route directly to the source details page rather than
            # the generic CulturalEntity wrapper page.
            contributor_link = f"/knowledge/entity/view/{entity.entity_id}"
            if instance.__class__.__name__ == "Source":
                contributor_link = f"/knowledge/source/view/{instance.pk}"

            Notification.objects.create(
                user=self.request.user,
                actor=self.request.user,
                notification_type="submission_update",
                message=f'Your contribution "{entity_name}" has been submitted and is pending review.',
                entity=entity,
                link=contributor_link,
            )

            reviewer_users = User.objects.filter(
                reviewer_role__is_active=True,
            ).exclude(id=self.request.user.id)
            for reviewer in reviewer_users:
                Notification.objects.create(
                    user=reviewer,
                    actor=self.request.user,
                    notification_type="submission_update",
                    message=f'New contribution "{entity_name}" submitted by {self.request.user.username} — awaiting review.',
                    entity=entity,
                    link=f"/curation/review/{entity.entity_id}",
                )

        except Exception as e:
            # Log but don't fail the CIDOC save — the data is still persisted
            import logging

            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to create CulturalEntity wrapper: {e}")


#################################################################
## CIDOC_DATA — all ViewSets now use ContributionFlowMixin
#################################################################
class PersonViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Person.objects.all()
    serializer_class = PersonSerializer
    search_fields = ["name", "aliases", "occupation"]


class LocationViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    search_fields = ["name", "description"]


class EventViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    search_fields = ["name", "description"]


class HistoricalPeriodViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = HistoricalPeriod.objects.all()
    serializer_class = HistoricalPeriodSerializer
    search_fields = ["name", "description"]


class TraditionViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Tradition.objects.all()
    serializer_class = TraditionSerializer
    search_fields = ["name", "description"]


class SourceViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Source.objects.all()
    serializer_class = SourceSerializer
    search_fields = ["title", "authors"]


# =====================================================================
# NEW ONTOLOGY-DRIVEN VIEWSETS
# =====================================================================


class DeityViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Deity.objects.all()
    serializer_class = DeitySerializer
    search_fields = ["name", "alternate_names", "religious_tradition"]


class GuthiViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Guthi.objects.all()
    serializer_class = GuthiSerializer
    search_fields = ["name", "location"]


class ArchitecturalStructureViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = ArchitecturalStructure.objects.all()
    serializer_class = ArchitecturalStructureSerializer
    search_fields = ["name", "location_name"]


class RitualEventViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = RitualEvent.objects.all()
    serializer_class = RitualEventSerializer
    search_fields = ["name", "location_name", "performed_by"]


class FestivalViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Festival.objects.all()
    serializer_class = FestivalSerializer
    search_fields = ["name", "location_name"]


class ProductionViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Production.objects.all()
    serializer_class = ProductionSerializer
    search_fields = ["name", "carried_out_by"]


class ConsecrationViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Consecration.objects.all()
    serializer_class = ConsecrationSerializer
    search_fields = ["name", "makes_deity_present"]


class EnshrinementViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Enshrinement.objects.all()
    serializer_class = EnshrinementSerializer
    search_fields = ["name"]


class TransferOfCustodyViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = TransferOfCustody.objects.all()
    serializer_class = TransferOfCustodySerializer
    search_fields = ["name", "transferred_from_actor", "transferred_to_actor"]


class IconographicObjectViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = IconographicObject.objects.all()
    serializer_class = IconographicObjectSerializer
    search_fields = ["name", "depicts_deity"]


class MonumentViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Monument.objects.all()
    serializer_class = MonumentSerializer
    search_fields = ["name", "location_name"]


class KumariTenureViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = KumariTenure.objects.all()
    serializer_class = KumariTenureSerializer
    search_fields = ["name", "had_participant"]


class KumariSelectionViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = KumariSelection.objects.all()
    serializer_class = KumariSelectionSerializer
    search_fields = ["name", "selected_person"]


class KumariRetirementViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = KumariRetirement.objects.all()
    serializer_class = KumariRetirementSerializer
    search_fields = ["name"]


class SyncreticRelationshipViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = SyncreticRelationship.objects.all()
    serializer_class = SyncreticRelationshipSerializer
    search_fields = ["name", "assigned_to_deity"]


class CasteGroupViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = CasteGroup.objects.all()
    serializer_class = CasteGroupSerializer
    search_fields = ["name", "traditional_role"]


class CalendarSystemViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = CalendarSystem.objects.all()
    serializer_class = CalendarSystemSerializer
    search_fields = ["name"]


class PersonRevisionViewSet(viewsets.ModelViewSet):
    queryset = PersonRevision.objects.all()
    serializer_class = PersonRevisionSerializer


# =====================================================================
# PROVENANCE VIEWSETS
# =====================================================================


class DataSourceViewSet(viewsets.ModelViewSet):
    queryset = DataSource.objects.all()
    serializer_class = DataSourceSerializer
    search_fields = ["name", "author", "citation"]


class RelationshipPredicateViewSet(viewsets.ReadOnlyModelViewSet):
    """Controlled vocabulary for relationship proposals (007)."""

    queryset = RelationshipPredicate.objects.filter(active=True).order_by(
        "sort_order", "label"
    )
    serializer_class = RelationshipPredicateSerializer
    permission_classes = [permissions.AllowAny]


class HeritageAssertionViewSet(viewsets.ModelViewSet):
    queryset = HeritageAssertion.objects.all()
    serializer_class = HeritageAssertionSerializer

    def get_permissions(self):
        if self.action == "create":
            return [permissions.IsAuthenticated()]
        if self.action in ("update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsReviewerOrAdmin()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        extra = {}
        if self.request.user.is_authenticated:
            extra["contributed_by"] = (
                self.request.user.email or self.request.user.username
            )
        serializer.save(**extra)

    def get_queryset(self):
        qs = super().get_queryset().select_related(
            "source",
            "entity_cluster",
            "content_type",
        )
        # Filter by entity type and ID
        entity_type = self.request.query_params.get("entity_type")
        entity_id = self.request.query_params.get("entity_id")
        status = self.request.query_params.get("status")
        cultural_entity_id = (
            self.request.query_params.get("cultural_entity_id") or ""
        ).strip()

        if entity_type:
            from django.contrib.contenttypes.models import ContentType

            try:
                ct = ContentType.objects.get(model=entity_type)
                qs = qs.filter(content_type=ct)
            except ContentType.DoesNotExist:
                pass

        if entity_id:
            qs = qs.filter(object_id=entity_id)

        if cultural_entity_id:
            qs = qs.filter(
                assertion_content__icontains=f"cultural_entity_id={cultural_entity_id}"
            )

        if status:
            qs = qs.filter(reconciliation_status=status)

        asserted_property = self.request.query_params.get("asserted_property")
        if asserted_property:
            qs = qs.filter(asserted_property=asserted_property)

        entity_cluster = self.request.query_params.get("entity_cluster")
        if entity_cluster:
            qs = qs.filter(entity_cluster_id=entity_cluster)

        ic = (self.request.query_params.get("identity_conflict") or "").lower()
        if ic in ("true", "1", "yes"):
            ids = identity_services.conflicting_subject_assertion_ids()
            if not ids:
                qs = qs.none()
            else:
                qs = qs.filter(id__in=ids)

        return qs


def _version_conflict_response(exc: DRFValidationError) -> Response | None:
    if isinstance(exc.detail, dict) and "expected_version" in exc.detail:
        return Response(exc.detail, status=drf_status.HTTP_409_CONFLICT)
    return None


class EntityClusterViewSet(viewsets.ModelViewSet):
    """
    Identity cluster anchors (specs/005-identity-layer).

    - Reads: public (AllowAny), consistent with other discovery-oriented CIDOC lists.
    - Create: reviewers (form or join clusters for same-referent workflow).
    - Update / delete: expert curators / staff (moderation).
    """

    queryset = EntityCluster.objects.all()
    serializer_class = EntityClusterSerializer
    search_fields = ["canonical_label", "type_scope"]

    def get_queryset(self):
        qs = super().get_queryset()
        ts = self.request.query_params.get("type_scope")
        if ts:
            qs = qs.filter(type_scope=ts)
        locked = self.request.query_params.get("locked")
        if locked is not None and locked != "":
            qs = qs.filter(locked=str(locked).lower() in ("1", "true", "yes"))
        return qs

    def get_permissions(self):
        if self.action in (
            "list",
            "retrieve",
            "members",
            "audit",
        ):
            return [permissions.AllowAny()]
        if self.action == "create":
            return [permissions.IsAuthenticated(), IsReviewerOrAdmin()]
        if self.action in (
            "update",
            "partial_update",
            "destroy",
            "merge",
            "split",
            "lock",
            "unlock",
        ):
            return [permissions.IsAuthenticated(), IsExpertCurator()]
        if self.action in ("suggest_duplicates", "suggest_external"):
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]

    @action(
        detail=True,
        methods=["get"],
        url_path="suggest-external",
        permission_classes=[permissions.IsAuthenticated],
    )
    def suggest_external(self, request, pk=None):
        """Wikidata / GeoNames reconciliation suggestions for this cluster."""
        from apps.graph.reconciliation.service import suggest_for_cluster

        cluster = self.get_object()
        suggestions = suggest_for_cluster(
            canonical_label=cluster.canonical_label,
            type_scope=cluster.type_scope,
        )
        return Response(
            {
                "cluster_id": str(cluster.id),
                "canonical_label": cluster.canonical_label,
                "type_scope": cluster.type_scope,
                "suggestions": suggestions,
            }
        )

    @action(
        detail=False,
        methods=["get"],
        url_path="suggest-duplicates",
        permission_classes=[permissions.IsAuthenticated],
    )
    def suggest_duplicates(self, request):
        """Substring match on canonical_label for contributor duplicate hints (007)."""
        q = (request.query_params.get("q") or "").strip()
        type_scope = (request.query_params.get("type_scope") or "").strip().lower()
        if len(q) < 2:
            return Response({"results": []})
        qs = EntityCluster.objects.filter(merged_into__isnull=True).filter(
            canonical_label__icontains=q
        )
        if type_scope:
            qs = qs.filter(type_scope=type_scope)
        qs = qs.order_by("canonical_label")[:20]
        results = [
            {
                "id": str(c.id),
                "canonical_label": c.canonical_label,
                "type_scope": c.type_scope,
                "curated_aliases": c.curated_aliases or [],
                "external_identifiers": c.external_identifiers or {},
            }
            for c in qs
        ]
        return Response({"results": results})

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "Clusters are retired via merge, not hard-deleted."},
            status=drf_status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="merge",
        permission_classes=[permissions.IsAuthenticated, IsExpertCurator],
    )
    def merge(self, request, pk=None):
        target = self.get_object()
        ser = MergeClusterRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            source = EntityCluster.objects.get(pk=ser.validated_data["source_cluster_id"])
        except EntityCluster.DoesNotExist:
            return Response(
                {"detail": "Source cluster not found."},
                status=drf_status.HTTP_404_NOT_FOUND,
            )
        try:
            identity_services.merge_clusters(
                actor=request.user,
                target=target,
                source=source,
                reason=ser.validated_data.get("reason") or "",
                expected_version=ser.validated_data["expected_version"],
                lock_override=ser.validated_data.get("lock_override") or False,
                is_expert_curator=IsExpertCurator().has_permission(
                    request,
                    self,
                ),
            )
        except DRFValidationError as e:
            r = _version_conflict_response(e)
            if r:
                return r
            raise
        except PermissionDenied as e:
            return Response({"detail": str(e)}, status=drf_status.HTTP_403_FORBIDDEN)
        target.refresh_from_db()
        return Response(EntityClusterSerializer(target).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="split",
        permission_classes=[permissions.IsAuthenticated, IsExpertCurator],
    )
    def split(self, request, pk=None):
        cluster = self.get_object()
        ser = SplitClusterRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            new_clusters, ev = identity_services.split_cluster_by_groups(
                actor=request.user,
                cluster=cluster,
                reason=ser.validated_data.get("reason") or "",
                expected_version=ser.validated_data["expected_version"],
                groups=ser.validated_data["groups"],
            )
        except DRFValidationError as e:
            r = _version_conflict_response(e)
            if r:
                return r
            raise
        except PermissionDenied as e:
            return Response({"detail": str(e)}, status=drf_status.HTTP_403_FORBIDDEN)
        return Response(
            {
                "new_cluster_ids": [str(c.id) for c in new_clusters],
                "audit_event_id": str(ev.id),
            }
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="lock",
        permission_classes=[permissions.IsAuthenticated, IsExpertCurator],
    )
    def lock(self, request, pk=None):
        cluster = self.get_object()
        ser = LockClusterBodySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            identity_services.lock_cluster(
                actor=request.user,
                cluster=cluster,
                reason=ser.validated_data.get("reason") or "",
                expected_version=ser.validated_data["expected_version"],
            )
        except DRFValidationError as e:
            r = _version_conflict_response(e)
            if r:
                return r
            raise
        cluster.refresh_from_db()
        return Response(EntityClusterSerializer(cluster).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="unlock",
        permission_classes=[permissions.IsAuthenticated, IsExpertCurator],
    )
    def unlock(self, request, pk=None):
        cluster = self.get_object()
        ser = LockClusterBodySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            identity_services.unlock_cluster(
                actor=request.user,
                cluster=cluster,
                reason=ser.validated_data.get("reason") or "",
                expected_version=ser.validated_data["expected_version"],
            )
        except DRFValidationError as e:
            r = _version_conflict_response(e)
            if r:
                return r
            raise
        cluster.refresh_from_db()
        return Response(EntityClusterSerializer(cluster).data)

    @action(
        detail=True,
        methods=["get"],
        url_path="conflict-check",
        permission_classes=[permissions.IsAuthenticated],
    )
    def conflict_check(self, request, pk=None):
        """
        Pre-flight conflict check before submitting a merge.

        GET /cidoc/entity-clusters/{id}/conflict-check/?source_cluster_id=<uuid>

        Returns:
            {"conflicts": [...], "can_merge": bool}
        """
        source_id = request.query_params.get("source_cluster_id")
        if not source_id:
            return Response(
                {"detail": "source_cluster_id query param is required."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        try:
            source = EntityCluster.objects.get(pk=source_id)
        except EntityCluster.DoesNotExist:
            return Response(
                {"detail": f"Cluster {source_id!r} not found."},
                status=drf_status.HTTP_404_NOT_FOUND,
            )
        target = self.get_object()
        conflicts = identity_services.detect_merge_conflict(target, source)
        return Response({"conflicts": conflicts, "can_merge": len(conflicts) == 0})

    @action(
        detail=True,
        methods=["get"],
        url_path="members",
        permission_classes=[permissions.AllowAny],
    )
    def members(self, request, pk=None):
        cluster = self.get_object()
        return Response(
            {
                "cluster_id": str(cluster.id),
                "members": identity_services.cluster_members_payload(cluster),
            }
        )

    @action(
        detail=True,
        methods=["get"],
        url_path="audit",
        permission_classes=[permissions.AllowAny],
    )
    def audit(self, request, pk=None):
        cluster = self.get_object()
        cid = str(cluster.id)
        audit_q = Q(related_cluster_id=cluster.id) | Q(
            affected_cluster_ids__icontains=cid
        )
        qs = ClusterAuditEvent.objects.filter(audit_q).order_by("-created_at")[:200]
        return Response({"results": ClusterAuditEventSerializer(qs, many=True).data})


class EntityIdentitySummaryView(APIView):
    """GET identity summary for a subject entity (knowledge UI)."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        entity_type = (request.query_params.get("entity_type") or "").strip()
        entity_id = request.query_params.get("entity_id")
        if not entity_type or entity_id is None:
            return Response(
                {"detail": "entity_type and entity_id are required."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        try:
            oid = int(entity_id)
        except (TypeError, ValueError):
            return Response(
                {"detail": "entity_id must be an integer."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        try:
            ct = ContentType.objects.get(model=entity_type)
        except ContentType.DoesNotExist:
            return Response(
                {"detail": f"Unknown entity_type {entity_type!r}."},
                status=drf_status.HTTP_404_NOT_FOUND,
            )
        payload = identity_services.build_identity_summary(ct, oid)
        return Response(payload)


class IdentityCandidateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = IdentityResolutionCandidate.objects.select_related(
        "left_content_type", "right_content_type"
    ).order_by("-created_at")
    serializer_class = IdentityResolutionCandidateSerializer

    def get_permissions(self):
        return [permissions.IsAuthenticated(), IsReviewerOrAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        st = self.request.query_params.get("status")
        if st:
            qs = qs.filter(status=st)
        return qs

    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve(self, request, pk=None):
        candidate = self.get_object()
        ser = ResolveCandidateRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        tid = data.get("target_cluster_id")
        cand, created_ids = identity_services.resolve_identity_candidate(
            actor=request.user,
            candidate=candidate,
            resolution=data["resolution"],
            notes=data.get("notes") or "",
            target_cluster_id=tid,
        )
        return Response(
            {
                "candidate": IdentityResolutionCandidateSerializer(cand).data,
                "created_assertion_ids": [str(x) for x in created_ids],
            }
        )


class AssertionAwareStructureViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    """Structure ViewSet that uses assertion-aware serializer for writes."""

    queryset = ArchitecturalStructure.objects.all()

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return AssertionAwareStructureSerializer
        # For list/retrieve, also return the assertion-aware serializer
        # so assertions are included in the response
        return AssertionAwareStructureSerializer


class AssertionAwareRitualViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    """Ritual ViewSet with assertion support."""

    queryset = RitualEvent.objects.all()

    def get_serializer_class(self):
        return AssertionAwareRitualSerializer


class AssertionAwareDeityViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    """Deity ViewSet with assertion support."""

    queryset = Deity.objects.all()

    def get_serializer_class(self):
        return AssertionAwareDeitySerializer


class AssertionAwareGuthiViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    """Guthi ViewSet with assertion support."""

    queryset = Guthi.objects.all()

    def get_serializer_class(self):
        return AssertionAwareGuthiSerializer


#################################################################

from apps.cidoc_data.models import (
    ArchitecturalStructure,
    Deity,
    Event,
    Festival,
    Guthi,
    Location,
    Monument,
    Person,
    RitualEvent,
    Tradition,
)
from apps.cidoc_data.serializers import (
    ArchitecturalStructureSerializer,
    DeitySerializer,
    EventSerializer,
    FestivalSerializer,
    GuthiSerializer,
    LocationSerializer,
    MonumentSerializer,
    PersonSerializer,
    RitualEventSerializer,
    TraditionSerializer,
    _get_cultural_entity_id,
)
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
def universal_search(request):
    q = request.GET.get("q", "").strip()

    if not q:
        return Response({"error": "Query parameter 'q' is required."}, status=400)

    search_map = {
        "persons": {
            "model": Person,
            "fields": ["name", "aliases", "occupation"],
            "serializer": PersonSerializer,
        },
        "locations": {
            "model": Location,
            "fields": ["name", "description"],
            "serializer": LocationSerializer,
        },
        "events": {
            "model": Event,
            "fields": ["name", "description"],
            "serializer": EventSerializer,
        },
        "traditions": {
            "model": Tradition,
            "fields": ["name", "description"],
            "serializer": TraditionSerializer,
        },
        "deities": {
            "model": Deity,
            "fields": ["name", "alternate_names", "religious_tradition"],
            "serializer": DeitySerializer,
        },
        "guthis": {
            "model": Guthi,
            "fields": ["name", "description"],
            "serializer": GuthiSerializer,
        },
        "structures": {
            "model": ArchitecturalStructure,
            "fields": ["name", "description", "location_name"],
            "serializer": ArchitecturalStructureSerializer,
        },
        "rituals": {
            "model": RitualEvent,
            "fields": ["name", "description"],
            "serializer": RitualEventSerializer,
        },
        "festivals": {
            "model": Festival,
            "fields": ["name", "description"],
            "serializer": FestivalSerializer,
        },
        "monuments": {
            "model": Monument,
            "fields": ["name", "description"],
            "serializer": MonumentSerializer,
        },
    }

    results = {}

    for key, cfg in search_map.items():
        model = cfg["model"]
        serializer_class = cfg["serializer"]
        fields = cfg["fields"]

        # Build OR query across all fields
        q_filter = Q()
        for field in fields:
            q_filter |= Q(**{f"{field}__icontains": q})

        queryset = model.objects.filter(q_filter).distinct()
        results[key] = serializer_class(queryset, many=True).data

    return Response(results)


def _discovery_record_name(instance):
    name = getattr(instance, "name", None)
    if name and str(name).strip():
        return str(name).strip()
    title = getattr(instance, "title", None)
    if title and str(title).strip():
        return str(title).strip()
    return str(instance.pk)


def _discovery_summary(instance):
    for attr in ("description", "biography", "note", "route_description"):
        val = getattr(instance, attr, None)
        if val and str(val).strip():
            s = str(val).strip()
            return f"{s[:277]}…" if len(s) > 280 else s
    return ""


def _discovery_location_hint(instance):
    for attr in ("location_name", "location", "start_place"):
        val = getattr(instance, attr, None)
        if val and str(val).strip():
            return str(val).strip()[:200]
    return ""


def _discovery_is_published(instance):
    raw = (getattr(instance, "status", None) or "").strip().lower()
    if not raw:
        return True
    return raw not in ("pending_review", "draft", "rejected")


def _discovery_row(instance, resource_key):
    return {
        "id": str(instance.pk),
        "resource": resource_key,
        "type": instance.__class__.__name__,
        "name": _discovery_record_name(instance),
        "summary": _discovery_summary(instance),
        "location_hint": _discovery_location_hint(instance),
        "cultural_entity_id": _get_cultural_entity_id(instance),
        "status": (getattr(instance, "status", None) or "").strip(),
        "is_published": _discovery_is_published(instance),
        "has_media": False,
    }


# Maps public landing tabs → model + searchable fields (icontains).
_DISCOVERY_TYPE_MAP = {
    "monuments": (Monument, ["name", "description", "note", "location_name"]),
    "festivals": (
        Festival,
        ["name", "description", "note", "location_name", "route_description"],
    ),
    "deities": (
        Deity,
        ["name", "description", "note", "alternate_names", "religious_tradition"],
    ),
    "persons": (
        Person,
        ["name", "description", "aliases", "occupation", "biography"],
    ),
    "guthis": (
        Guthi,
        ["name", "description", "note", "location", "managed_structures"],
    ),
    "rituals": (
        RitualEvent,
        [
            "name",
            "description",
            "note",
            "location_name",
            "performed_by",
            "route_description",
        ],
    ),
}


def _filtered_discovery_queryset(model, fields, q):
    qs = model.objects.all().order_by("-id")
    q = (q or "").strip()
    if not q:
        return qs
    q_filter = Q()
    for field in fields:
        q_filter |= Q(**{f"{field}__icontains": q})
    return qs.filter(q_filter).distinct()


@api_view(["GET"])
@permission_classes([AllowAny])
def public_discovery(request):
    """
    Public faceted discovery for the marketing site.
    Query params:
      - type: monuments | festivals | deities | persons | guthis | rituals (default persons)
      - q: optional search string (empty = recent records)
    """
    type_key = (request.GET.get("type") or "persons").strip()
    q = request.GET.get("q", "")

    if type_key not in _DISCOVERY_TYPE_MAP:
        return Response(
            {"error": f"Unknown type '{type_key}'."},
            status=400,
        )

    counts = {}
    for key, (model, fields) in _DISCOVERY_TYPE_MAP.items():
        counts[key] = _filtered_discovery_queryset(model, fields, q).count()

    model, fields = _DISCOVERY_TYPE_MAP[type_key]
    qs = _filtered_discovery_queryset(model, fields, q)[:100]
    results = [_discovery_row(obj, type_key) for obj in qs]

    return Response(
        {
            "q": q.strip(),
            "type": type_key,
            "counts": counts,
            "results": results,
        }
    )


def _field_reference_q(field_name: str, entity_id_str: str, multivalued: bool) -> Q:
    """Match stored relation value: exact id or comma-separated list of ids."""
    sid = str(entity_id_str).strip()
    if not sid:
        return Q(pk__in=[])
    if not multivalued:
        return Q(**{field_name: sid})
    q = Q(**{field_name: sid})
    q |= Q(**{f"{field_name}__startswith": f"{sid},"})
    q |= Q(**{f"{field_name}__endswith": f",{sid}"})
    q |= Q(**{f"{field_name}__contains": f",{sid},"})
    return q


def _related_entity_row(instance):
    from apps.cidoc_data.relation_backrefs import (
        MODEL_ONTOLOGY_DOMAIN_KEY,
        REFERRED_GROUP_LABELS,
    )

    domain_key = MODEL_ONTOLOGY_DOMAIN_KEY[instance.__class__]
    return {
        "id": str(instance.pk),
        "domain_key": domain_key,
        "name": _discovery_record_name(instance),
        "summary": _discovery_summary(instance),
        "display_type": REFERRED_GROUP_LABELS.get(
            domain_key,
            instance.__class__.__name__,
        ),
    }


@api_view(["GET"])
@permission_classes([AllowAny])
def related_entities(request):
    """
    Entities that reference the given entity via ontology relation fields (reverse lookup).

    Query params:
      - domain: ontology key of the entity being viewed (e.g. source, deity, person)
      - id: primary key of that entity (string; matches stored relation values)
      - page: page number (default 1), applied per group
      - page_size: max items per group (default 10, max 50)
      - group: optional ontology key of the *referring* type (e.g. syncretism) to
        return only that bucket (for load-more per section)
    """
    from collections import defaultdict

    from apps.cidoc_data.relation_backrefs import (
        CIDOC_RELATION_BACKREFS,
        MODEL_ONTOLOGY_DOMAIN_KEY,
        REFERRED_GROUP_LABELS,
        entityref_reverse_ids_by_referrer_model,
    )

    domain = (request.query_params.get("domain") or "").strip()
    raw_id = (request.query_params.get("id") or "").strip()
    group_filter = (request.query_params.get("group") or "").strip()

    if not domain or not raw_id:
        return Response(
            {"error": "Query parameters 'domain' and 'id' are required."},
            status=drf_status.HTTP_400_BAD_REQUEST,
        )

    valid_referrer_keys = set(MODEL_ONTOLOGY_DOMAIN_KEY.values())
    if group_filter and group_filter not in valid_referrer_keys:
        return Response(
            {"error": f"Unknown group '{group_filter}'."},
            status=drf_status.HTTP_400_BAD_REQUEST,
        )

    try:
        page = int(request.query_params.get("page") or 1)
        page_size = int(request.query_params.get("page_size") or 10)
    except ValueError:
        return Response(
            {"error": "page and page_size must be integers."},
            status=drf_status.HTTP_400_BAD_REQUEST,
        )
    page = max(1, page)
    page_size = min(max(1, page_size), 50)

    entries_by_model = defaultdict(list)
    for model_cls, field_name, multivalued, ref_domain in CIDOC_RELATION_BACKREFS:
        if ref_domain != domain:
            continue
        entries_by_model[model_cls].append((field_name, multivalued))

    er_by_model = entityref_reverse_ids_by_referrer_model(domain=domain, raw_id=raw_id)
    combined_models = sorted(
        set(entries_by_model.keys()) | set(er_by_model.keys()),
        key=lambda m: MODEL_ONTOLOGY_DOMAIN_KEY[m],
    )

    groups_out = []
    total_related = 0

    for model_cls in combined_models:
        domain_key = MODEL_ONTOLOGY_DOMAIN_KEY[model_cls]
        if group_filter and domain_key != group_filter:
            continue

        q_parts: list[Q] = []
        for field_name, multivalued in entries_by_model.get(model_cls, []):
            q_parts.append(_field_reference_q(field_name, raw_id, multivalued))
        extra_ids = er_by_model.get(model_cls) or []
        if extra_ids:
            q_parts.append(Q(pk__in=extra_ids))
        if not q_parts:
            continue
        q_total = q_parts[0]
        for q in q_parts[1:]:
            q_total |= q

        qs = model_cls.objects.filter(q_total).order_by("-id")
        total = qs.count()
        total_related += total
        start = (page - 1) * page_size
        slice_qs = qs[start : start + page_size]
        rows = [_related_entity_row(obj) for obj in slice_qs]
        groups_out.append(
            {
                "domain_key": domain_key,
                "display_type": REFERRED_GROUP_LABELS.get(
                    domain_key,
                    model_cls.__name__,
                ),
                "count": total,
                "page": page,
                "page_size": page_size,
                "has_more": start + page_size < total,
                "results": rows,
            }
        )

    return Response(
        {
            "domain": domain,
            "entity_id": raw_id,
            "page": page,
            "page_size": page_size,
            "group": group_filter or None,
            "total_related": total_related,
            "groups": groups_out,
        }
    )


###############################################################


# --- User ViewSet ---
# class UserViewSet(viewsets.ModelViewSet):
#     queryset = User.objects.all()
#     serializer_class = UserSerializer

# --- Main models ViewSets ---


# class ArtifactViewSet(viewsets.ModelViewSet):
#     queryset = Artifact.objects.all()
#     serializer_class = ArtifactSerializer


# # --- Revision ViewSets ---
# class HistoricalPeriodRevisionViewSet(viewsets.ModelViewSet):
#     queryset = HistoricalPeriodRevision.objects.all()
#     serializer_class = HistoricalPeriodRevisionSerializer

# class LocationRevisionViewSet(viewsets.ModelViewSet):
#     queryset = LocationRevision.objects.all()
#     serializer_class = LocationRevisionSerializer


# class ArtifactRevisionViewSet(viewsets.ModelViewSet):
#     queryset = ArtifactRevision.objects.all()
#     serializer_class = ArtifactRevisionSerializer

# class EventRevisionViewSet(viewsets.ModelViewSet):
#     queryset = EventRevision.objects.all()
#     serializer_class = EventRevisionSerializer

# class TraditionRevisionViewSet(viewsets.ModelViewSet):
#     queryset = TraditionRevision.objects.all()
#     serializer_class = TraditionRevisionSerializer

# class SourceRevisionViewSet(viewsets.ModelViewSet):
#     queryset = SourceRevision.objects.all()
#     serializer_class = SourceRevisionSerializer

# # --- Activity and Comment ViewSets ---
# class ActivityViewSet(viewsets.ModelViewSet):
#     queryset = Activity.objects.all()
#     serializer_class = ActivitySerializer

# # Generate generic comment viewsets
# def create_comment_viewset(model, serializer):
#     class CommentViewSet(viewsets.ModelViewSet):
#         queryset = model.objects.all()
#         serializer_class = serializer
#     return CommentViewSet

# HistoricalPeriodCommentViewSet = create_comment_viewset(HistoricalPeriodComment, HistoricalPeriodCommentSerializer)
# LocationCommentViewSet = create_comment_viewset(LocationComment, LocationCommentSerializer)
# PersonCommentViewSet = create_comment_viewset(PersonComment, PersonCommentSerializer)
# ArtifactCommentViewSet = create_comment_viewset(ArtifactComment, ArtifactCommentSerializer)
# EventCommentViewSet = create_comment_viewset(EventComment, EventCommentSerializer)
# TraditionCommentViewSet = create_comment_viewset(TraditionComment, TraditionCommentSerializer)
# SourceCommentViewSet = create_comment_viewset(SourceComment, SourceCommentSerializer)

# HistoricalPeriodRevisionCommentViewSet = create_comment_viewset(HistoricalPeriodRevisionComment, HistoricalPeriodRevisionCommentSerializer)
# LocationRevisionCommentViewSet = create_comment_viewset(LocationRevisionComment, LocationRevisionCommentSerializer)
# PersonRevisionCommentViewSet = create_comment_viewset(PersonRevisionComment, PersonRevisionCommentSerializer)
# ArtifactRevisionCommentViewSet = create_comment_viewset(ArtifactRevisionComment, ArtifactRevisionCommentSerializer)
# EventRevisionCommentViewSet = create_comment_viewset(EventRevisionComment, EventRevisionCommentSerializer)
# TraditionRevisionCommentViewSet = create_comment_viewset(TraditionRevisionComment, TraditionRevisionCommentSerializer)
# SourceRevisionCommentViewSet = create_comment_viewset(SourceRevisionComment, SourceRevisionCommentSerializer)

# # --- Notification ViewSet ---
# class NotificationForUserViewSet(viewsets.ModelViewSet):
#     queryset = NotificationForUser.objects.all()
#     serializer_class = NotificationForUserSerializer


class OntologySchemaRegistryView(APIView):
    """
    Effective ontology registry (classes + enums) for schema-driven UI.
    GET /api/v1/cidoc/schema/registry/

    Public read: no authentication required (same payload is shipped in
    registry.generated.*; optional Bearer is accepted but not required).
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        from apps.cidoc_data.linkml_loader import get_effective_registry_payload
        from apps.cidoc_data.models import SchemaRegistry

        prefer_fresh = (
            request.query_params.get("fresh") == "1"
            or getattr(settings, "DEBUG", False)
            or getattr(settings, "HERITAGEGRAPH_SCHEMA_REGISTRY_PREFER_FRESH", False)
            or os.environ.get("HERITAGEGRAPH_SCHEMA_REGISTRY_PREFER_FRESH", "").lower()
            in ("1", "true", "yes")
        )

        payload: dict
        source = "cache"
        if prefer_fresh:
            try:
                payload = dict(get_effective_registry_payload(tenant=None))
                source = "yaml"
            except Exception:
                row = SchemaRegistry.objects.order_by("-created_at").first()
                if row and row.registry_json:
                    payload = dict(row.registry_json)
                    source = "cache"
                else:
                    return Response(
                        {
                            "error": "Schema unavailable and no last-known-good cache exists."
                        },
                        status=drf_status.HTTP_503_SERVICE_UNAVAILABLE,
                    )
        else:
            row = SchemaRegistry.objects.order_by("-created_at").first()
            if row and row.registry_json:
                payload = dict(row.registry_json)
                source = "cache"
            else:
                try:
                    payload = dict(get_effective_registry_payload(tenant=None))
                    source = "yaml"
                except Exception:
                    return Response(
                        {
                            "error": "Schema unavailable and no last-known-good cache exists."
                        },
                        status=drf_status.HTTP_503_SERVICE_UNAVAILABLE,
                    )
        version = payload["schema_version"]
        etag = f'"{version}"'
        inm = request.headers.get("If-None-Match")
        if inm and inm == etag:
            resp = Response(status=304)
            resp["ETag"] = etag
            resp["X-HG-Schema-Source"] = source
            patch_cache_control(
                resp,
                private=True,
                max_age=getattr(settings, "HERITAGEGRAPH_SCHEMA_CACHE_TTL", 60),
            )
            return resp

        resp = Response(payload)
        resp["ETag"] = etag
        resp["X-HG-Schema-Source"] = source
        patch_cache_control(
            resp,
            private=True,
            max_age=getattr(settings, "HERITAGEGRAPH_SCHEMA_CACHE_TTL", 60),
        )
        return resp


class SparqlProxyView(APIView):
    """
    Read-only SPARQL proxy to RDF_ENDPOINT_URL.
    GET …/sparql/?query=SELECT …

    If RDF_ENDPOINT_URL is not configured, fallback to a local on-disk Oxigraph
    store at `oxigraph_db/` using `pyoxigraph`.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        import requests
        from apps.cidoc_data.rdf_signals import is_readonly_sparql_query

        q = (
            request.query_params.get("query") or request.query_params.get("q") or ""
        ).strip()
        if not q:
            return Response(
                {"error": "Missing query parameter `query` or `q`."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        if not is_readonly_sparql_query(q):
            return Response(
                {
                    "error": "Only read-only SPARQL (SELECT / ASK / CONSTRUCT / DESCRIBE) is allowed."
                },
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        endpoint = (
            getattr(settings, "RDF_QUERY_URL", "").strip()
            or getattr(settings, "RDF_ENDPOINT_URL", "").strip()
        )
        if not endpoint:
            try:
                from pyoxigraph import Store
            except ImportError:
                return Response(
                    {
                        "error": "RDF endpoint not configured (RDF_ENDPOINT_URL) and local Oxigraph is unavailable (pyoxigraph not installed)."
                    },
                    status=drf_status.HTTP_503_SERVICE_UNAVAILABLE,
                )

            try:
                store_path = getattr(settings, "OXIGRAPH_STORE_PATH", "oxigraph_db")
                store = Store(store_path)
                result = store.query(q)
            except Exception as exc:
                return Response(
                    {"error": f"Local Oxigraph query failed: {exc}"},
                    status=drf_status.HTTP_502_BAD_GATEWAY,
                )

            try:
                # pyoxigraph 0.5.x: index each QuerySolution by the result's
                # Variable objects (dict(row) is unsupported); emit SPARQL-JSON.
                variables = list(getattr(result, "variables", []) or [])
                var_names = [getattr(v, "value", str(v).lstrip("?")) for v in variables]
                bindings = []
                for sol in result:
                    binding = {}
                    for var, name in zip(variables, var_names):
                        term = sol[var]
                        if term is None:
                            continue
                        is_uri = type(term).__name__ == "NamedNode"
                        binding[name] = {
                            "type": "uri" if is_uri else "literal",
                            "value": getattr(term, "value", str(term)),
                        }
                    bindings.append(binding)
                response_payload = {
                    "head": {"vars": var_names},
                    "results": {"bindings": bindings},
                }
            except Exception:
                response_payload = {"result": str(result)}

            resp = Response(response_payload)
            resp["X-HG-SPARQL-Source"] = "local-oxigraph"
            return resp
        try:
            r = requests.get(
                endpoint,
                params={"query": q},
                headers={
                    "Accept": "application/sparql-results+json, application/json;q=0.9, */*;q=0.1",
                },
                timeout=60,
            )
            r.raise_for_status()
        except Exception as exc:
            return Response({"error": str(exc)}, status=drf_status.HTTP_502_BAD_GATEWAY)
        ct = (r.headers.get("Content-Type") or "").lower()
        if "json" in ct:
            try:
                resp = Response(r.json())
                resp["X-HG-SPARQL-Source"] = "remote-endpoint"
                return resp
            except Exception:
                return Response({"result": r.text})
        resp = Response({"result": r.text})
        resp["X-HG-SPARQL-Source"] = "remote-endpoint"
        return resp


class AssistSuggestFieldView(APIView):
    """
    POST /cidoc/assist/suggest-field/
    Body: { "ontology_class": "structure", "field_key": "...", "partial_payload": { ... } }
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        try:
            from anthropic import Anthropic
        except ImportError:
            return Response(
                {"error": "anthropic package is not installed."},
                status=drf_status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        from apps.cidoc_data.linkml_loader import get_effective_registry_payload

        class_key = (request.data.get("ontology_class") or "").strip()
        field_key = (request.data.get("field_key") or "").strip()
        partial = request.data.get("partial_payload") or {}
        if not class_key or not field_key:
            return Response(
                {"error": "ontology_class and field_key are required."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        api_key = (
            getattr(settings, "ANTHROPIC_API_KEY", None)
            or os.environ.get("ANTHROPIC_API_KEY", "")
            or ""
        ).strip()
        if not api_key:
            return Response(
                {"error": "LLM assist is not configured (ANTHROPIC_API_KEY)."},
                status=drf_status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        registry = get_effective_registry_payload()
        cls = (registry.get("classes") or {}).get(class_key) or {}
        fields = cls.get("fields") or []
        field = next((f for f in fields if f.get("key") == field_key), None)
        if not field:
            return Response(
                {"error": f"Unknown field {field_key!r} for class {class_key!r}."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        partial_json = json.dumps(partial, default=str)[:8000]
        prompt = (
            f"Suggest the single best value for heritage metadata field {field_key!r} "
            f"(label: {field.get('label')!r}, type: {field.get('type')!r}) "
            f"for ontology class {class_key!r}.\n"
            f"Partial form state (JSON):\n{partial_json}\n\n"
            'Respond with JSON only: {"suggestion": "...", "confidence": 0.0-1, "rationale": "..."}'
        )
        client = Anthropic(api_key=api_key)
        model = getattr(settings, "ANTHROPIC_OCR_MODEL", "claude-3-5-sonnet-20241022")
        msg = client.messages.create(
            model=model,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = "".join(getattr(b, "text", "") for b in msg.content).strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-zA-Z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw).strip()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return Response(
                {"error": "Model returned non-JSON.", "raw": raw[:2000]},
                status=drf_status.HTTP_502_BAD_GATEWAY,
            )
        return Response(data)


# --- Map router resource segment → (Django model, serializer) for revert ---
_CIDOC_REVERT_MAP = {
    "historical_periods": (HistoricalPeriod, HistoricalPeriodSerializer),
    "locations": (Location, LocationSerializer),
    "persons": (Person, PersonSerializer),
    "events": (Event, EventSerializer),
    "traditions": (Tradition, TraditionSerializer),
    "sources": (Source, SourceSerializer),
    "deities": (Deity, DeitySerializer),
    "guthis": (Guthi, GuthiSerializer),
    "structures": (ArchitecturalStructure, ArchitecturalStructureSerializer),
    "rituals": (RitualEvent, RitualEventSerializer),
    "festivals": (Festival, FestivalSerializer),
    "iconographic_objects": (IconographicObject, IconographicObjectSerializer),
    "monuments": (Monument, MonumentSerializer),
    "kumari_tenures": (KumariTenure, KumariTenureSerializer),
    "kumari_selections": (KumariSelection, KumariSelectionSerializer),
    "kumari_retirements": (KumariRetirement, KumariRetirementSerializer),
    "syncretic_relationships": (SyncreticRelationship, SyncreticRelationshipSerializer),
    "caste_groups": (CasteGroup, CasteGroupSerializer),
    "calendar_systems": (CalendarSystem, CalendarSystemSerializer),
}


def _parse_cidoc_primary_key(raw: str):
    import uuid as _uuid

    s = (raw or "").strip()
    try:
        return int(s, 10)
    except ValueError:
        pass
    try:
        return _uuid.UUID(s)
    except Exception:
        return None


def _find_revision_snapshot(*, model_cls, cidoc_pk, revision_number: int):
    from apps.heritage_data.models import Revision

    model_name = model_cls.__name__
    cidoc_s = str(cidoc_pk)
    qs = (
        Revision.objects.filter(revision_number=int(revision_number))
        .select_related("entity", "created_by")
        .order_by("-created_at")
    )
    for rev in qs:
        data = rev.data or {}
        if data.get("_cidoc_model") != model_name:
            continue
        rid = data.get("_cidoc_id")
        if rid is None:
            continue
        if str(rid) == cidoc_s:
            return rev
    return None


class CidocRevertView(APIView):
    """
    POST /api/v1/cidoc/<resource>/<pk>/revert/
    Body: { "revision_number": <int> }
    Re-applies a stored Revision JSON snapshot onto the CIDOC row (after registry validation).
    """

    permission_classes = [permissions.IsAuthenticated, IsReviewerOrAdmin]

    def post(self, request, resource, pk, *args, **kwargs):
        from apps.heritage_data.models import Activity, Revision
        from apps.heritage_data.serializers import RevisionSerializer

        pair = _CIDOC_REVERT_MAP.get((resource or "").strip())
        if not pair:
            return Response(
                {"error": f"Unknown CIDOC resource {resource!r}."},
                status=drf_status.HTTP_404_NOT_FOUND,
            )
        model_cls, serializer_cls = pair
        parsed_pk = _parse_cidoc_primary_key(pk)
        if parsed_pk is None:
            return Response(
                {"error": "Invalid primary key."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        rev_num = request.data.get("revision_number")
        try:
            rev_num = int(rev_num)
        except (TypeError, ValueError):
            return Response(
                {"error": "revision_number (int) is required."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        try:
            instance = model_cls.objects.get(pk=parsed_pk)
        except model_cls.DoesNotExist:
            return Response(
                {"error": "Record not found."}, status=drf_status.HTTP_404_NOT_FOUND
            )

        target_rev = _find_revision_snapshot(
            model_cls=model_cls, cidoc_pk=parsed_pk, revision_number=rev_num
        )
        if target_rev is None:
            return Response(
                {"error": "No matching revision snapshot for this record."},
                status=drf_status.HTTP_404_NOT_FOUND,
            )

        raw_data = dict(target_rev.data or {})
        serializer_probe = serializer_cls(
            instance=instance,
            context={"request": request},
        )
        allowed = {
            name
            for name, field in serializer_probe.fields.items()
            if not getattr(field, "read_only", False)
        }
        cleaned = {
            k: v
            for k, v in raw_data.items()
            if not str(k).startswith("_") and k in allowed
        }

        serializer = serializer_cls(
            instance,
            data=cleaned,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        mixin = ContributionFlowMixin()
        mixin.request = request
        mixin.queryset = model_cls.objects.all()
        ContributionFlowMixin._validate_registry_payload(
            mixin, serializer, instance=instance
        )
        serializer.save()

        entity = target_rev.entity
        latest = (
            Revision.objects.filter(entity=entity).order_by("-revision_number").first()
        )
        next_num = (latest.revision_number + 1) if latest else 1
        new_data = dict(serializer.data)
        new_data["_cidoc_model"] = model_cls.__name__
        new_data["_cidoc_id"] = instance.pk
        new_rev = Revision.objects.create(
            entity=entity,
            data=new_data,
            revision_number=next_num,
            created_by=request.user,
        )
        entity.current_revision = new_rev
        entity.save(update_fields=["current_revision"])

        Activity.objects.create(
            entity=entity,
            user=request.user,
            activity_type="revised",
            comment=(
                f"CIDOC revert: reapplied snapshot from revision {rev_num} "
                f"onto {model_cls.__name__} pk={instance.pk}."
            ),
        )

        return Response(
            {
                "ok": True,
                "cultural_entity_id": str(entity.entity_id),
                "new_revision": RevisionSerializer(new_rev).data,
            },
            status=drf_status.HTTP_200_OK,
        )
