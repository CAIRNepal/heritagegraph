import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation
from django.contrib.contenttypes.models import ContentType

# GIS support (PostGIS) - disabled for development on SQLite
# To enable: install GDAL system library and python-gdal
GIS_AVAILABLE = False
gis_models = None  # type: ignore

from .identity_constants import CLUSTER_AUDIT_ACTION_CHOICES
from .edtf_field import validate_edtf

User = get_user_model()

# Choice constants
ARTIFACT_CONDITION_CHOICES = [
    ("excellent", "Excellent"),
    ("good", "Good"),
    ("fair", "Fair"),
    ("deteriorating", "Deteriorating"),
    ("ruined", "Ruined"),
]

ARTIFACT_STATUS_CHOICES = [
    ("on_display", "On Display"),
    ("in_storage", "In Storage"),
    ("on_loan", "On Loan"),
    ("lost", "Lost"),
    ("destroyed", "Destroyed"),
]

LOCATION_TYPE_CHOICES = [
    ("temple", "Temple"),
    ("monument", "Monument"),
    ("city", "City"),
    ("museum", "Museum"),
    ("region", "Region"),
    ("archaeological_site", "Archaeological Site"),
]

LOCATION_STATUS_CHOICES = [
    ("preserved", "Preserved"),
    ("partially_ruined", "Partially Ruined"),
    ("ruined", "Ruined"),
    ("rebuilt", "Rebuilt"),
]

EVENT_TYPE_CHOICES = [
    ("festival", "Festival"),
    ("ritual", "Ritual"),
    ("historical", "Historical Event"),
    ("ceremony", "Ceremony"),
]

EVENT_RECURRENCE_CHOICES = [
    ("annual", "Annual"),
    ("biennial", "Biennial"),
    ("monthly", "Monthly"),
    ("one_time", "One-time"),
]

TRADITION_TYPE_CHOICES = [
    ("ritual", "Ritual"),
    ("dance", "Dance"),
    ("storytelling", "Storytelling"),
    ("craft", "Craft"),
    ("music", "Music"),
]

SOURCE_TYPE_CHOICES = [
    ("book", "Book"),
    ("journal", "Journal Article"),
    ("archive", "Archive Document"),
    ("thesis", "Thesis"),
    ("web", "Web Resource"),
    ("field_note", "Field Notes"),
]

ACCESS_TIER_CHOICES = [
    ("public", "Public"),
    ("restricted", "Restricted"),
    ("community_only", "Community only"),
    ("sensitive_indigenous", "Sensitive / indigenous"),
]


class MetaData(models.Model):
    """
    Shared metadata fields for all models.
    """

    title = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    contributor = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=50, blank=True, null=True)
    access_tier = models.CharField(
        max_length=32,
        choices=ACCESS_TIER_CHOICES,
        default="public",
        help_text="CARE-aligned access tier for publication and LOD export",
    )
    care_labels = models.JSONField(
        default=list,
        blank=True,
        help_text="TK/CARE label URIs or codes (e.g. community consent markers)",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True


class Person(MetaData):
    """
    this class is supposed to take Actors class of CIDOC-CRM. Like Kings, Monks and others.
    """

    id = models.AutoField(primary_key=True)  # Added unique ID
    name = models.CharField(max_length=200)
    aliases = models.TextField(
        blank=True, help_text="Comma-separated alternative names"
    )
    birth_date = models.CharField(max_length=50, blank=True, validators=[validate_edtf])
    death_date = models.CharField(max_length=50, blank=True, validators=[validate_edtf])
    occupation = models.CharField(max_length=100, blank=True)
    biography = models.TextField(blank=True)

    ## relationships

    # historical_period = models.ForeignKey(
    #     HistoricalPeriod,
    #     on_delete=models.SET_NULL,
    #     null=True,
    #     blank=True,
    #     related_name='notable_figures'
    # )

    def __str__(self):
        return self.name


from django.utils import timezone


class PersonRevision(models.Model):
    ACTION_CHOICES = [("create", "Create"), ("update", "Update"), ("delete", "Delete")]

    revision_id = models.AutoField(primary_key=True)
    person = models.ForeignKey(
        "Person", on_delete=models.CASCADE, related_name="revisions"
    )
    snapshot = models.JSONField(
        help_text="JSON snapshot of the Person object at this revision"
    )
    # user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, help_text="User who made the change")
    user = models.CharField(max_length=255, blank=True, null=True)
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-timestamp"]
        verbose_name = "Person Revision"
        verbose_name_plural = "Person Revisions"

    def __str__(self):
        return f"Revision {self.revision_id} for {self.person.name} ({self.action})"


class Location(MetaData):
    """
    This class is supposed to take the locations
    """

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    coordinates_legacy = models.CharField(
        max_length=50, blank=True, help_text="Legacy 'Lat, Long' string — use point field instead"
    )
    if GIS_AVAILABLE:
        point = gis_models.PointField(
            geography=True, srid=4326, null=True, blank=True,
            help_text="Geographic point (longitude, latitude) — WGS84"
        )
    else:
        point = models.CharField(
            max_length=50,
            blank=True,
            default="",
            help_text=(
                "Geographic point (longitude, latitude). "
                "Requires GDAL for spatial queries."
            ),
        )
    type = models.CharField(max_length=50, choices=LOCATION_TYPE_CHOICES)
    description = models.TextField(blank=True)
    current_status = models.CharField(max_length=20, choices=LOCATION_STATUS_CHOICES)

    ## Relationships

    # historical_period = models.ForeignKey(
    #     historical_period,
    #     on_delete=models.SET_NULL,
    #     null=True,
    #     blank=True,
    #     related_name='locations'
    # )

    def __str__(self):
        return self.name


class Event(MetaData):
    """
    Event happened in particular timeframe.
    For eg: Kot Parva, Royal Massacre and others.
    """

    id = models.AutoField(primary_key=True)  # Added unique ID
    name = models.CharField(max_length=200)
    type = models.CharField(max_length=20, choices=EVENT_TYPE_CHOICES)
    description = models.TextField()
    start_date = models.CharField(
        max_length=100, blank=True, help_text="e.g., 'Baisakh 15' or EDTF like '1934~'",
        validators=[validate_edtf],
    )
    end_date = models.CharField(max_length=100, blank=True, validators=[validate_edtf])
    recurrence = models.CharField(max_length=20, choices=EVENT_RECURRENCE_CHOICES)

    ## Relationships

    # location = models.ForeignKey(
    #     Location,
    #     on_delete=models.SET_NULL,
    #     null=True,
    #     blank=True,
    #     related_name='hosted_events'
    # )
    # historical_period = models.ForeignKey(
    #     HistoricalPeriod,
    #     on_delete=models.SET_NULL,
    #     null=True,
    #     blank=True,
    #     related_name='events'
    # )
    # participants = models.ManyToManyField(
    #     Person,
    #     blank=True,
    #     related_name='participated_events'
    # )
    # documentation_sources = models.ManyToManyField(
    #     'Source',
    #     blank=True,
    #     related_name='documented_events'
    # )

    def __str__(self):
        return self.name


class HistoricalPeriod(MetaData):
    """
    Historical Period, For eg: Lichhavi Era, Unification of Nepal period.
    """

    id = models.AutoField(primary_key=True)  # Added unique ID
    name = models.CharField(max_length=100, unique=True)
    start_year = models.CharField(
        max_length=20, help_text="e.g., 'c. 1200 BCE' or '1768'"
    )
    end_year = models.CharField(max_length=20, help_text="e.g., '1482 CE' or 'present'")
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.name} ({self.start_year} - {self.end_year})"


class Tradition(MetaData):
    """
    Particular tradition followed at some period.
    For eg: Sati Pratha, Kamaiya Pratha
    """

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    type = models.CharField(max_length=20, choices=TRADITION_TYPE_CHOICES)
    description = models.TextField()
    associated_materials = models.TextField(
        blank=True, help_text="Tools, garments, instruments used"
    )

    ## Relationships

    # practitioners = models.ManyToManyField(
    #     Person,
    #     blank=True,
    #     related_name='practiced_traditions'
    # )
    # artifacts_used = models.ManyToManyField(
    #     Artifact,
    #     blank=True,
    #     related_name='traditions_used_in'
    # )
    # associated_events = models.ManyToManyField(
    #     Event,
    #     blank=True,
    #     related_name='traditions_observed'
    # )
    # documentation_sources = models.ManyToManyField(
    #     'Source',
    #     blank=True,
    #     related_name='documented_traditions'
    # )

    def __str__(self):
        return self.name


class Source(MetaData):
    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=300)
    authors = models.TextField(help_text="Comma-separated author names")
    publication_year = models.CharField(max_length=20, blank=True)
    type = models.CharField(max_length=20, choices=SOURCE_TYPE_CHOICES)
    digital_link = models.URLField(max_length=500, blank=True)
    archive_location = models.CharField(
        max_length=200, blank=True, help_text="Physical archive location"
    )

    def __str__(self):
        return self.title


# =====================================================================
# NEW ONTOLOGY-DRIVEN MODELS — from HeritageGraph.yaml
# =====================================================================

STRUCTURE_TYPE_CHOICES = [
    ("Temple", "Temple"),
    ("Stupa", "Stupa"),
    ("Chaitya", "Chaitya"),
    ("Pati", "Pati (Open Pavilion)"),
    ("Sattal", "Sattal (Multi-story Rest House)"),
    ("Dharmashala", "Dharmashala (Pilgrim Lodge)"),
    ("DhungeDhara", "Dhunge Dhara (Stone Spout)"),
    ("Pokhari", "Pokhari (Pond/Tank)"),
    ("Other", "Other"),
]

ARCHITECTURAL_STYLE_CHOICES = [
    ("Pagoda", "Pagoda"),
    ("Shikhara", "Shikhara"),
    ("Stupa", "Stupa"),
    ("Dome", "Dome"),
    ("Mughal", "Mughal"),
    ("Rana_Neoclassical", "Rana Neoclassical"),
    ("Mixed", "Mixed"),
    ("Other", "Other"),
]

EXISTENCE_STATUS_CHOICES = [
    ("Extant", "Extant"),
    ("Destroyed", "Destroyed"),
    ("Damaged", "Damaged"),
    ("Restored", "Restored"),
    ("Partially_Extant", "Partially Extant"),
    ("Relocated", "Relocated"),
    ("Unknown", "Unknown"),
]

CONDITION_TYPE_CHOICES = [
    ("Excellent", "Excellent"),
    ("Good", "Good"),
    ("Fair", "Fair"),
    ("Poor", "Poor"),
    ("Very_Poor", "Very Poor"),
    ("Ruinous", "Ruinous"),
]

GUTHI_TYPE_CHOICES = [
    ("SiGuthi", "Si Guthi (Funeral Trust)"),
    ("JatraGuthi", "Jatra Guthi (Festival Organization)"),
    ("PujaGuthi", "Puja Guthi (Daily Worship)"),
    ("TempleGuthi", "Temple Guthi (Temple Maintenance)"),
    ("NashaGuthi", "Nasha Guthi (Music and Dance)"),
    ("SanaGuthi", "Sana Guthi (Agricultural Cooperative)"),
    ("SanGuthi", "San Guthi (Life-cycle Ritual)"),
    ("RajGuthi", "Raj Guthi (Royal Endowment)"),
    ("Other", "Other"),
]

RITUAL_TYPE_CHOICES = [
    ("NityaPuja", "Nitya Puja (Daily Worship)"),
    ("NaimittikaPuja", "Naimittika Puja (Festival Worship)"),
    ("KamyaPuja", "Kamya Puja (Desire-based Worship)"),
    ("Abhisheka", "Abhisheka (Ritual Bathing)"),
    ("Homa", "Homa (Fire Ritual)"),
    ("Bhajan", "Bhajan (Devotional Singing)"),
    ("Yagna", "Yagna (Vedic Sacrifice)"),
    ("Vrata", "Vrata (Vow Observance)"),
    ("Jatra", "Jatra (Festival Procession)"),
    ("ChariotProcession", "Chariot Procession"),
    ("MaskedPerformance", "Masked Performance"),
    ("RitualConsecration", "Ritual Consecration"),
    ("ProcessionRitual", "Procession Ritual"),
    ("InstallationRitual", "Installation Ritual"),
    ("DeinstallationRitual", "Deinstallation Ritual"),
    ("ReturningRitual", "Returning Ritual"),
    ("Circumambulation", "Circumambulation"),
    ("RelicTour", "Relic Tour"),
    ("ProcessionalMovement", "Processional Movement"),
    ("Other", "Other"),
]


class Deity(MetaData):
    """Divine conceptual entity — Hindu, Buddhist, or syncretic."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    religious_tradition = models.CharField(max_length=100, blank=True)
    alternate_names = models.TextField(blank=True, help_text="Comma-separated")
    note = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = "Deities"

    def __str__(self):
        return self.name


class Guthi(MetaData):
    """Endowed trust organization managing temples, rituals, and land."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    guthi_type = models.CharField(max_length=30, choices=GUTHI_TYPE_CHOICES)
    location = models.CharField(max_length=200, blank=True)
    managed_structures = models.TextField(blank=True, help_text="Comma-separated")
    note = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = "Guthis"

    def __str__(self):
        return self.name


class ArchitecturalStructure(MetaData):
    """Physical heritage structure — temple, stupa, dhara, etc."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    structure_type = models.CharField(max_length=30, choices=STRUCTURE_TYPE_CHOICES)
    architectural_style = models.CharField(
        max_length=30, choices=ARCHITECTURAL_STYLE_CHOICES, blank=True
    )
    construction_date = models.CharField(max_length=100, blank=True, validators=[validate_edtf])
    location_name = models.CharField(max_length=200, blank=True)
    coordinates_legacy = models.CharField(
        max_length=50, blank=True, help_text="Legacy 'Lat, Long' string — use point field instead"
    )
    if GIS_AVAILABLE:
        point = gis_models.PointField(
            geography=True, srid=4326, null=True, blank=True,
            help_text="Geographic point (longitude, latitude) — WGS84"
        )
    else:
        point = models.CharField(
            max_length=50,
            blank=True,
            default="",
            help_text=(
                "Geographic point (longitude, latitude). "
                "Requires GDAL for spatial queries."
            ),
        )
    existence_status = models.CharField(
        max_length=30, choices=EXISTENCE_STATUS_CHOICES, blank=True
    )
    condition = models.CharField(
        max_length=20, choices=CONDITION_TYPE_CHOICES, blank=True
    )
    note = models.TextField(blank=True)
    has_current_location = models.ForeignKey(
        "Location",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="structures_here",
        help_text="Current place / location (registry: has_current_location / crm:P55)",
    )

    def __str__(self):
        return self.name


class RitualEvent(MetaData):
    """Intentional ritual activity — puja, homa, jatra, etc."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    ritual_type = models.CharField(max_length=30, choices=RITUAL_TYPE_CHOICES)
    date = models.CharField(max_length=100, blank=True)
    recurrence_pattern = models.CharField(max_length=100, blank=True)
    lunar_date_tithi = models.CharField(max_length=100, blank=True)
    performed_by = models.CharField(max_length=200, blank=True)
    location_name = models.CharField(max_length=200, blank=True)
    route_description = models.TextField(blank=True)
    start_place = models.CharField(max_length=200, blank=True)
    end_place = models.CharField(max_length=200, blank=True)
    note = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Festival(MetaData):
    """Large-scale community ritual — Jatra, chariot festival, masked dance."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    festival_type = models.CharField(max_length=30, blank=True)
    date = models.CharField(max_length=100, blank=True)
    duration = models.CharField(max_length=100, blank=True)
    location_name = models.CharField(max_length=200, blank=True)
    route_description = models.TextField(blank=True)
    note = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Production(MetaData):
    """E12 Production — creation of a heritage object or structure."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    produced_object = models.ForeignKey(
        "ArchitecturalStructure",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="production_events",
    )
    carried_out_by = models.CharField(max_length=300, blank=True)
    took_place_at = models.ForeignKey(
        "Location",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="production_events",
    )
    date_earliest = models.CharField(max_length=100, blank=True, validators=[validate_edtf])
    date_latest = models.CharField(max_length=100, blank=True, validators=[validate_edtf])
    note = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Consecration(MetaData):
    """Ritual activation of a sacred object (Prana Pratistha, etc.)."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    consecrated_object = models.ForeignKey(
        "IconographicObject",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="consecration_events",
    )
    carried_out_by = models.CharField(max_length=300, blank=True)
    took_place_at = models.ForeignKey(
        "Location",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="consecration_events",
    )
    makes_deity_present = models.CharField(max_length=200, blank=True)
    date_earliest = models.CharField(max_length=100, blank=True, validators=[validate_edtf])
    date_latest = models.CharField(max_length=100, blank=True, validators=[validate_edtf])
    note = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Enshrinement(MetaData):
    """Installation of a deity representation in a sanctum."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    enshrined_deity = models.ForeignKey(
        "Deity",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="enshrinement_events",
    )
    enshrined_in_structure = models.ForeignKey(
        "ArchitecturalStructure",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="enshrinement_events",
    )
    carried_out_by = models.CharField(max_length=300, blank=True)
    date_earliest = models.CharField(max_length=100, blank=True, validators=[validate_edtf])
    date_latest = models.CharField(max_length=100, blank=True, validators=[validate_edtf])
    note = models.TextField(blank=True)

    def __str__(self):
        return self.name


class TransferOfCustody(MetaData):
    """E10 Transfer of Custody — stewardship change."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    transferred_object = models.ForeignKey(
        "ArchitecturalStructure",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="custody_transfers",
    )
    transferred_from_actor = models.CharField(max_length=300, blank=True)
    transferred_to_actor = models.CharField(max_length=300, blank=True)
    transferred_to_guthi = models.ForeignKey(
        "Guthi",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="custody_receipts",
    )
    took_place_at = models.ForeignKey(
        "Location",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="custody_transfers",
    )
    date_earliest = models.CharField(max_length=100, blank=True, validators=[validate_edtf])
    date_latest = models.CharField(max_length=100, blank=True, validators=[validate_edtf])
    note = models.TextField(blank=True)

    def __str__(self):
        return self.name


class IconographicObject(MetaData):
    """Sacred visual art — Paubha, Murti, etc."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    object_type = models.CharField(max_length=30, blank=True)
    depicts_deity = models.CharField(max_length=200, blank=True)
    creation_date = models.CharField(max_length=100, blank=True)
    technique = models.CharField(max_length=200, blank=True)
    location_name = models.CharField(max_length=200, blank=True)
    note = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Monument(MetaData):
    """Buddhist sacred structure — Stupa, Chaitya."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    monument_type = models.CharField(max_length=30, blank=True)
    construction_date = models.CharField(max_length=100, blank=True)
    location_name = models.CharField(max_length=200, blank=True)
    coordinates_legacy = models.CharField(
        max_length=50, blank=True, help_text="Legacy 'Lat, Long' string — use point field instead"
    )
    if GIS_AVAILABLE:
        point = gis_models.PointField(
            geography=True, srid=4326, null=True, blank=True,
            help_text="Geographic point (longitude, latitude) — WGS84"
        )
    else:
        point = models.CharField(
            max_length=50,
            blank=True,
            default="",
            help_text=(
                "Geographic point (longitude, latitude). "
                "Requires GDAL for spatial queries."
            ),
        )
    existence_status = models.CharField(
        max_length=30, choices=EXISTENCE_STATUS_CHOICES, blank=True
    )
    note = models.TextField(blank=True)

    def __str__(self):
        return self.name


# =====================================================================
# ADDITIONAL ONTOLOGY-DRIVEN MODELS
# =====================================================================

SYNCRETIC_TYPE_CHOICES = [
    ("Equivalence", "Equivalence"),
    ("Appropriation", "Appropriation"),
    ("Fusion", "Fusion"),
    ("Historical", "Historical"),
]


class KumariTenure(MetaData):
    """Time-bounded role where a person embodies a deity as Living Goddess."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    had_participant = models.CharField(max_length=200, blank=True)
    embodied_deity = models.CharField(max_length=200, blank=True)
    residence_structure = models.CharField(max_length=200, blank=True)
    date_earliest = models.CharField(max_length=100, blank=True, validators=[validate_edtf])
    date_latest = models.CharField(max_length=100, blank=True, validators=[validate_edtf])
    supported_by_institution = models.TextField(blank=True)
    note = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = "Kumari Tenures"
        db_table = "kumari_tenure"

    def __str__(self):
        return self.name


class KumariSelection(MetaData):
    """Tantric ritual process of selecting a new Living Goddess."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    selected_person = models.CharField(max_length=200, blank=True)
    initiated_tenure = models.CharField(max_length=200, blank=True)
    selection_criteria_met = models.TextField(blank=True)
    date_earliest = models.CharField(max_length=100, blank=True, validators=[validate_edtf])
    took_place_at = models.CharField(max_length=200, blank=True)
    note = models.TextField(blank=True)

    class Meta:
        db_table = "kumari_selection"

    def __str__(self):
        return self.name


class KumariRetirement(MetaData):
    """Ritual event that formally ends a Living Goddess tenure."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    ended_tenure_of = models.CharField(max_length=200, blank=True)
    carried_out_by = models.CharField(max_length=200, blank=True)
    date_earliest = models.CharField(max_length=100, blank=True, validators=[validate_edtf])
    took_place_at = models.CharField(max_length=200, blank=True)
    note = models.TextField(blank=True)

    class Meta:
        db_table = "kumari_retirement"

    def __str__(self):
        return self.name


class SyncreticRelationship(MetaData):
    """Syncretic equivalence between divine entities across traditions."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    assigned_to_deity = models.CharField(max_length=200, blank=True)
    assigned_equivalent = models.TextField(blank=True)
    syncretic_type = models.CharField(
        max_length=30, choices=SYNCRETIC_TYPE_CHOICES, blank=True
    )
    documented_in_source = models.CharField(max_length=200, blank=True)
    note = models.TextField(blank=True)

    class Meta:
        db_table = "syncretic_relationship"

    def __str__(self):
        return self.name


class CasteGroup(MetaData):
    """Hereditary social group (Jati) with specific ritual roles."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    traditional_role = models.CharField(max_length=200, blank=True)
    note = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = "Caste Groups"
        db_table = "caste_group"

    def __str__(self):
        return self.name


class CalendarSystem(MetaData):
    """Calendar reckoning system with conversion rules."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    epoch_date_gregorian = models.CharField(max_length=100, blank=True)
    year_offset_from_gregorian = models.IntegerField(null=True, blank=True)
    is_primary_for_tradition = models.CharField(max_length=50, blank=True)
    note = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = "Calendar Systems"
        db_table = "calendar_system"

    def __str__(self):
        return self.name


# =====================================================================
# PROVENANCE MODELS — HeritageAssertion + DataSource (PROV-O aligned)
# =====================================================================

CONFIDENCE_CHOICES = [
    ("certain", "Certain"),
    ("likely", "Likely"),
    ("uncertain", "Uncertain"),
    ("speculative", "Speculative"),
]

RECONCILIATION_STATUS_CHOICES = [
    ("pending", "Pending Review"),
    ("accepted", "Accepted"),
    ("disputed", "Disputed"),
    ("superseded", "Superseded"),
]

SOURCE_CATEGORY_CHOICES = [
    ("archival", "Archival Record"),
    ("field_survey", "Field Survey"),
    ("oral_history", "Oral History"),
    ("published", "Published Source"),
    ("inscription", "Inscription"),
    ("web", "Web Resource"),
]


class DataSource(models.Model):
    """
    Original source from which heritage information was derived.
    CIDOC: E73_Information_Object | PROV-O: prov:Entity
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=300, help_text="Title of the source")
    source_type = models.CharField(
        max_length=30,
        choices=SOURCE_CATEGORY_CHOICES,
        help_text="Category of this source",
    )
    citation = models.TextField(blank=True, help_text="Formal citation text")
    url = models.URLField(
        max_length=500, blank=True, help_text="Digital location of source"
    )
    author = models.CharField(
        max_length=300, blank=True, help_text="Author(s) of the source"
    )
    publication_year = models.CharField(
        max_length=20, blank=True, help_text="Year of publication"
    )
    language = models.CharField(
        max_length=50,
        blank=True,
        help_text="Language of the source (e.g., Nepali, Newari, English)",
    )
    note = models.TextField(blank=True)
    iiif_manifest_url = models.URLField(
        max_length=500,
        blank=True,
        help_text="IIIF Presentation 3 manifest URL (CRMdig/Digital resource)",
    )
    digitization_activity = models.CharField(
        max_length=300,
        blank=True,
        help_text="Label for digitization or scanning activity",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Data Source"
        verbose_name_plural = "Data Sources"

    def __str__(self):
        return self.name


class RelationshipPredicate(models.Model):
    """Controlled vocabulary for relationship.* assertions (spec 007)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.SlugField(max_length=64, unique=True, db_index=True)
    label = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "relationship_predicate"
        ordering = ["sort_order", "label"]

    def __str__(self) -> str:
        return self.label


class EntityCluster(models.Model):
    """
    Stable identity anchor: one cluster per real-world referent within a type_scope
    (Django ContentType.model string). Membership is derived from HeritageAssertion
    rows with asserted_property identity.same_referent and entity_cluster set.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    canonical_label = models.CharField(max_length=500)
    type_scope = models.CharField(
        max_length=100,
        help_text="Django model name for subjects (e.g. person, location)",
    )
    locked = models.BooleanField(default=False)
    note = models.TextField(blank=True)
    version = models.PositiveIntegerField(default=0)
    merged_into = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="merged_from_clusters",
    )
    curated_aliases = models.JSONField(
        default=list,
        blank=True,
        help_text="Curated surface aliases (not membership claims; see HeritageAssertion identity.same_referent).",
    )
    external_identifiers = models.JSONField(
        default=dict,
        blank=True,
        help_text="LOD map e.g. {'wikidata': 'Q123'} — informational unless validated downstream.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "entity_cluster"
        indexes = [
            models.Index(fields=["type_scope", "locked"]),
            models.Index(fields=["merged_into"]),
        ]

    def __str__(self) -> str:
        return f"{self.canonical_label} ({self.type_scope})"


class ClusterAuditEvent(models.Model):
    """Append-only audit trail for merge, split, lock, unlock, and override actions."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    action = models.CharField(max_length=40, choices=CLUSTER_AUDIT_ACTION_CHOICES)
    actor = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="cluster_audit_events",
    )
    reason = models.TextField(blank=True)
    before_state = models.JSONField(default=dict)
    after_state = models.JSONField(default=dict)
    affected_cluster_ids = models.JSONField(default=list)
    affected_assertion_ids = models.JSONField(default=list)
    related_cluster = models.ForeignKey(
        EntityCluster,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_events",
        help_text="Primary cluster this audit row is anchored to (for list filtering).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "cluster_audit_event"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.action} @ {self.created_at:%Y-%m-%d}"


IDENTITY_CANDIDATE_STATUS_CHOICES = [
    ("open", "Open"),
    ("accepted", "Accepted"),
    ("rejected", "Rejected"),
    ("deferred", "Deferred"),
]


class IdentityResolutionCandidate(models.Model):
    """Rule-based suggestion for reviewer identity workspace (US4)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    left_content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        related_name="identity_candidates_left",
    )
    left_object_id = models.PositiveIntegerField()
    right_content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        related_name="identity_candidates_right",
    )
    right_object_id = models.PositiveIntegerField()
    signal_scores = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=20,
        choices=IDENTITY_CANDIDATE_STATUS_CHOICES,
        default="open",
    )
    notes = models.TextField(blank=True)
    resolved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_identity_candidates",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "identity_resolution_candidate"
        indexes = [
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"Candidate {self.left_object_id}/{self.right_object_id} ({self.status})"


class HeritageAssertion(models.Model):
    """
    First-class reified statement (subject, predicate, value) with provenance.

    Long-term target (MR2): treat this as the canonical *relationship* record for
    n-ary CIDOC events and reviewer-grade curation—not only a provenance sidecar.
    Each accepted contribution should map to one or more assertions; inverse
    properties and symmetric relations can be materialized from this table.

    CIDOC: crminf:I2_Belief | PROV-O: prov:Entity
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # What entity is this assertion about? (generic FK, nullable for standalone assertions)
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Type of the entity this assertion is about",
    )
    object_id = models.PositiveIntegerField(
        null=True, blank=True, help_text="ID of the entity this assertion is about"
    )
    asserts_about = GenericForeignKey("content_type", "object_id")

    object_content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="+",
        help_text="For relationship.* assertions: type of the object entity",
    )
    object_object_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="For relationship.* assertions: PK of the object entity",
    )
    asserts_object = GenericForeignKey("object_content_type", "object_object_id")

    entity_cluster = models.ForeignKey(
        EntityCluster,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="membership_assertions",
        help_text="Set for identity.same_referent membership rows",
    )

    # What property/value is being asserted
    asserted_property = models.CharField(
        max_length=100,
        blank=True,
        help_text="The property being asserted (e.g., 'construction_date')",
    )
    asserted_value = models.TextField(blank=True, help_text="The value being asserted")
    assertion_content = models.TextField(
        blank=True, help_text="Free-text description of the assertion"
    )

    # Provenance
    source = models.ForeignKey(
        DataSource,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assertions",
        help_text="Source supporting this assertion",
    )
    source_citation = models.TextField(
        blank=True, help_text="Inline citation if no separate DataSource record"
    )
    temporal_scope_edtf = models.CharField(
        max_length=255,
        blank=True,
        help_text="Optional EDTF or human-readable temporal scope for relationship rows",
    )
    supporting_sources = models.ManyToManyField(
        DataSource,
        blank=True,
        related_name="supporting_for_assertions",
        help_text="Additional sources beyond primary `source` FK",
    )
    contributed_by = models.CharField(
        max_length=255, blank=True, help_text="Email or name of the contributor"
    )
    confidence = models.CharField(
        max_length=20,
        choices=CONFIDENCE_CHOICES,
        default="likely",
        help_text="Contributor's confidence in this claim",
    )
    data_quality_note = models.TextField(
        blank=True, help_text="Notes on data quality or limitations"
    )
    justification_note = models.TextField(
        blank=True,
        help_text="CRMinf-style justification or reasoning chain summary",
    )
    crminf_conclusion = models.CharField(
        max_length=64,
        blank=True,
        help_text="Optional CRMinf conclusion code (e.g. confirmed, refuted)",
    )

    # Agent pipeline fields (populated by Agent 2; null for human contributions)
    confidence_score = models.DecimalField(
        max_digits=4,
        decimal_places=3,
        null=True,
        blank=True,
        help_text="Numeric confidence from dual-temperature extraction (0.000–1.000)",
    )
    attributed_to_agent = models.CharField(
        max_length=200,
        blank=True,
        help_text="LLM agent identifier that produced this assertion (e.g. 'ollama/llama3.1:70b')",
    )

    # Moderation
    reconciliation_status = models.CharField(
        max_length=20,
        choices=RECONCILIATION_STATUS_CHOICES,
        default="pending",
        help_text="Review status of this assertion",
    )
    supersedes = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="superseded_by",
        help_text="Previous assertion this one replaces",
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self) -> None:
        super().clean()
        from .assertion_validation import validate_relationship_assertion
        from .identity_validation import validate_membership_assertion

        validate_membership_assertion(self)
        validate_relationship_assertion(self)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Heritage Assertion"
        verbose_name_plural = "Heritage Assertions"
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
            models.Index(fields=["object_content_type", "object_object_id"]),
            models.Index(fields=["reconciliation_status"]),
            models.Index(fields=["confidence"]),
            models.Index(fields=["asserted_property", "entity_cluster"]),
        ]

    def __str__(self):
        if self.content_type_id:
            return f"Assertion on {self.content_type.model}#{self.object_id}: {self.asserted_property}"
        return f"Assertion {self.pk}: {self.asserted_property}"


class EntityRef(models.Model):
    """
    Normalized ontology relation edge (referrer → target) for graph APIs and indexing.

    Populated from legacy CharField relation columns via migration / management commands.
    """

    from_content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        related_name="cidoc_entityref_from_set",
    )
    from_object_id = models.PositiveIntegerField()
    from_object = GenericForeignKey("from_content_type", "from_object_id")

    predicate = models.CharField(
        max_length=200,
        db_index=True,
        help_text="ORM field name used for this reference",
    )

    to_content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        related_name="cidoc_entityref_to_set",
    )
    to_object_id = models.PositiveIntegerField()
    to_object = GenericForeignKey("to_content_type", "to_object_id")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "cidoc_entityref"
        indexes = [
            models.Index(fields=["to_content_type", "to_object_id"]),
            models.Index(fields=["from_content_type", "from_object_id"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "from_content_type",
                    "from_object_id",
                    "predicate",
                    "to_content_type",
                    "to_object_id",
                ],
                name="cidoc_entityref_unique_edge",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"{self.from_content_type_id}:{self.from_object_id}"
            f" -{self.predicate}-> {self.to_content_type_id}:{self.to_object_id}"
        )


class Tenant(models.Model):
    """Optional multi-tenant scope (004-yaml-driven-schema); single-tenant uses null FK."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cidoc_tenant"
        verbose_name_plural = "Tenants"

    def __str__(self) -> str:
        return self.name


class SchemaRegistry(models.Model):
    """Last materialized ontology registry JSON for cold start / degraded mode."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="schema_rows",
    )
    schema_version = models.CharField(max_length=64, db_index=True)
    core_hash = models.CharField(max_length=64, blank=True)
    extension_hash = models.CharField(max_length=64, blank=True, null=True)
    registry_json = models.JSONField()
    jsonschema_blob = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cidoc_schema_registry"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"SchemaRegistry {self.schema_version[:12]}…"


class DynamicOntologyEntity(models.Model):
    """Extension-class entities without a typed Django model (tenant-scoped)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="dynamic_entities",
    )
    class_key = models.CharField(max_length=100, db_index=True)
    class_uri = models.CharField(max_length=500, blank=True)
    uri = models.CharField(max_length=500)
    data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cidoc_dynamic_ontology_entity"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "uri"],
                name="cidoc_dynamic_entity_tenant_uri_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.class_key}:{self.uri}"


# =====================================================================
# Add GenericRelation to existing models for assertion access
# =====================================================================

# Patch assertions onto all heritage models
for _model in [
    ArchitecturalStructure,
    RitualEvent,
    Festival,
    IconographicObject,
    Monument,
    Deity,
    Guthi,
    Person,
    Location,
    Event,
    HistoricalPeriod,
    Tradition,
    Source,
    KumariTenure,
    KumariSelection,
    KumariRetirement,
    SyncreticRelationship,
    CasteGroup,
    CalendarSystem,
]:
    if not hasattr(_model, "assertions"):
        GenericRelation(
            HeritageAssertion,
            content_type_field="content_type",
            object_id_field="object_id",
        ).contribute_to_class(_model, "assertions")


# class Artifact(models.Model):
#     id = models.AutoField(primary_key=True)  # Added unique ID
#     name = models.CharField(max_length=200)
#     aliases = models.TextField(blank=True, help_text="Comma-separated alternative names")
#     description = models.TextField()
#     material = models.CharField(max_length=100)
#     size = models.CharField(max_length=100, help_text="Dimensions (H x W x D)")
#     weight = models.CharField(max_length=50, blank=True)
#     date_created = models.CharField(max_length=100, help_text="e.g., '17th century'")
#     condition = models.CharField(max_length=20, choices=ARTIFACT_CONDITION_CHOICES)
#     status = models.CharField(max_length=20, choices=ARTIFACT_STATUS_CHOICES)
#     digital_representation = models.URLField(max_length=500, blank=True, help_text="Link to image/3D model")

#     creator = models.ForeignKey(
#         Person,
#         on_delete=models.SET_NULL,
#         null=True,
#         blank=True,
#         related_name='created_artifacts'
#     )
#     origin_location = models.ForeignKey(
#         Location,
#         on_delete=models.SET_NULL,
#         null=True,
#         blank=True,
#         related_name='artifacts_originated'
#     )
#     historical_period = models.ForeignKey(
#         HistoricalPeriod,
#         on_delete=models.SET_NULL,
#         null=True,
#         blank=True,
#         related_name='artifacts'
#     )
#     associated_events = models.ManyToManyField(
#         'Event',
#         blank=True,
#         related_name='associated_artifacts'
#     )
#     documentation_sources = models.ManyToManyField(
#         'Source',
#         blank=True,
#         related_name='documented_artifacts'
#     )

#     def __str__(self):
#         return self.name


# # Revision tables
# class HistoricalPeriodRevision(models.Model):
#     revision_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(HistoricalPeriod, on_delete=models.CASCADE, help_text="Original HistoricalPeriod record")
#     prev_uid = models.IntegerField(null=True, blank=True, help_text="ID of the previous revision record")
#     snapshot = models.JSONField(help_text="JSON representation of the HistoricalPeriod record at this revision")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the change")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When this revision was created")
#     action = models.CharField(max_length=20, choices=[('create', 'Create'), ('update', 'Update'), ('delete', 'Delete')])

#     def __str__(self):
#         return f"Revision {self.revision_id} for HistoricalPeriod {self.uid.id}"


# class LocationRevision(models.Model):
#     revision_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(Location, on_delete=models.CASCADE, help_text="Original Location record")
#     prev_uid = models.IntegerField(null=True, blank=True, help_text="ID of the previous revision record")
#     snapshot = models.JSONField(help_text="JSON representation of the Location record at this revision")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the change")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When this revision was created")
#     action = models.CharField(max_length=20, choices=[('create', 'Create'), ('update', 'Update'), ('delete', 'Delete')])

#     def __str__(self):
#         return f"Revision {self.revision_id} for Location {self.uid.id}"


# class PersonRevision(models.Model):
#     revision_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(Person, on_delete=models.CASCADE, help_text="Original Person record")
#     prev_uid = models.IntegerField(null=True, blank=True, help_text="ID of the previous revision record")
#     snapshot = models.JSONField(help_text="JSON representation of the Person record at this revision")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the change")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When this revision was created")
#     action = models.CharField(max_length=20, choices=[('create', 'Create'), ('update', 'Update'), ('delete', 'Delete')])

#     def __str__(self):
#         return f"Revision {self.revision_id} for Person {self.uid.id}"


# class ArtifactRevision(models.Model):
#     revision_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(Artifact, on_delete=models.CASCADE, help_text="Original Artifact record")
#     prev_uid = models.IntegerField(null=True, blank=True, help_text="ID of the previous revision record")
#     snapshot = models.JSONField(help_text="JSON representation of the Artifact record at this revision")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the change")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When this revision was created")
#     action = models.CharField(max_length=20, choices=[('create', 'Create'), ('update', 'Update'), ('delete', 'Delete')])

#     def __str__(self):
#         return f"Revision {self.revision_id} for Artifact {self.uid.id}"


# class EventRevision(models.Model):
#     revision_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(Event, on_delete=models.CASCADE, help_text="Original Event record")
#     prev_uid = models.IntegerField(null=True, blank=True, help_text="ID of the previous revision record")
#     snapshot = models.JSONField(help_text="JSON representation of the Event record at this revision")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the change")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When this revision was created")
#     action = models.CharField(max_length=20, choices=[('create', 'Create'), ('update', 'Update'), ('delete', 'Delete')])

#     def __str__(self):
#         return f"Revision {self.revision_id} for Event {self.uid.id}"


# class TraditionRevision(models.Model):
#     revision_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(Tradition, on_delete=models.CASCADE, help_text="Original Tradition record")
#     prev_uid = models.IntegerField(null=True, blank=True, help_text="ID of the previous revision record")
#     snapshot = models.JSONField(help_text="JSON representation of the Tradition record at this revision")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the change")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When this revision was created")
#     action = models.CharField(max_length=20, choices=[('create', 'Create'), ('update', 'Update'), ('delete', 'Delete')])

#     def __str__(self):
#         return f"Revision {self.revision_id} for Tradition {self.uid.id}"


# class SourceRevision(models.Model):
#     revision_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(Source, on_delete=models.CASCADE, help_text="Original Source record")
#     prev_uid = models.IntegerField(null=True, blank=True, help_text="ID of the previous revision record")
#     snapshot = models.JSONField(help_text="JSON representation of the Source record at this revision")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the change")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When this revision was created")
#     action = models.CharField(max_length=20, choices=[('create', 'Create'), ('update', 'Update'), ('delete', 'Delete')])

#     def __str__(self):
#         return f"Revision {self.revision_id} for Source {self.uid.id}"


# # Activity class
# class Activity(models.Model):
#     activity_id = models.AutoField(primary_key=True)
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who performed the activity")
#     post_uid = models.IntegerField(help_text="ID of the post or revision the activity was done on")
#     activity_type = models.CharField(max_length=50, help_text="Type of activity (comment, revision, etc.)")
#     previous_activity = models.IntegerField(null=True, blank=True, help_text="ID of the previous activity in the chain")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When the activity was performed")
#     details = models.JSONField(help_text="Additional details about the activity")

#     def __str__(self):
#         return f"Activity {self.activity_id} by User {self.user.id}"


# # CidocComment classes for each table
# class HistoricalPeriodComment(models.Model):
#     comment_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(HistoricalPeriod, on_delete=models.CASCADE, help_text="ID of the HistoricalPeriod record being commented on")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the comment")
#     activity_id = models.ForeignKey(Activity, on_delete=models.CASCADE, help_text="Activity record associated with this comment")
#     previous_comment_id = models.IntegerField(null=True, blank=True, help_text="ID of the previous comment in the thread")
#     comment = models.TextField(help_text="The comment text")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When the comment was made")

#     def __str__(self):
#         return f"Comment {self.comment_id} on HistoricalPeriod {self.uid.id}"


# class LocationComment(models.Model):
#     comment_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(Location, on_delete=models.CASCADE, help_text="ID of the Location record being commented on")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the comment")
#     activity_id = models.ForeignKey(Activity, on_delete=models.CASCADE, help_text="Activity record associated with this comment")
#     previous_comment_id = models.IntegerField(null=True, blank=True, help_text="ID of the previous comment in the thread")
#     comment = models.TextField(help_text="The comment text")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When the comment was made")

#     def __str__(self):
#         return f"Comment {self.comment_id} on Location {self.uid.id}"


# class PersonComment(models.Model):
#     comment_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(Person, on_delete=models.CASCADE, help_text="ID of the Person record being commented on")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the comment")
#     activity_id = models.ForeignKey(Activity, on_delete=models.CASCADE, help_text="Activity record associated with this comment")
#     previous_comment_id = models.IntegerField(null=True, blank=True, help_text="ID of the previous comment in the thread")
#     comment = models.TextField(help_text="The comment text")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When the comment was made")

#     def __str__(self):
#         return f"Comment {self.comment_id} on Person {self.uid.id}"


# class ArtifactComment(models.Model):
#     comment_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(Artifact, on_delete=models.CASCADE, help_text="ID of the Artifact record being commented on")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the comment")
#     activity_id = models.ForeignKey(Activity, on_delete=models.CASCADE, help_text="Activity record associated with this comment")
#     previous_comment_id = models.IntegerField(null=True, blank=True, help_text="ID of the previous comment in the thread")
#     comment = models.TextField(help_text="The comment text")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When the comment was made")

#     def __str__(self):
#         return f"Comment {self.comment_id} on Artifact {self.uid.id}"


# class EventComment(models.Model):
#     comment_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(Event, on_delete=models.CASCADE, help_text="ID of the Event record being commented on")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the comment")
#     activity_id = models.ForeignKey(Activity, on_delete=models.CASCADE, help_text="Activity record associated with this comment")
#     previous_comment_id = models.IntegerField(null=True, blank=True, help_text="ID of the previous comment in the thread")
#     comment = models.TextField(help_text="The comment text")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When the comment was made")

#     def __str__(self):
#         return f"Comment {self.comment_id} on Event {self.uid.id}"


# class TraditionComment(models.Model):
#     comment_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(Tradition, on_delete=models.CASCADE, help_text="ID of the Tradition record being commented on")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the comment")
#     activity_id = models.ForeignKey(Activity, on_delete=models.CASCADE, help_text="Activity record associated with this comment")
#     previous_comment_id = models.IntegerField(null=True, blank=True, help_text="ID of the previous comment in the thread")
#     comment = models.TextField(help_text="The comment text")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When the comment was made")

#     def __str__(self):
#         return f"Comment {self.comment_id} on Tradition {self.uid.id}"


# class SourceComment(models.Model):
#     comment_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(Source, on_delete=models.CASCADE, help_text="ID of the Source record being commented on")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the comment")
#     activity_id = models.ForeignKey(Activity, on_delete=models.CASCADE, help_text="Activity record associated with this comment")
#     previous_comment_id = models.IntegerField(null=True, blank=True, help_text="ID of the previous comment in the thread")
#     comment = models.TextField(help_text="The comment text")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When the comment was made")

#     def __str__(self):
#         return f"Comment {self.comment_id} on Source {self.uid.id}"


# # CidocComment classes for each revision table
# class HistoricalPeriodRevisionComment(models.Model):
#     comment_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(HistoricalPeriodRevision, on_delete=models.CASCADE, help_text="ID of the HistoricalPeriodRevision record being commented on")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the comment")
#     activity_id = models.ForeignKey(Activity, on_delete=models.CASCADE, help_text="Activity record associated with this comment")
#     previous_comment_id = models.IntegerField(null=True, blank=True, help_text="ID of the previous comment in the thread")
#     comment = models.TextField(help_text="The comment text")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When the comment was made")

#     def __str__(self):
#         return f"Comment {self.comment_id} on HistoricalPeriodRevision {self.uid.revision_id}"


# class LocationRevisionComment(models.Model):
#     comment_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(LocationRevision, on_delete=models.CASCADE, help_text="ID of the LocationRevision record being commented on")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the comment")
#     activity_id = models.ForeignKey(Activity, on_delete=models.CASCADE, help_text="Activity record associated with this comment")
#     previous_comment_id = models.IntegerField(null=True, blank=True, help_text="ID of the previous comment in the thread")
#     comment = models.TextField(help_text="The comment text")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When the comment was made")

#     def __str__(self):
#         return f"Comment {self.comment_id} on LocationRevision {self.uid.revision_id}"


# class PersonRevisionComment(models.Model):
#     comment_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(PersonRevision, on_delete=models.CASCADE, help_text="ID of the PersonRevision record being commented on")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the comment")
#     activity_id = models.ForeignKey(Activity, on_delete=models.CASCADE, help_text="Activity record associated with this comment")
#     previous_comment_id = models.IntegerField(null=True, blank=True, help_text="ID of the previous comment in the thread")
#     comment = models.TextField(help_text="The comment text")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When the comment was made")

#     def __str__(self):
#         return f"Comment {self.comment_id} on PersonRevision {self.uid.revision_id}"


# class ArtifactRevisionComment(models.Model):
#     comment_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(ArtifactRevision, on_delete=models.CASCADE, help_text="ID of the ArtifactRevision record being commented on")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the comment")
#     activity_id = models.ForeignKey(Activity, on_delete=models.CASCADE, help_text="Activity record associated with this comment")
#     previous_comment_id = models.IntegerField(null=True, blank=True, help_text="ID of the previous comment in the thread")
#     comment = models.TextField(help_text="The comment text")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When the comment was made")

#     def __str__(self):
#         return f"Comment {self.comment_id} on ArtifactRevision {self.uid.revision_id}"


# class EventRevisionComment(models.Model):
#     comment_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(EventRevision, on_delete=models.CASCADE, help_text="ID of the EventRevision record being commented on")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the comment")
#     activity_id = models.ForeignKey(Activity, on_delete=models.CASCADE, help_text="Activity record associated with this comment")
#     previous_comment_id = models.IntegerField(null=True, blank=True, help_text="ID of the previous comment in the thread")
#     comment = models.TextField(help_text="The comment text")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When the comment was made")

#     def __str__(self):
#         return f"Comment {self.comment_id} on EventRevision {self.uid.revision_id}"


# class TraditionRevisionComment(models.Model):
#     comment_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(TraditionRevision, on_delete=models.CASCADE, help_text="ID of the TraditionRevision record being commented on")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the comment")
#     activity_id = models.ForeignKey(Activity, on_delete=models.CASCADE, help_text="Activity record associated with this comment")
#     previous_comment_id = models.IntegerField(null=True, blank=True, help_text="ID of the previous comment in the thread")
#     comment = models.TextField(help_text="The comment text")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When the comment was made")

#     def __str__(self):
#         return f"Comment {self.comment_id} on TraditionRevision {self.uid.revision_id}"


# class SourceRevisionComment(models.Model):
#     comment_id = models.AutoField(primary_key=True)
#     uid = models.ForeignKey(SourceRevision, on_delete=models.CASCADE, help_text="ID of the SourceRevision record being commented on")
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User who made the comment")
#     activity_id = models.ForeignKey(Activity, on_delete=models.CASCADE, help_text="Activity record associated with this comment")
#     previous_comment_id = models.IntegerField(null=True, blank=True, help_text="ID of the previous comment in the thread")
#     comment = models.TextField(help_text="The comment text")
#     timestamp = models.DateTimeField(auto_now_add=True, help_text="When the comment was made")

#     def __str__(self):
#         return f"Comment {self.comment_id} on SourceRevision {self.uid.revision_id}"


# # NotificationForUser table
# class NotificationForUser(models.Model):
#     NOTIFICATION_TYPES = [
#         ('comment', 'Comment'),
#         ('revision', 'Revision'),
#         ('mention', 'Mention'),
#         ('artifact_update', 'Artifact Update'),
#         ('location_update', 'Location Update'),
#         ('event_update', 'Event Update'),
#         ('tradition_update', 'Tradition Update'),
#         ('source_update', 'Source Update'),
#         ('historical_period_update', 'Historical Period Update'),
#         ('system', 'System Notification'),
#         ('reminder', 'Reminder'),
#     ]

#     notification_id = models.AutoField(primary_key=True)
#     user = models.ForeignKey(User, on_delete=models.CASCADE, help_text="User receiving the notification")
#     notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPES, help_text="Type of notification")
#     related_object_id = models.IntegerField(help_text="ID of the related object (artifact, location, etc.)")
#     related_object_type = models.CharField(max_length=50, help_text="Type of the related object (artifact, location, etc.)")
#     message = models.TextField(help_text="Notification message content")
#     is_read = models.BooleanField(default=False, help_text="Whether the notification has been read")
#     created_at = models.DateTimeField(auto_now_add=True, help_text="When the notification was created")
#     activity_id = models.ForeignKey(Activity, on_delete=models.SET_NULL, null=True, blank=True, help_text="Associated activity that triggered the notification")
#     sender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_notifications', help_text="User who triggered the notification")

#     def __str__(self):
#         return f"Notification {self.notification_id} for User {self.user.username} - {self.notification_type}"

#     class Meta:
#         ordering = ['-created_at']
#         verbose_name = "User Notification"
#         verbose_name_plural = "User Notifications"
