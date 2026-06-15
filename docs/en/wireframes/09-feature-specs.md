# Feature Specifications — All TODO Items

> Consolidated feature specs for every `[TODO]` item in `IMPLEMENTATION_PLAN.md`, ordered by milestone.
> Each spec is self-contained: a developer can pick it up and implement from this alone.

---

## Milestone 1 — Provenance Hardening

### SPEC-01: ORCID OAuth2 Link

**Goal:** Attach a globally-unique ORCID researcher identity to each user account so `prov:wasAttributedTo` on every `HeritageAssertion` resolves to `https://orcid.org/{id}`.

**Backend changes:**

```python
# apps/users/models.py — add to UserProfile
orcid_id = models.CharField(max_length=64, blank=True, db_index=True)
orcid_name = models.CharField(max_length=256, blank=True)

# Property for assertion engine
@property
def attribution_uri(self):
    if self.orcid_id:
        return f"https://orcid.org/{self.orcid_id}"
    base = settings.RDF_RESOURCE_BASE_URI
    return f"{base}/agent/{self.user.username}"
```

```python
# apps/users/views.py
class OrcidConnectView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        # Build ORCID auth URL and redirect
        ...

class OrcidCallbackView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        # Exchange code for token, store orcid_id on UserProfile
        ...
```

**Environment variables to add:**
```
ORCID_CLIENT_ID=
ORCID_CLIENT_SECRET=
ORCID_REDIRECT_URI=https://heritagegraph.cair.org.np/api/users/orcid/callback/
```

**Frontend:** Add "Connect ORCID" button to `/account` page; show linked ORCID ID + name after linking.

---

### SPEC-02: Project PID Minting

**Goal:** Every `Project` gets a permanent identifier `https://w3id.org/heritagegraph/project/{uuid}` and a `prov:Activity` record in the triple store.

**Backend changes:**

```python
# apps/heritage_data/models.py — add to Project
pid = models.URLField(max_length=512, blank=True)
prov_activity_uri = models.URLField(blank=True)
```

```python
# apps/heritage_data/signals.py (create this file)
from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.heritage_data.models import Project
from apps.graph.models import RDFSyncOutbox
from django.conf import settings

@receiver(post_save, sender=Project)
def mint_project_pid(sender, instance, created, **kwargs):
    if not created or instance.pid:
        return
    base = settings.RDF_RESOURCE_BASE_URI.rstrip("/")
    pid = f"{base}/project/{instance.pk}"
    activity_uri = f"{pid}/creation-activity"
    Project.objects.filter(pk=instance.pk).update(pid=pid, prov_activity_uri=activity_uri)
    nt = f"""<{pid}> a <http://www.w3.org/ns/prov#Activity>, <{base}/ProjectCreationActivity> .
<{pid}> <http://www.w3.org/ns/prov#wasAssociatedWith> <{base}/agent/{instance.owner.username}> .
<{pid}> <http://www.w3.org/ns/prov#startedAtTime> "{instance.created_at.isoformat()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> ."""
    RDFSyncOutbox.objects.create(
        subject_uri=pid,
        operation=RDFSyncOutbox.Operation.INSERT_NT,
        payload={"nt": nt},
    )
```

---

### SPEC-03: DataSource Type Field + DataCite Metadata

**Goal:** Every `DataSource` is typed as a CIDOC subclass and carries DataCite metadata so it is independently citable.

**Migration changes (`apps/cidoc_data/models.py`):**
```python
SOURCE_TYPE_CHOICES = [
    ("field_survey", "FieldSurveyDataset"),
    ("oral_history", "OralHistoryRecording"),
    ("archival", "ArchivalRecord"),
    ("image", "ImageDataset"),
    ("pdf", "PDFDocument"),
]
source_type = models.CharField(max_length=32, choices=SOURCE_TYPE_CHOICES, default="field_survey")
datacite_identifier = models.URLField(blank=True)
datacite_creator = models.CharField(max_length=512, blank=True)
datacite_publisher = models.CharField(max_length=256, blank=True, default="CAIR-Nepal")
datacite_resource_type = models.CharField(max_length=64, blank=True, default="Dataset")
iiif_manifest = models.JSONField(null=True, blank=True)
```

**RDF mapping** (in `assertion_projection.py`):
```
source_type → rdf:type:
  field_survey  → hg:FieldSurveyDataset
  oral_history  → hg:OralHistoryRecording
  archival      → hg:ArchivalRecord
  image         → hg:ImageDataset, crmdig:D1_Digital_Object
  pdf           → hg:PDFDocument, crm:E73_Information_Object
```

---

## Milestone 2 — Contribution Loop Closure

### SPEC-04: MergeRequest Model

**Complete model definition:**

```python
# apps/heritage_data/models.py
class MergeRequest(models.Model):
    STATUS_PENDING = "pending"
    STATUS_CHANGES = "changes_requested"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_MERGED = "merged"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_CHANGES, "Changes Requested"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_MERGED, "Merged"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name="merge_requests")
    opened_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="opened_merge_requests")
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_merge_requests")
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_PENDING)
    summary = models.TextField()
    justification = models.TextField(blank=True)
    reviewer_feedback = models.TextField(blank=True)
    verification_note = models.TextField(blank=True)
    conflict_diff = models.JSONField(default=dict)
    merge_activity_uri = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "heritage_merge_request"
        ordering = ["-created_at"]
```

**ViewSet actions:**
- `POST /api/merge-requests/` — create (runs SHACL + diff)
- `POST /api/merge-requests/{id}/approve/` — calls `execute_merge()`
- `POST /api/merge-requests/{id}/reject/` — sets status + feedback
- `POST /api/merge-requests/{id}/request_changes/` — sets status + feedback; notifies contributor

**Permission:** `CannotApproveOwnMergeRequest`:
```python
class CannotApproveOwnMergeRequest(BasePermission):
    def has_object_permission(self, request, view, obj):
        if view.action == "approve":
            return request.user != obj.opened_by
        return True
```

---

### SPEC-05: SHACL Validation Gate

**File: `apps/graph/shacl_validate.py`**

```python
from pathlib import Path
import pyshacl
from rdflib import Graph

SHAPES_PATH = Path(__file__).parent.parent.parent / "ontology/shapes/generated-heritagegraph-minimal-shacl.ttl"

def validate_project_graph(project_id: str) -> tuple[bool, list[dict]]:
    """Returns (conforms, violations)."""
    from apps.graph.kg_engine.store import sparql_construct
    nt = sparql_construct(f"CONSTRUCT {{ ?s ?p ?o }} WHERE {{ GRAPH <.../project/{project_id}/graph> {{ ?s ?p ?o }} }}")
    data_graph = Graph().parse(data=nt, format="nt")
    shapes_graph = Graph().parse(str(SHAPES_PATH))
    conforms, results_graph, results_text = pyshacl.validate(data_graph, shacl_graph=shapes_graph)
    violations = _parse_results(results_graph)
    return conforms, violations
```

---

### SPEC-06: Pre-flight Conflict Diff

**File: `apps/graph/conflict_diff.py`**

```python
def compute_diff(project_graph_uri: str, main_graph_uri: str) -> dict:
    """Returns {added: [...], conflicts: [...], removed: [...]}."""
    # added = in project but not in main
    # conflicts = same subject+predicate in both with different object
    # removed = in main but superseded by project assertion
    ...
```

Output shape:
```json
{
  "added": [{"subject": "hg:...", "predicate": "rdf:type", "object": "hg:Temple"}],
  "conflicts": [],
  "removed": []
}
```

---

### SPEC-07: Multi-Calendar TimeSpan

**File: `apps/cidoc_data/timespan.py`**

```python
from dataclasses import dataclass
from typing import Literal

CalendarSystem = Literal["gregorian", "bikram_sambat", "nepal_sambat"]
DatePrecision = Literal["year", "decade", "century", "circa"]

YEAR_OFFSET = {"bikram_sambat": -57, "nepal_sambat": -879, "gregorian": 0}

@dataclass
class TimeSpan:
    year: int
    calendar_system: CalendarSystem = "gregorian"
    precision: DatePrecision = "year"

    def gregorian_year(self) -> int:
        return self.year + YEAR_OFFSET[self.calendar_system]

    def to_edtf(self) -> str:
        g = self.gregorian_year()
        if self.precision == "circa":
            return f"{g}~"
        if self.precision == "decade":
            return f"{g // 10 * 10}"
        return str(g)

    def to_rdf_triples(self, span_uri: str) -> str:
        return f"""
<{span_uri}> a <http://www.cidoc-crm.org/cidoc-crm/E52_Time-Span> ;
    <hg:calendar_system> "{self.calendar_system}" ;
    <hg:date_precision> "{self.precision}" ;
    <http://www.cidoc-crm.org/cidoc-crm/P82a_begin_of_the_begin> "{self.gregorian_year()}"^^<xsd:gYear> .
"""
```

**Frontend component (`CalendarDatePicker.tsx`):**
- Radio: Gregorian / Bikram Sambat / Nepal Sambat
- Year input (number)
- Precision select: exact year / circa / decade / century
- Preview: shows EDTF string + equivalent years in other calendars

---

## Milestone 3 — Review & Merge

### SPEC-08: Merge Execution

**File: `apps/graph/merge.py`**

```python
def execute_merge(merge_request_id: str) -> None:
    from apps.heritage_data.models import MergeRequest, ProjectSnapshot
    mr = MergeRequest.objects.get(pk=merge_request_id)
    project = mr.project

    # Step 1: Copy project named graph to main
    _sparql_copy_graph(
        src=f"{RDF_BASE}/project/{project.pk}/graph",
        dst=f"{RDF_BASE}/main"
    )

    # Step 2: Mint global PIDs for genuinely new entities
    new_pids = _mint_pids_for_new_entities(project.pk)

    # Step 3: Write MergeActivity provenance triple
    _write_merge_activity(mr, new_pids)

    # Step 4: Freeze project snapshot
    ttl = _export_project_graph_ttl(project.pk)
    snapshot = ProjectSnapshot.objects.create(project=project, merge_request=mr)
    (SNAPSHOTS_DIR / f"{project.pk}.ttl").write_text(ttl)

    # Step 5: Update MergeRequest
    mr.status = MergeRequest.STATUS_MERGED
    mr.save()

    # Step 6: Enqueue downstream tasks
    from apps.graph.tasks import export_nanopubs_for_merge, regen_void_dcat, mint_doi
    export_nanopubs_for_merge.delay(str(merge_request_id))
    regen_void_dcat.delay()
    mint_doi.delay(str(snapshot.pk))
```

---

## Milestone 4 — LOD Pipeline

### SPEC-09: VoID / DCAT Generator

**File: `apps/graph/kg_engine/void_generator.py`**

Template variables to fill dynamically via SPARQL:
- `void:triples` — `SELECT (COUNT(*) AS ?c) WHERE { ?s ?p ?o }`
- `void:classes` — `SELECT (COUNT(DISTINCT ?type) AS ?c) WHERE { ?s rdf:type ?type }`
- `void:entities` — `SELECT (COUNT(DISTINCT ?s) AS ?c) WHERE { ?s a [] }`
- `dcterms:issued` — `datetime.utcnow().isoformat()`
- `dcat:version` — increment from previous VoID file

Output: overwrites `ontology/lod/void-dataset.ttl`.

---

### SPEC-10: SKOS Vocabulary Generator

**File: `tools/generate_skos.py`**

```
python tools/generate_skos.py → reads ontology/HeritageGraph.yaml
  For each enum in schema:
    - emit skos:ConceptScheme with enum name
    - for each permissible value:
        - emit skos:Concept
        - skos:prefLabel from value name
        - skos:definition from meaning: field
        - skos:exactMatch from exact_mappings: list
        - skos:broadMatch from broad_mappings: list
  Output: ontology/lod/skos-vocabularies.ttl (overwrite)
```

Add to `Makefile`:
```makefile
skos:
    python tools/generate_skos.py
    @echo "SKOS vocabularies regenerated → ontology/lod/skos-vocabularies.ttl"
```

---

## Milestone 5 — Discovery & Access

### SPEC-11: Content Negotiation View

**`apps/graph/lod_views.py` — update entity detail view:**

```python
ACCEPT_FORMATS = {
    "text/turtle": "turtle",
    "application/ld+json": "json-ld",
    "application/rdf+xml": "xml",
    "application/n-triples": "nt",
}

def entity_detail(request, entity_type, entity_id):
    accept = request.META.get("HTTP_ACCEPT", "text/html")
    fmt = next((v for k, v in ACCEPT_FORMATS.items() if k in accept), None)

    if fmt is None:
        # HTML — redirect to frontend
        return redirect(f"/knowledge/{entity_type}/{entity_id}")

    uri = f"{RDF_BASE}/{entity_type}/{entity_id}"
    graph = _oxigraph_describe(uri)  # returns rdflib Graph
    serialized = graph.serialize(format=fmt)
    content_type = next(k for k, v in ACCEPT_FORMATS.items() if v == fmt)
    return HttpResponse(serialized, content_type=content_type)
```

---

### SPEC-12: CARE SPARQL Proxy

**`apps/graph/sparql_proxy.py`**

```python
CARE_FILTER_ANONYMOUS = """
FILTER NOT EXISTS { ?s <hg:access_tier> "sensitive_indigenous" }
FILTER NOT EXISTS { ?s <hg:access_tier> "community_only" }
"""

class ProxySPARQLView(View):
    def get(self, request):
        query = request.GET.get("query", "")
        modified_query = _inject_care_filter(query, request.user)
        response = requests.get(
            f"{settings.OXIGRAPH_URL}/query",
            params={"query": modified_query},
            headers={"Accept": request.META.get("HTTP_ACCEPT", "application/sparql-results+json")},
        )
        hidden_count = _count_hidden_triples(request.user)
        django_response = HttpResponse(response.content, content_type=response.headers["Content-Type"])
        django_response["X-CARE-Filtered"] = str(hidden_count)
        return django_response
```

---

### SPEC-13: DataCite DOI Minting

**`apps/graph/datacite.py`**

```python
import requests, base64, os

DATACITE_API = "https://api.datacite.org/dois"
DATACITE_PREFIX = os.environ.get("DATACITE_DOI_PREFIX", "10.5281")

def mint_doi(project_snapshot) -> str:
    project = project_snapshot.project
    payload = {
        "data": {
            "type": "dois",
            "attributes": {
                "prefix": DATACITE_PREFIX,
                "titles": [{"title": project.title}],
                "creators": [{"name": "CAIR-Nepal"}],
                "publisher": "CAIR-Nepal",
                "publicationYear": project_snapshot.created_at.year,
                "resourceTypeGeneral": "Dataset",
                "url": f"https://w3id.org/heritagegraph/project/{project.pk}",
                "schemaVersion": "http://datacite.org/schema/kernel-4",
            }
        }
    }
    creds = base64.b64encode(
        f"{os.environ['DATACITE_USERNAME']}:{os.environ['DATACITE_PASSWORD']}".encode()
    ).decode()
    r = requests.post(DATACITE_API, json=payload, headers={"Authorization": f"Basic {creds}"})
    r.raise_for_status()
    doi = r.json()["data"]["id"]
    project_snapshot.doi = doi
    project_snapshot.save(update_fields=["doi"])
    return doi
```

---

## Evaluation Scripts (paper-critical)

### SPEC-E1: SHACL Conformance Rate

**File: `evaluation/shacl_conformance.py`**

```
For each project graph in Oxigraph:
    run pyshacl with shapes.ttl
    record pass/fail per shape
Output: CSV with columns [shape_name, total_checked, violations, conformance_rate]
```

### SPEC-E2: Getty AAT/TGN Alignment F1

**File: `evaluation/alignment_f1.py`**

```
Gold set: evaluation/gold/alignment_gold_200.jsonl
  {entity_uri, ground_truth_aat_id}

For each entity in gold set:
    check if hg:entity skos:exactMatch aat:XXXX
    record TP / FP / FN
Output: precision, recall, F1
```

### SPEC-E3: Reasoner Novelty Rate

**File: `evaluation/reasoner_novelty.py`**

```
Run HermiT on main graph → all_inferred (set)
Run RDFS closure only → rdfs_closure (set)
novelty = (all_inferred - rdfs_closure) / all_inferred
Output: novelty_rate, sample of novel triples
```

### SPEC-E4: Cohen's Kappa on Review Decisions

**File: `evaluation/reviewer_kappa.py`**

```
Requires: ≥50 MergeRequest decisions with ≥2 independent reviewers each
For each MR:
    annotator_A_decision, annotator_B_decision ∈ {approve, reject, changes_requested}
Compute Cohen's κ using sklearn.metrics.cohen_kappa_score
Output: κ, agreement table
Pre-register: evaluation/PROTOCOL.md before running
```
