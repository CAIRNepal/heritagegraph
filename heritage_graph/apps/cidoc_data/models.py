import uuid
from django.db import models
from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation
from django.contrib.contenttypes.models import ContentType

# Choice constants
ARTIFACT_CONDITION_CHOICES = [
    ('excellent', 'Excellent'),
    ('good', 'Good'),
    ('fair', 'Fair'),
    ('deteriorating', 'Deteriorating'),
    ('ruined', 'Ruined'),
]

ARTIFACT_STATUS_CHOICES = [
    ('on_display', 'On Display'),
    ('in_storage', 'In Storage'),
    ('on_loan', 'On Loan'),
    ('lost', 'Lost'),
    ('destroyed', 'Destroyed'),
]

LOCATION_TYPE_CHOICES = [
    ('temple', 'Temple'),
    ('monument', 'Monument'),
    ('city', 'City'),
    ('museum', 'Museum'),
    ('region', 'Region'),
    ('archaeological_site', 'Archaeological Site'),
]

LOCATION_STATUS_CHOICES = [
    ('preserved', 'Preserved'),
    ('partially_ruined', 'Partially Ruined'),
    ('ruined', 'Ruined'),
    ('rebuilt', 'Rebuilt'),
]

EVENT_TYPE_CHOICES = [
    ('festival', 'Festival'),
    ('ritual', 'Ritual'),
    ('historical', 'Historical Event'),
    ('ceremony', 'Ceremony'),
]

EVENT_RECURRENCE_CHOICES = [
    ('annual', 'Annual'),
    ('biennial', 'Biennial'),
    ('monthly', 'Monthly'),
    ('one_time', 'One-time'),
]

TRADITION_TYPE_CHOICES = [
    ('ritual', 'Ritual'),
    ('dance', 'Dance'),
    ('storytelling', 'Storytelling'),
    ('craft', 'Craft'),
    ('music', 'Music'),
]

SOURCE_TYPE_CHOICES = [
    ('book', 'Book'),
    ('journal', 'Journal Article'),
    ('archive', 'Archive Document'),
    ('thesis', 'Thesis'),
    ('web', 'Web Resource'),
    ('field_note', 'Field Notes'),
]

class MetaData(models.Model):
    """
    Shared metadata fields for all models.
    """
    title = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    contributor = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=50, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True

class Person(MetaData):
    """
    this class is supposed to take Actors class of CIDOC-CRM. Like Kings, Monks and others.
    """
    id = models.AutoField(primary_key=True)  # Added unique ID
    name = models.CharField(max_length=200)
    aliases = models.TextField(blank=True, help_text="Comma-separated alternative names")
    birth_date = models.CharField(max_length=50, blank=True)
    death_date = models.CharField(max_length=50, blank=True)
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
    ACTION_CHOICES = [
    ('create', 'Create'),
    ('update', 'Update'),
    ('delete', 'Delete')
    ]

    revision_id = models.AutoField(primary_key=True) 
    person = models.ForeignKey('Person', on_delete=models.CASCADE, related_name='revisions') 
    snapshot = models.JSONField(help_text="JSON snapshot of the Person object at this revision") 
    # user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, help_text="User who made the change") 
    user = models.CharField(max_length=255, blank=True, null=True)
    action = models.CharField(max_length=10, choices=ACTION_CHOICES) 
    timestamp = models.DateTimeField(default=timezone.now) 
    
    class Meta: 
        ordering = ['-timestamp'] 
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
    coordinates = models.CharField(max_length=50, blank=True, help_text="Lat, Long format")
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
    start_date = models.CharField(max_length=100, blank=True, help_text="e.g., 'Baisakh 15'")
    end_date = models.CharField(max_length=100, blank=True)
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
    start_year = models.CharField(max_length=20, help_text="e.g., 'c. 1200 BCE' or '1768'")
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
    associated_materials = models.TextField(blank=True, help_text="Tools, garments, instruments used")

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
    archive_location = models.CharField(max_length=200, blank=True, help_text="Physical archive location")

    def __str__(self):
        return self.title


# =====================================================================
# NEW ONTOLOGY-DRIVEN MODELS — from HeritageGraph.yaml
# =====================================================================

STRUCTURE_TYPE_CHOICES = [
    ('Temple', 'Temple'),
    ('Stupa', 'Stupa'),
    ('Chaitya', 'Chaitya'),
    ('Pati', 'Pati (Open Pavilion)'),
    ('Sattal', 'Sattal (Multi-story Rest House)'),
    ('Dharmashala', 'Dharmashala (Pilgrim Lodge)'),
    ('DhungeDhara', 'Dhunge Dhara (Stone Spout)'),
    ('Pokhari', 'Pokhari (Pond/Tank)'),
    ('Other', 'Other'),
]

ARCHITECTURAL_STYLE_CHOICES = [
    ('Pagoda', 'Pagoda'),
    ('Shikhara', 'Shikhara'),
    ('Stupa', 'Stupa'),
    ('Dome', 'Dome'),
    ('Mughal', 'Mughal'),
    ('Rana_Neoclassical', 'Rana Neoclassical'),
    ('Mixed', 'Mixed'),
    ('Other', 'Other'),
]

EXISTENCE_STATUS_CHOICES = [
    ('Extant', 'Extant'),
    ('Destroyed', 'Destroyed'),
    ('Damaged', 'Damaged'),
    ('Restored', 'Restored'),
    ('Partially_Extant', 'Partially Extant'),
    ('Relocated', 'Relocated'),
    ('Unknown', 'Unknown'),
]

CONDITION_TYPE_CHOICES = [
    ('Excellent', 'Excellent'),
    ('Good', 'Good'),
    ('Fair', 'Fair'),
    ('Poor', 'Poor'),
    ('Very_Poor', 'Very Poor'),
    ('Ruinous', 'Ruinous'),
]

GUTHI_TYPE_CHOICES = [
    ('Si_Guthi', 'Si Guthi (Death Ritual)'),
    ('Devi_Guthi', 'Devi Guthi (Deity Management)'),
    ('Nani_Guthi', 'Nani Guthi (Musical)'),
    ('Manka_Guthi', 'Manka Guthi (Agricultural)'),
    ('Raj_Guthi', 'Raj Guthi (Royal/State Endowed)'),
    ('Other', 'Other'),
]

RITUAL_TYPE_CHOICES = [
    ('Puja', 'Puja'),
    ('Homa', 'Homa (Fire Ritual)'),
    ('Diksha', 'Diksha (Initiation)'),
    ('Jatra', 'Jatra (Procession)'),
    ('Shraddha', 'Shraddha (Ancestral Rite)'),
    ('Other', 'Other'),
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
    architectural_style = models.CharField(max_length=30, choices=ARCHITECTURAL_STYLE_CHOICES, blank=True)
    construction_date = models.CharField(max_length=100, blank=True)
    location_name = models.CharField(max_length=200, blank=True)
    coordinates = models.CharField(max_length=50, blank=True, help_text="Lat, Long")
    existence_status = models.CharField(max_length=30, choices=EXISTENCE_STATUS_CHOICES, blank=True)
    condition = models.CharField(max_length=20, choices=CONDITION_TYPE_CHOICES, blank=True)
    note = models.TextField(blank=True)

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
    coordinates = models.CharField(max_length=50, blank=True, help_text="Lat, Long")
    existence_status = models.CharField(max_length=30, choices=EXISTENCE_STATUS_CHOICES, blank=True)
    note = models.TextField(blank=True)

    def __str__(self):
        return self.name


# =====================================================================
# PROVENANCE MODELS — HeritageAssertion + DataSource (PROV-O aligned)
# =====================================================================

CONFIDENCE_CHOICES = [
    ('certain', 'Certain'),
    ('likely', 'Likely'),
    ('uncertain', 'Uncertain'),
    ('speculative', 'Speculative'),
]

RECONCILIATION_STATUS_CHOICES = [
    ('pending', 'Pending Review'),
    ('accepted', 'Accepted'),
    ('disputed', 'Disputed'),
    ('superseded', 'Superseded'),
]

SOURCE_CATEGORY_CHOICES = [
    ('archival', 'Archival Record'),
    ('field_survey', 'Field Survey'),
    ('oral_history', 'Oral History'),
    ('published', 'Published Source'),
    ('inscription', 'Inscription'),
    ('web', 'Web Resource'),
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
        help_text="Category of this source"
    )
    citation = models.TextField(
        blank=True,
        help_text="Formal citation text"
    )
    url = models.URLField(
        max_length=500,
        blank=True,
        help_text="Digital location of source"
    )
    author = models.CharField(
        max_length=300,
        blank=True,
        help_text="Author(s) of the source"
    )
    publication_year = models.CharField(
        max_length=20,
        blank=True,
        help_text="Year of publication"
    )
    language = models.CharField(
        max_length=50,
        blank=True,
        help_text="Language of the source (e.g., Nepali, Newari, English)"
    )
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Data Source"
        verbose_name_plural = "Data Sources"

    def __str__(self):
        return self.name


class HeritageAssertion(models.Model):
    """
    A single factual claim about a heritage entity, with explicit
    source, author, date, and confidence. Every contribution creates
    one or more assertions.

    CIDOC: crminf:I2_Belief | PROV-O: prov:Entity
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # What entity is this assertion about? (generic FK)
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        help_text="Type of the entity this assertion is about"
    )
    object_id = models.PositiveIntegerField(
        help_text="ID of the entity this assertion is about"
    )
    asserts_about = GenericForeignKey('content_type', 'object_id')

    # What property/value is being asserted
    asserted_property = models.CharField(
        max_length=100,
        blank=True,
        help_text="The property being asserted (e.g., 'construction_date')"
    )
    asserted_value = models.TextField(
        blank=True,
        help_text="The value being asserted"
    )
    assertion_content = models.TextField(
        blank=True,
        help_text="Free-text description of the assertion"
    )

    # Provenance
    source = models.ForeignKey(
        DataSource,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assertions',
        help_text="Source supporting this assertion"
    )
    source_citation = models.TextField(
        blank=True,
        help_text="Inline citation if no separate DataSource record"
    )
    contributed_by = models.CharField(
        max_length=255,
        blank=True,
        help_text="Email or name of the contributor"
    )
    confidence = models.CharField(
        max_length=20,
        choices=CONFIDENCE_CHOICES,
        default='likely',
        help_text="Contributor's confidence in this claim"
    )
    data_quality_note = models.TextField(
        blank=True,
        help_text="Notes on data quality or limitations"
    )

    # Moderation
    reconciliation_status = models.CharField(
        max_length=20,
        choices=RECONCILIATION_STATUS_CHOICES,
        default='pending',
        help_text="Review status of this assertion"
    )
    supersedes = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='superseded_by',
        help_text="Previous assertion this one replaces"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Heritage Assertion"
        verbose_name_plural = "Heritage Assertions"
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['reconciliation_status']),
            models.Index(fields=['confidence']),
        ]

    def __str__(self):
        return f"Assertion on {self.content_type.model}#{self.object_id}: {self.asserted_property}"


# =====================================================================
# Add GenericRelation to existing models for assertion access
# =====================================================================

# Patch assertions onto all heritage models
for _model in [
    ArchitecturalStructure, RitualEvent, Festival, IconographicObject,
    Monument, Deity, Guthi, Person, Location, Event, HistoricalPeriod,
    Tradition, Source,
]:
    if not hasattr(_model, 'assertions'):
        GenericRelation(
            HeritageAssertion,
            content_type_field='content_type',
            object_id_field='object_id',
        ).contribute_to_class(_model, 'assertions')


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