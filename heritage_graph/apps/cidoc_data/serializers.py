from django.contrib.auth import get_user_model
from rest_framework import serializers

from .edtf_field import EDTFSerializerField
from .models import *

User = get_user_model()


def _stored_point_to_latlng(point_value):
    """
    Read coordinates from Location/ArchitecturalStructure/Monument `point`.

    Matches migration ``0010_postgis_point_fields`` CharField format ``"<lat>, <lng>"``.
    Returns ``(latitude, longitude)`` or ``(None, None)``. If GIS PointField is
    enabled later, supports objects with ``.x`` / ``.y``.
    """
    if point_value is None:
        return None, None
    if hasattr(point_value, "x") and hasattr(point_value, "y"):
        try:
            return float(point_value.y), float(point_value.x)
        except (AttributeError, TypeError, ValueError):
            return None, None
    raw = point_value.strip() if isinstance(point_value, str) else ""
    if not raw:
        return None, None
    s = raw.replace(",", " ")
    parts = s.split()
    if len(parts) != 2:
        return None, None
    try:
        lat, lng = float(parts[0]), float(parts[1])
    except (TypeError, ValueError):
        return None, None
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None, None
    return lat, lng


def _latlng_to_point_charfield(latitude, longitude):
    """Serialize lat/lng to the CharField convention used when GIS is disabled."""
    return f"{latitude}, {longitude}"


def _coerce_latlng_for_point(lat, lng):
    """Validate inbound latitude/longitude for the optional `point` CharField."""
    try:
        lat_f = float(lat)
        lng_f = float(lng)
    except (TypeError, ValueError):
        raise serializers.ValidationError(
            {
                "latitude": "Must be valid numbers.",
                "longitude": "Must be valid numbers.",
            }
        )
    if not (-90 <= lat_f <= 90 and -180 <= lng_f <= 180):
        raise serializers.ValidationError(
            {
                "latitude": "Latitude must be between -90 and 90.",
                "longitude": "Longitude must be between -180 and 180.",
            }
        )
    return lat_f, lng_f


##########################################
#           CIDOC_DATA CLASSES
##########################################


def _get_cultural_entity_id(instance):
    """
    Look up the CulturalEntity UUID for a CIDOC record by searching
    revisions that have _cidoc_model and _cidoc_id in their data.

    For PostgreSQL: uses efficient JSON contains lookup
    For SQLite: falls back to Python-based filtering
    """
    from apps.heritage_data.models import Revision
    from django.db import connection

    model_name = instance.__class__.__name__
    cidoc_id = instance.pk

    try:
        # Try PostgreSQL-compatible JSON contains lookup first
        if connection.vendor == "postgresql":
            rev = (
                Revision.objects.filter(
                    data__contains={"_cidoc_model": model_name, "_cidoc_id": cidoc_id},
                )
                .select_related("entity")
                .first()
            )
            if rev:
                return str(rev.entity.entity_id)
        else:
            # SQLite fallback: query limited set and filter in Python
            # Newer revisions are more likely to match, so order by creation
            revs = Revision.objects.select_related("entity").order_by("-created_at")[
                :500
            ]
            for rev in revs:
                if isinstance(rev.data, dict):
                    if (
                        rev.data.get("_cidoc_model") == model_name
                        and rev.data.get("_cidoc_id") == cidoc_id
                    ):
                        return str(rev.entity.entity_id)
    except Exception:
        pass
    return None


class CulturalEntityLinkMixin(serializers.Serializer):
    """Mixin to add cultural_entity_id to CIDOC serializers."""

    cultural_entity_id = serializers.SerializerMethodField()

    def get_cultural_entity_id(self, obj):
        return _get_cultural_entity_id(obj)


class BaseRegistrySerializer(serializers.ModelSerializer):
    """
    Base serializer that validates inbound payloads against the LinkML-derived
    JSON Schema at .validate() time.

    Resolves the registry class key via DJANGO_MODEL_TO_REGISTRY_CLASS_KEY.
    Validation is silently skipped when the key is absent, the registry is
    unavailable, or no JSON Schema entry exists for the class — so this is
    safe to use as a drop-in base for all CIDOC serializers.
    """

    def validate(self, attrs):
        attrs = super().validate(attrs)
        try:
            from .cidoc_registry_keys import registry_class_key_for_model
            from .linkml_loader import get_effective_registry_payload
            from .registry_validation import validate_payload_for_class_drf

            key = registry_class_key_for_model(self.Meta.model)
            if key:
                payload = get_effective_registry_payload()
                validate_payload_for_class_drf(
                    class_key=key,
                    payload=attrs,
                    registry_jsonschema=payload.get("registry_jsonschema"),
                )
        except Exception:
            pass
        return attrs


class PersonSerializer(CulturalEntityLinkMixin, serializers.ModelSerializer):
    birth_date = EDTFSerializerField(required=False, allow_blank=True)
    death_date = EDTFSerializerField(required=False, allow_blank=True)

    class Meta:
        model = Person
        fields = "__all__"

    def validate(self, attrs):
        allowed = set(self.fields)
        unknown = set(attrs) - allowed
        if unknown:
            raise serializers.ValidationError(
                {k: "Unknown or read-only field for this resource." for k in unknown}
            )
        return attrs


class LocationSerializer(CulturalEntityLinkMixin, serializers.ModelSerializer):
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()

    class Meta:
        model = Location
        fields = "__all__"

    def get_latitude(self, obj):
        lat, _ = _stored_point_to_latlng(obj.point)
        return lat

    def get_longitude(self, obj):
        _, lng = _stored_point_to_latlng(obj.point)
        return lng

    def to_internal_value(self, data):
        mutable = (
            {k: v for k, v in data.items()}
            if hasattr(data, "items")
            else dict(data)
        )
        if mutable.get("place_type") not in (None, "") and not mutable.get("type"):
            mutable["type"] = mutable.pop("place_type", None)
        else:
            mutable.pop("place_type", None)
        pc = mutable.pop("place_coordinates", None)
        if pc not in (None, "") and not mutable.get("coordinates_legacy"):
            mutable["coordinates_legacy"] = str(pc).strip()
        lat = mutable.pop("latitude", None)
        lng = mutable.pop("longitude", None)
        ret = super().to_internal_value(mutable)
        if lat is not None and lng is not None:
            lat_f, lng_f = _coerce_latlng_for_point(lat, lng)
            ret["point"] = _latlng_to_point_charfield(lat_f, lng_f)
        if not ret.get("type"):
            ret["type"] = "temple"
        if not ret.get("current_status"):
            ret["current_status"] = "preserved"
        return ret


class EventSerializer(CulturalEntityLinkMixin, serializers.ModelSerializer):
    start_date = EDTFSerializerField(required=False, allow_blank=True)
    end_date = EDTFSerializerField(required=False, allow_blank=True)

    class Meta:
        model = Event
        fields = "__all__"


class HistoricalPeriodSerializer(CulturalEntityLinkMixin, serializers.ModelSerializer):
    class Meta:
        model = HistoricalPeriod
        fields = "__all__"


class TraditionSerializer(CulturalEntityLinkMixin, serializers.ModelSerializer):
    class Meta:
        model = Tradition
        fields = "__all__"


class SourceSerializer(CulturalEntityLinkMixin, serializers.ModelSerializer):
    class Meta:
        model = Source
        fields = "__all__"


# =====================================================================
# NEW ONTOLOGY-DRIVEN SERIALIZERS
# =====================================================================


class DeitySerializer(CulturalEntityLinkMixin, serializers.ModelSerializer):
    class Meta:
        model = Deity
        fields = "__all__"


class GuthiSerializer(CulturalEntityLinkMixin, serializers.ModelSerializer):
    class Meta:
        model = Guthi
        fields = "__all__"


class ArchitecturalStructureSerializer(
    CulturalEntityLinkMixin, serializers.ModelSerializer
):
    construction_date = EDTFSerializerField(required=False, allow_blank=True)
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()

    class Meta:
        model = ArchitecturalStructure
        fields = "__all__"

    def to_representation(self, instance):
        data = super().to_representation(instance)
        raw_loc = data.get("has_current_location")
        if raw_loc is None:
            data["has_current_location"] = None
        elif isinstance(raw_loc, dict):
            pass
        else:
            try:
                loc = Location.objects.only("id", "name").get(pk=raw_loc)
                data["has_current_location"] = {"id": loc.id, "name": loc.name}
            except Location.DoesNotExist:
                data["has_current_location"] = {"id": raw_loc, "name": str(raw_loc)}
        return data

    def get_latitude(self, obj):
        lat, _ = _stored_point_to_latlng(obj.point)
        return lat

    def get_longitude(self, obj):
        _, lng = _stored_point_to_latlng(obj.point)
        return lng

    def to_internal_value(self, data):
        lat = data.pop("latitude", None)
        lng = data.pop("longitude", None)
        ret = super().to_internal_value(data)
        if lat is not None and lng is not None:
            lat_f, lng_f = _coerce_latlng_for_point(lat, lng)
            ret["point"] = _latlng_to_point_charfield(lat_f, lng_f)
        return ret


class RitualEventSerializer(CulturalEntityLinkMixin, serializers.ModelSerializer):
    class Meta:
        model = RitualEvent
        fields = "__all__"


class FestivalSerializer(CulturalEntityLinkMixin, serializers.ModelSerializer):
    class Meta:
        model = Festival
        fields = "__all__"


class ProductionSerializer(CulturalEntityLinkMixin, serializers.ModelSerializer):
    date_earliest = EDTFSerializerField(required=False, allow_blank=True)
    date_latest = EDTFSerializerField(required=False, allow_blank=True)

    class Meta:
        model = Production
        fields = "__all__"


class ConsecrationSerializer(CulturalEntityLinkMixin, serializers.ModelSerializer):
    date_earliest = EDTFSerializerField(required=False, allow_blank=True)
    date_latest = EDTFSerializerField(required=False, allow_blank=True)

    class Meta:
        model = Consecration
        fields = "__all__"


class EnshrinementSerializer(CulturalEntityLinkMixin, serializers.ModelSerializer):
    date_earliest = EDTFSerializerField(required=False, allow_blank=True)
    date_latest = EDTFSerializerField(required=False, allow_blank=True)

    class Meta:
        model = Enshrinement
        fields = "__all__"


class TransferOfCustodySerializer(CulturalEntityLinkMixin, serializers.ModelSerializer):
    date_earliest = EDTFSerializerField(required=False, allow_blank=True)
    date_latest = EDTFSerializerField(required=False, allow_blank=True)

    class Meta:
        model = TransferOfCustody
        fields = "__all__"


class IconographicObjectSerializer(
    CulturalEntityLinkMixin, serializers.ModelSerializer
):
    class Meta:
        model = IconographicObject
        fields = "__all__"


class MonumentSerializer(CulturalEntityLinkMixin, serializers.ModelSerializer):
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()

    class Meta:
        model = Monument
        fields = "__all__"

    def get_latitude(self, obj):
        lat, _ = _stored_point_to_latlng(obj.point)
        return lat

    def get_longitude(self, obj):
        _, lng = _stored_point_to_latlng(obj.point)
        return lng

    def to_internal_value(self, data):
        lat = data.pop("latitude", None)
        lng = data.pop("longitude", None)
        ret = super().to_internal_value(data)
        if lat is not None and lng is not None:
            lat_f, lng_f = _coerce_latlng_for_point(lat, lng)
            ret["point"] = _latlng_to_point_charfield(lat_f, lng_f)
        return ret


class KumariTenureSerializer(CulturalEntityLinkMixin, serializers.ModelSerializer):
    date_earliest = EDTFSerializerField(required=False, allow_blank=True)
    date_latest = EDTFSerializerField(required=False, allow_blank=True)

    class Meta:
        model = KumariTenure
        fields = "__all__"


class KumariSelectionSerializer(CulturalEntityLinkMixin, serializers.ModelSerializer):
    date_earliest = EDTFSerializerField(required=False, allow_blank=True)

    class Meta:
        model = KumariSelection
        fields = "__all__"


class KumariRetirementSerializer(CulturalEntityLinkMixin, serializers.ModelSerializer):
    date_earliest = EDTFSerializerField(required=False, allow_blank=True)

    class Meta:
        model = KumariRetirement
        fields = "__all__"


class SyncreticRelationshipSerializer(
    CulturalEntityLinkMixin, serializers.ModelSerializer
):
    class Meta:
        model = SyncreticRelationship
        fields = "__all__"


class CasteGroupSerializer(CulturalEntityLinkMixin, serializers.ModelSerializer):
    class Meta:
        model = CasteGroup
        fields = "__all__"


class CalendarSystemSerializer(CulturalEntityLinkMixin, serializers.ModelSerializer):
    class Meta:
        model = CalendarSystem
        fields = "__all__"


class PersonRevisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonRevision
        fields = "__all__"


# =====================================================================
# PROVENANCE SERIALIZERS
# =====================================================================


class DataSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataSource
        fields = "__all__"
        read_only_fields = ["id", "created_at"]


class RelationshipPredicateSerializer(serializers.ModelSerializer):
    class Meta:
        model = RelationshipPredicate
        fields = "__all__"
        read_only_fields = ["id"]


class HeritageAssertionSerializer(serializers.ModelSerializer):
    content_type_name = serializers.SerializerMethodField()
    source_type = serializers.SerializerMethodField()
    source_name = serializers.SerializerMethodField()
    source_rank = serializers.SerializerMethodField()
    object_entity_type = serializers.SerializerMethodField()
    object_entity_id = serializers.SerializerMethodField()

    class Meta:
        model = HeritageAssertion
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_content_type_name(self, obj):
        return obj.content_type.model if obj.content_type else None

    def get_source_type(self, obj):
        if obj.source_id and obj.source:
            return obj.source.source_type
        return None

    def get_source_name(self, obj):
        if obj.source_id and obj.source:
            return obj.source.name
        return None

    def get_source_rank(self, obj):
        from .identity_services import source_type_rank

        source_type = self.get_source_type(obj)
        return source_type_rank(source_type)

    def get_object_entity_type(self, obj):
        return obj.object_content_type.model if obj.object_content_type_id else None

    def get_object_entity_id(self, obj):
        return obj.object_object_id

    def create(self, validated_data):
        instance = HeritageAssertion(**validated_data)
        instance.full_clean()
        instance.save()
        return instance

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.full_clean()
        instance.save()
        return instance


class EntityClusterSerializer(serializers.ModelSerializer):
    expected_version = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = EntityCluster
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "merged_into", "version"]

    def validate(self, attrs):
        if self.instance is not None and "type_scope" in attrs:
            if attrs["type_scope"] != self.instance.type_scope:
                raise serializers.ValidationError(
                    {"type_scope": "type_scope cannot be changed after create."}
                )
        ev = attrs.get("expected_version")
        if self.instance is not None and ev is not None and ev != self.instance.version:
            raise serializers.ValidationError(
                {"expected_version": "Cluster was modified; refresh and retry."}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("expected_version", None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("expected_version", None)
        return super().update(instance, validated_data)


class ClusterAuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClusterAuditEvent
        fields = [
            "id",
            "action",
            "actor_id",
            "reason",
            "before_state",
            "after_state",
            "affected_cluster_ids",
            "affected_assertion_ids",
            "related_cluster_id",
            "created_at",
        ]
        read_only_fields = fields


class IdentityResolutionCandidateSerializer(serializers.ModelSerializer):
    left = serializers.SerializerMethodField()
    right = serializers.SerializerMethodField()

    class Meta:
        model = IdentityResolutionCandidate
        fields = [
            "id",
            "left",
            "right",
            "signal_scores",
            "status",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def _entity_ref(self, ct, oid):
        from .identity_services import entity_display_title

        title = ""
        model = ct.model_class() if ct else None
        if model:
            try:
                title = entity_display_title(model.objects.get(pk=oid))
            except model.DoesNotExist:
                title = "missing"
        return {
            "entity_type": ct.model if ct else "",
            "entity_id": oid,
            "title": title,
        }

    def get_left(self, obj):
        return self._entity_ref(obj.left_content_type, obj.left_object_id)

    def get_right(self, obj):
        return self._entity_ref(obj.right_content_type, obj.right_object_id)


class MergeClusterRequestSerializer(serializers.Serializer):
    source_cluster_id = serializers.UUIDField()
    reason = serializers.CharField(allow_blank=True, default="")
    expected_version = serializers.IntegerField()
    lock_override = serializers.BooleanField(default=False)


class SplitClusterRequestSerializer(serializers.Serializer):
    reason = serializers.CharField(allow_blank=True, default="")
    expected_version = serializers.IntegerField()
    groups = serializers.ListField(
        child=serializers.ListField(child=serializers.IntegerField(min_value=1)),
        allow_empty=False,
    )


class LockClusterBodySerializer(serializers.Serializer):
    reason = serializers.CharField(allow_blank=True, default="")
    expected_version = serializers.IntegerField()


class ResolveCandidateRequestSerializer(serializers.Serializer):
    resolution = serializers.ChoiceField(choices=["accept", "reject", "defer"])
    notes = serializers.CharField(allow_blank=True, required=False, default="")
    target_cluster_id = serializers.UUIDField(required=False, allow_null=True)


class InlineAssertionSerializer(serializers.Serializer):
    """
    Lightweight serializer for assertion data submitted inline
    with an entity creation form. Used in the contribution wizard.
    """

    source_type = serializers.ChoiceField(
        choices=[
            ("archival", "Archival Record"),
            ("field_survey", "Field Survey"),
            ("oral_history", "Oral History"),
            ("published", "Published Source"),
            ("inscription", "Inscription"),
            ("web", "Web Resource"),
        ],
        required=False,
    )
    source_citation = serializers.CharField(required=False, allow_blank=True)
    source_url = serializers.URLField(required=False, allow_blank=True)
    confidence = serializers.ChoiceField(
        choices=[
            ("certain", "Certain"),
            ("likely", "Likely"),
            ("uncertain", "Uncertain"),
            ("speculative", "Speculative"),
        ],
        default="likely",
    )
    data_quality_note = serializers.CharField(required=False, allow_blank=True)


class AssertionAwareStructureSerializer(serializers.ModelSerializer):
    """
    Structure serializer that accepts inline assertion data on create
    and returns linked assertions on read.
    """

    assertion = InlineAssertionSerializer(write_only=True, required=False)
    assertions = HeritageAssertionSerializer(many=True, read_only=True)

    class Meta:
        model = ArchitecturalStructure
        fields = "__all__"

    def create(self, validated_data):
        assertion_data = validated_data.pop("assertion", None)
        structure = super().create(validated_data)

        if assertion_data:
            from django.contrib.contenttypes.models import ContentType

            ct = ContentType.objects.get_for_model(structure)

            # Create a DataSource if citation is provided
            source = None
            if assertion_data.get("source_citation") or assertion_data.get(
                "source_url"
            ):
                source = DataSource.objects.create(
                    name=assertion_data.get("source_citation", "Untitled source")[:300],
                    source_type=assertion_data.get("source_type", "published"),
                    citation=assertion_data.get("source_citation", ""),
                    url=assertion_data.get("source_url", ""),
                )

            # Get contributor from request context
            request = self.context.get("request")
            contributed_by = ""
            if request and hasattr(request, "user") and request.user.is_authenticated:
                contributed_by = request.user.email or request.user.username

            HeritageAssertion.objects.create(
                content_type=ct,
                object_id=structure.id,
                assertion_content=f"Created record for {structure.name}",
                source=source,
                source_citation=assertion_data.get("source_citation", ""),
                contributed_by=contributed_by,
                confidence=assertion_data.get("confidence", "likely"),
                data_quality_note=assertion_data.get("data_quality_note", ""),
            )

        return structure


class AssertionAwareRitualSerializer(serializers.ModelSerializer):
    """Ritual serializer with inline assertion support."""

    assertion = InlineAssertionSerializer(write_only=True, required=False)
    assertions = HeritageAssertionSerializer(many=True, read_only=True)

    class Meta:
        model = RitualEvent
        fields = "__all__"

    def create(self, validated_data):
        assertion_data = validated_data.pop("assertion", None)
        ritual = super().create(validated_data)

        if assertion_data:
            from django.contrib.contenttypes.models import ContentType

            ct = ContentType.objects.get_for_model(ritual)

            source = None
            if assertion_data.get("source_citation") or assertion_data.get(
                "source_url"
            ):
                source = DataSource.objects.create(
                    name=assertion_data.get("source_citation", "Untitled source")[:300],
                    source_type=assertion_data.get("source_type", "published"),
                    citation=assertion_data.get("source_citation", ""),
                    url=assertion_data.get("source_url", ""),
                )

            request = self.context.get("request")
            contributed_by = ""
            if request and hasattr(request, "user") and request.user.is_authenticated:
                contributed_by = request.user.email or request.user.username

            HeritageAssertion.objects.create(
                content_type=ct,
                object_id=ritual.id,
                assertion_content=f"Created record for {ritual.name}",
                source=source,
                source_citation=assertion_data.get("source_citation", ""),
                contributed_by=contributed_by,
                confidence=assertion_data.get("confidence", "likely"),
                data_quality_note=assertion_data.get("data_quality_note", ""),
            )

        return ritual


class AssertionAwareDeitySerializer(serializers.ModelSerializer):
    """Deity serializer with inline assertion support."""

    assertion = InlineAssertionSerializer(write_only=True, required=False)
    assertions = HeritageAssertionSerializer(many=True, read_only=True)

    class Meta:
        model = Deity
        fields = "__all__"

    def create(self, validated_data):
        assertion_data = validated_data.pop("assertion", None)
        deity = super().create(validated_data)

        if assertion_data:
            from django.contrib.contenttypes.models import ContentType

            ct = ContentType.objects.get_for_model(deity)

            source = None
            if assertion_data.get("source_citation") or assertion_data.get(
                "source_url"
            ):
                source = DataSource.objects.create(
                    name=assertion_data.get("source_citation", "Untitled source")[:300],
                    source_type=assertion_data.get("source_type", "published"),
                    citation=assertion_data.get("source_citation", ""),
                    url=assertion_data.get("source_url", ""),
                )

            request = self.context.get("request")
            contributed_by = ""
            if request and hasattr(request, "user") and request.user.is_authenticated:
                contributed_by = request.user.email or request.user.username

            HeritageAssertion.objects.create(
                content_type=ct,
                object_id=deity.id,
                assertion_content=f"Created record for {deity.name}",
                source=source,
                source_citation=assertion_data.get("source_citation", ""),
                contributed_by=contributed_by,
                confidence=assertion_data.get("confidence", "likely"),
                data_quality_note=assertion_data.get("data_quality_note", ""),
            )

        return deity


class AssertionAwareGuthiSerializer(serializers.ModelSerializer):
    """Guthi serializer with inline assertion support."""

    assertion = InlineAssertionSerializer(write_only=True, required=False)
    assertions = HeritageAssertionSerializer(many=True, read_only=True)

    class Meta:
        model = Guthi
        fields = "__all__"

    def create(self, validated_data):
        assertion_data = validated_data.pop("assertion", None)
        guthi = super().create(validated_data)

        if assertion_data:
            from django.contrib.contenttypes.models import ContentType

            ct = ContentType.objects.get_for_model(guthi)

            source = None
            if assertion_data.get("source_citation") or assertion_data.get(
                "source_url"
            ):
                source = DataSource.objects.create(
                    name=assertion_data.get("source_citation", "Untitled source")[:300],
                    source_type=assertion_data.get("source_type", "published"),
                    citation=assertion_data.get("source_citation", ""),
                    url=assertion_data.get("source_url", ""),
                )

            request = self.context.get("request")
            contributed_by = ""
            if request and hasattr(request, "user") and request.user.is_authenticated:
                contributed_by = request.user.email or request.user.username

            HeritageAssertion.objects.create(
                content_type=ct,
                object_id=guthi.id,
                assertion_content=f"Created record for {guthi.name}",
                source=source,
                source_citation=assertion_data.get("source_citation", ""),
                contributed_by=contributed_by,
                confidence=assertion_data.get("confidence", "likely"),
                data_quality_note=assertion_data.get("data_quality_note", ""),
            )

        return guthi


#########################################


# # --- User Serializer ---
# class UserSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = User
#         fields = ['id', 'username', 'email']


# class ArtifactSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Artifact
#         fields = '__all__'


# # --- Revision serializers ---
# class HistoricalPeriodRevisionSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = HistoricalPeriodRevision
#         fields = '__all__'

# class LocationRevisionSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = LocationRevision
#         fields = '__all__'

# class ArtifactRevisionSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = ArtifactRevision
#         fields = '__all__'

# class EventRevisionSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = EventRevision
#         fields = '__all__'

# class TraditionRevisionSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = TraditionRevision
#         fields = '__all__'

# class SourceRevisionSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = SourceRevision
#         fields = '__all__'

# # --- Comment serializers ---
# class ActivitySerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Activity
#         fields = '__all__'

# # Generic comment serializer generator
# def create_comment_serializer(model_name):
#     class CommentSerializer(serializers.ModelSerializer):
#         class Meta:
#             model = model_name
#             fields = '__all__'
#     return CommentSerializer

# HistoricalPeriodCommentSerializer = create_comment_serializer(HistoricalPeriodComment)
# LocationCommentSerializer = create_comment_serializer(LocationComment)
# PersonCommentSerializer = create_comment_serializer(PersonComment)
# ArtifactCommentSerializer = create_comment_serializer(ArtifactComment)
# EventCommentSerializer = create_comment_serializer(EventComment)
# TraditionCommentSerializer = create_comment_serializer(TraditionComment)
# SourceCommentSerializer = create_comment_serializer(SourceComment)

# HistoricalPeriodRevisionCommentSerializer = create_comment_serializer(HistoricalPeriodRevisionComment)
# LocationRevisionCommentSerializer = create_comment_serializer(LocationRevisionComment)
# PersonRevisionCommentSerializer = create_comment_serializer(PersonRevisionComment)
# ArtifactRevisionCommentSerializer = create_comment_serializer(ArtifactRevisionComment)
# EventRevisionCommentSerializer = create_comment_serializer(EventRevisionComment)
# TraditionRevisionCommentSerializer = create_comment_serializer(TraditionRevisionComment)
# SourceRevisionCommentSerializer = create_comment_serializer(SourceRevisionComment)

# class NotificationForUserSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = NotificationForUser
#         fields = '__all__'
