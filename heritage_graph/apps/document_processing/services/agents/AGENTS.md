# HeritageGraph — Agentic KG Ingestion Pipeline

**Location:** `heritage_graph/apps/document_processing/services/agents/`  
**Status:** Agents 1–4 implemented · Agent 5 pending  
**LLM backend:** Ollama (Llama 3.1 70B) with Claude fallback where already integrated

---

## Architecture Overview

```
PDF / Archival Document
        │
        ▼
[Agent 1 — Doc Intelligence]     doc_intelligence.py
  Heritage doc type classification
  Language detection (langdetect)
  Semantic chunking (chonkie / fallback)
  Ontology snippet selection from schema registry
        │  DocumentIntelligenceResult
        ▼
[Agent 2 — Extraction]           extraction_agent.py
  Dual-temperature Ollama calls (temp 0.1 + 0.4)
  (subject, predicate, object) triple parsing
  Per-triple agreement scoring via rapidfuzz
  CandidateAssertion with confidence_score
        │  ExtractionResult
        ▼
[Agent 3 — SHACL Validator]      shacl_agent.py
  Fast shapes-index lookup (generated-heritagegraph-minimal-shacl.ttl)
  Inverse predicate auto-correction
  pySHACL mini-graph validation (minCount filtered)
  Kumari / SyncreticRelationship hard rules
        │  ShaclValidationResult
        ▼
[Agent 4 — Entity Resolution]    entity_resolution_agent.py
  SPARQL → Oxigraph (entity lookup)
  rapidfuzz transliteration normalization
  Mint canonical_uri or link existing node
        │  ResolvedAssertion
        ▼
[Agent 5 — Epistemic Router]     ← PENDING
  confidence_score thresholds → AUTO-ACCEPT / REVIEW / REJECT
  kumari_flag → expert_curator queue
  Conflict detection → ReviewFlag
  Writes HeritageAssertion to DB (or routes to ReviewDecision)
        │
   ┌────┴─────┬──────────┐
   ▼          ▼          ▼
AUTO-ACCEPT  REVIEW    REJECTED
→ Oxigraph  → Review  → Logged
             Decision   (retrain)
```

---

## Shared Types (`types.py`)

| Type | Owner | Description |
|---|---|---|
| `HeritageDocType` | Agent 1 | Enum: inscription / chronicle / survey_report / oral_history / gazette / unknown |
| `DocumentChunk` | Agent 1 | Chunk of text with `chunk_id`, `char_start/end`, `language`, `ontology_hint`, `token_count` |
| `DocumentIntelligenceResult` | Agent 1 | Heritage doc type + language + chunks + ontology_snippet dict |
| `Triple` | Agent 2 | `(subject, subject_type, predicate, object, object_type)` |
| `CandidateAssertion` | Agent 2 | Triple + `confidence_score` + `source_chunk_id` + raw LLM responses |
| `ExtractionResult` | Agent 2 | `list[CandidateAssertion]` + rejected_count |
| `ValidatedAssertion` | Agent 3 | CandidateAssertion + `checks_passed` + `corrected` flag |
| `RejectedAssertion` | Agent 3 | CandidateAssertion + `reason` + `violation_type` |
| `ShaclValidationResult` | Agent 3 | `list[ValidatedAssertion]` + `list[RejectedAssertion]` |
| `ResolvedAssertion` | Agent 4 | ValidatedAssertion + `subject_uri` + `object_uri` + `subject_is_new` + `object_is_new` + `resolution_notes` |
| `EntityResolutionResult` | Agent 4 | `list[ResolvedAssertion]` + `skipped_count` |

---

## Agent 1 — Document Intelligence (`doc_intelligence.py`)

**Entry point:** `run_doc_intelligence(text, use_ollama, chunk_max_tokens)`

### What it does

1. **Heritage document type classification**
   - Calls Ollama (Llama 3.1 70B, `temperature=0.1`) with a structured prompt
   - Falls back to keyword heuristics if Ollama is unreachable
   - Classes: `inscription | chronicle | survey_report | oral_history | gazette | unknown`

2. **Language detection**
   - Uses `langdetect` to classify each document
   - Maps codes → `Nepali / Sanskrit / English / Hindi / unknown`

3. **Semantic chunking**
   - Uses `chonkie.SentenceChunker` if installed; falls back to sentence-batching
   - Default `chunk_max_tokens=256`
   - Each chunk carries `ontology_hint` (list of relevant CIDOC class keys)

4. **Ontology snippet selection**
   - Maps doc type → CIDOC class keys via `_DOC_TYPE_ONTOLOGY_MAP`
   - Pulls class definitions from the schema registry (`get_effective_registry_payload`)

### Ontology mapping

| Doc type | CIDOC class keys |
|---|---|
| inscription | structure, iconography |
| chronicle | structure, ritual, festival, tradition |
| survey_report | structure, iconography, tradition |
| oral_history | ritual, festival, tradition |
| gazette | structure, tradition |

### Pipeline integration

Results are stored in `UploadedDocument.metadata` (JSONField, migration `0003`):
```json
{
  "heritage_doc_type": "inscription",
  "heritage_doc_type_confidence": 0.85,
  "detected_language": "Nepali",
  "chunk_count": 12,
  "ontology_class_keys": ["structure", "iconography"]
}
```

---

## Agent 2 — Ontology-Grounded Extraction (`extraction_agent.py`)

**Entry point:** `run_extraction(di_result, min_confidence=0.0)`

### What it does

1. **Dual-temperature Ollama calls** — for each `DocumentChunk`:
   - Run 1: `temperature=0.1` (deterministic, high-precision)
   - Run 2: `temperature=0.4` (exploratory, catches missed triples)

2. **Triple parsing** — expects JSON array from Ollama:
   ```json
   [{"subject": "...", "subject_type": "E22_Human-Made_Object",
     "predicate": "P108i_was_produced_by",
     "object": "...", "object_type": "E12_Production"}]
   ```
   Strips markdown fences, finds first JSON array, validates required keys.

3. **Agreement scoring** via `rapidfuzz.fuzz.ratio`:
   - Exact match across both runs → `confidence_score = 1.0`
   - Fuzzy match (≥ 82% ratio) across runs → `confidence_score = 1.0`
   - Only in one run → `confidence_score = 0.5`

4. **CandidateAssertion output** — in-memory only, no DB writes. DB write happens in Agent 5 after entity resolution.

### Few-shot prompt

The extraction prompt includes three hardcoded Nepalese heritage examples covering inscription, land donation, and Kumari selection scenarios to guide the LLM toward CIDOC-CRM predicate usage.

### Model fields added

`HeritageAssertion` model gained two agent fields (migration `0012`):
- `confidence_score` — `DecimalField(max_digits=4, decimal_places=3, null=True)` — numeric confidence from dual-temperature
- `attributed_to_agent` — `CharField(max_length=200, blank=True)` — LLM identifier (e.g. `"ollama/llama3.1:70b"`)

---

## Agent 3 — SHACL Validator (`shacl_agent.py`)

**Entry point:** `run_shacl_validation(candidates)`

**Shapes file:** `ontology/shapes/generated-heritagegraph-minimal-shacl.ttl`  
Loaded once at import time via `@lru_cache` into `{class_uri: {predicate_uri: _PropertyConstraint}}`.

### Validation layers (in order)

**Layer 1 — Inverse predicate correction**
- Detects CIDOC-CRM inverse predicates (e.g. `P12i_was_present_at`, `P108i_was_produced_by`)
- Auto-swaps subject ↔ object and updates predicate to forward form
- Marks `ValidatedAssertion.corrected = True`

**Layer 2 — Hard domain rules**
- `LivingGoddessSelection / LivingGoddessRetirement / KumariTenure` subject types → stamps `kumari_flag` on the assertion (Agent 5 routes to `expert_curator` queue regardless of confidence score)
- `E13_Attribute_Assignment` (SyncreticRelationship) without IRI objects on both P140/P141 → `RejectedAssertion(violation_type="cross_class")`

**Layer 3 — Shapes-index lookup**
- Predicate not found in shape for subject class → `RejectedAssertion(violation_type="unknown_predicate")`
- `sh:nodeKind sh:IRI` but object is literal → `RejectedAssertion(violation_type="node_kind")`
- `sh:nodeKind sh:Literal` but object is IRI → auto-corrects object_type to `"literal"`

**Layer 4 — pySHACL mini-graph**
- Mints a temporary RDF mini-graph `(hg:subject_tmp rdf:type <class> ; <pred> <obj_iri/lit>)`
- Runs `pyshacl.validate()` against the shapes file
- Walks the results graph via rdflib; filters out `sh:MinCountConstraintComponent` violations (expected for single-triple graphs)
- Real violations → `RejectedAssertion(violation_type="domain_range")`
- Fails open on pySHACL errors (does not reject on validator failure)

### Violation types

| `violation_type` | Meaning |
|---|---|
| `unknown_predicate` | Predicate not in SHACL shape for subject class |
| `node_kind` | Object should be IRI but is literal (or vice versa) |
| `cross_class` | Structural constraint violation (e.g. SyncreticRelationship missing both deities) |
| `domain_range` | pySHACL structural violation beyond minCount |

---

## Agent 4 — Entity Resolution (`entity_resolution_agent.py`)

**Entry point:** `run_entity_resolution(shacl_result, *, oxigraph_url=None)`

### What it does

Consumes `ShaclValidationResult.validated` and resolves every entity mention to a
canonical URI, either found in the live Oxigraph graph or freshly minted.

1. **Co-reference resolution**
   - Detects surface forms that refer back to a previously mentioned entity in the same
     chunk (e.g. `"the temple"`, `"he"`, `"the king"`).
   - Maintains a `coref_registry: {chunk_id → {class_label → last_uri}}` updated after
     each resolved assertion so later triples in the same chunk reuse the right URI.

2. **Transliteration normalisation**
   - Curated map of ~30 common Nepalese heritage name variants:
     `"Swayambhu"` = `"Swayambhunath"` = `"स्वयम्भू"` → canonical display form.
   - Applied before any SPARQL lookup so the graph is queried with the canonical label.

3. **Exact SPARQL label lookup**
   - Queries Oxigraph: `?uri rdfs:label ?lbl FILTER(LCASE(?lbl) = LCASE("<name>"))`
   - Optionally scoped to `rdf:type <class_uri>` when the CIDOC class is known.
   - Falls back to untyped lookup if the typed query returns nothing.

4. **Fuzzy SPARQL lookup**
   - Retrieves up to 500 `(uri, label)` pairs for the entity class from Oxigraph.
   - Ranks by `rapidfuzz.fuzz.ratio`; accepts the best match if score ≥ 85.

5. **URI minting**
   - If no match is found: mints `hg:entity/<class_slug>-<uuid4>`.
   - `class_slug` is derived from the CIDOC label, e.g. `E22_Human-Made_Object` → `e22-human-made-object`.
   - Sets `subject_is_new = True` / `object_is_new = True` so Agent 5 knows to INSERT
     the new entity triples rather than just assert a property.

6. **Literal objects skipped**
   - When `object_type` is `"literal"`, `"xsd:string"`, `"date"`, etc., `object_uri` is
     set to `None` — no URI resolution attempted.

### Resolution priority

```
co-reference match
  → exact label (class-typed SPARQL)
    → exact label (untyped SPARQL)
      → fuzzy match ≥ 85%
        → mint new URI
```

### Configuration

| Variable | Default | Description |
|---|---|---|
| `OXIGRAPH_URL` | `http://localhost:7878` | Oxigraph base URL (env var) |

The `oxigraph_url` kwarg overrides the env var for testing.

### Transliteration map (selected entries)

| Input variant | Canonical form |
|---|---|
| `swayambhu`, `swoyambhu`, `स्वयम्भू` | `Swayambhunath` |
| `pashupati`, `पशुपतिनाथ` | `Pashupatinath` |
| `boudha`, `bodhnath`, `bauddha`, `बौद्धनाथ` | `Boudhanath` |
| `bhadgaon`, `भक्तपुर` | `Bhaktapur` |
| `patan`, `ललितपुर` | `Lalitpur` |
| `kantipur`, `काठमाडौँ` | `Kathmandu` |

---

## Dependencies Added

| Package | Version | Used by |
|---|---|---|
| `langdetect` | 1.0.9 | Agent 1 — language detection |
| `chonkie` | ≥ 1.0.0 | Agent 1 — semantic chunking (optional; fallback available) |
| `ollama` | 0.6.2 | Agent 1 (classification), Agent 2 (extraction) |
| `rapidfuzz` | ≥ 3.0 | Agent 2 — fuzzy triple agreement scoring |
| `pyshacl` | ≥ 0.25 | Agent 3 — RDF shape validation |

---

## Pending: Agent 5 — Epistemic Router

**Planned inputs:** `list[ResolvedAssertion]`  
**Planned outputs:** writes `HeritageAssertion` to DB or routes to `ReviewDecision`

| Condition | Route |
|---|---|
| `confidence_score ≥ 0.90` + no conflict | AUTO-ACCEPT → Oxigraph SPARQL INSERT |
| `confidence_score 0.70–0.89` + no conflict | COMMUNITY REVIEW queue |
| `confidence_score 0.50–0.69` | DOMAIN EXPERT review queue |
| `confidence_score < 0.50` | REJECT → logged for retraining dataset |
| any conflict detected | CONFLICT queue (coexist / supersede decision) |
| `kumari_flag` set | ALWAYS → `expert_curator` queue |
