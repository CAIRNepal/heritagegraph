# HeritageGraph — Agentic KG Ingestion Architecture


## The Core Architectural Insight

Most published pipelines treat extraction and validation as **sequential pipeline stages**.  architecture makes them **concurrent and bidirectional** through what we call:

### Assertion-First Extraction (AFE)

Instead of extracting entities and then validating them, every extracted fact is immediately wrapped in a `HeritageAssertion` (`crminf:I2_Belief`) with:
- Source provenance (PDF page, paragraph offset)
- Extraction agent identity (which LLM, which prompt version)
- Confidence score (entropy-based)
- Reconciliation status (`unverified` → `confirmed` / `conflicting`)



---

## The Five-Agent Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         HERITAGE DOCUMENT                                │
│              (PDF / Archive / Field Notes / Inscription)                 │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  AGENT 1 — DOCUMENT INTELLIGENCE AGENT                                   │
│                                                                          │
│  • Classifies document type:                                             │
│    inscription | chronicle | survey_report | oral_history | gazette      │
│  • Semantic chunking (not fixed-size): splits at section boundaries,     │
│    paragraph turns, and named entity density shifts                      │
│  • Language detection: Nepali / Sanskrit / Newari / English              │
│  • Selects RELEVANT ontology subset ("ontology snippet") from            │
│    HeritageGraph.yaml based on document type                             │
│  • Output: List[DocumentChunk] with metadata + ontology_hint            │
│                                                                          │
│  Tool: docling (IBM) + langdetect +  HeritageGraph.yaml parser      │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │  DocumentChunk stream
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  AGENT 2 — ONTOLOGY-GROUNDED EXTRACTION AGENT                            │
│                                                                          │
│  • Receives: chunk text + ontology_hint (only relevant CIDOC classes)    │
│  • Prompt = ontology snippet + few-shot Nepalese heritage examples       │
│  • Extracts candidate (subject, predicate, object) triples               │
│  • Runs TWICE with different temperature (0.1 and 0.4)                  │
│  • Computes per-triple agreement score between two runs                  │
│    → agreement = confidence signal (entropy-based)                       │
│  • Wraps each triple in HeritageAssertion with confidence + source_page  │
│  • Output: List[CandidateAssertion]                                      │
│                                                                          │
│  LLM: Llama 3.1 70B (Ollama) — reproducible, open weights, citable     │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │  CandidateAssertion stream
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  AGENT 3 — SHACL VALIDATOR AGENT                                         │
│                                                                          │
│  • Runs pySHACL against your Heritage.ttl OWL shapes                    │
│  • Checks:                                                               │
│    - Domain/range compliance (E53_Place cannot be subject of P14)        │
│    - Cardinality constraints (a LivingGoddessTenure must have            │
│      had_participant exactly one Person)                                 │
│    - Enum conformance (condition must be in ConditionTypeEnum)           │
│    - Cross-class consistency (SyncreticRelationship requires two deities)│
│  • REJECTS invalid triples with structured error reason                  │
│  • CORRECTS recoverable errors (wrong direction, missing inverse)        │
│  • Output: ValidatedAssertion | RejectedAssertion with reason            │
│                                                                          │
│  Tool: pySHACL + Heritage.ttl                                       │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │  ValidatedAssertion stream
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  AGENT 4 — ENTITY RESOLUTION AGENT                                       │
│                                                                          │
│  • SPARQL queries your live Oxigraph for each extracted entity:          │
│    "Does 'Pashupatinath' already exist as an E53_Place?"                 │
│  • Co-reference resolution:                                              │
│    "the temple" → resolved to last mentioned temple URI                  │
│    "the king" → resolved via period + context                            │
│  • Transliteration normalization:                                        │
│    "Swayambhu" = "Swayambhunath" = "स्वयम्भू" → canonical URI           │
│  • Deduplication:                                                        │
│    If entity exists → adds new assertion to existing node                │
│    If entity is new → mints new URI using your heritageGraph: namespace  │
│  • Output: ResolvedAssertion with canonical_uri + is_new flag            │
│                                                                          │
│  Tool: SPARQLWrapper → Oxigraph + rapidfuzz for fuzzy matching     │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │  ResolvedAssertion stream
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  AGENT 5 — EPISTEMIC ROUTING AGENT                                       │
│                                                                          │
│  Decision tree based on confidence + entity type + conflict status:      │
│                                                                          │
│  confidence ≥ 0.90 + no conflict     → AUTO-ACCEPT → Oxigraph           │
│  confidence 0.70–0.89 + no conflict  → COMMUNITY REVIEW queue           │
│  confidence 0.50–0.69               → DOMAIN EXPERT review queue        │
│  confidence < 0.50                  → REJECT (log for retraining)       │
│  any conflict detected              → CONFLICT queue (coexist/supersede) │
│  Kumari / SyncreticRelationship     → ALWAYS expert_curator queue       │
│                                      (these are high-stakes claims)      │
│                                                                          │
│  Creates ReviewFlag automatically if:                                    │
│    - Two sources contradict each other                                   │
│    - Entity is already in graph with different property value            │
│    - Triple involves a Living Goddess claim                              │
│                                                                          │
│  Output: routes to Oxigraph OR your existing ReviewDecision workflow    │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
    AUTO-ACCEPT      REVIEW QUEUE      REJECTED
    → Oxigraph    → existing       → Logged for
    (SPARQL       ReviewDecision     retraining
    INSERT)       workflow           dataset
```

---







This positions the paper as a **human-AI collaborative KG construction** study — a framing that Nature journals respond well to.



```python
# Every extracted fact maps directly to your existing Django models:

# Agent 2 output:
HeritageAssertion(
    assertion_content = "Pashupatinath was built during the Lichhavi period",
    asserts_about_entity = <URI>,           # minted by Agent 4
    was_derived_from_source = DataSource(   # your existing DataSource class
        name = "Muluki Ain 1853",
        source_citation = "PDF page 47",
        datacite_resource_type = "Text"
    ),
    was_attributed_to_agent = agent_uri,    # the LLM as a prov:Agent
    generated_at_time = now(),
    confidence_score = 0.87,               # from dual-temperature entropy
    reconciliation_status = "unverified"   # updated by Agent 5
)

# Agent 5 routes to your existing ReviewDecision:
ReviewDecision(
    entity = cultural_entity,
    verdict = "pending",                   # awaiting human
    confidence_override = "likely",        # 0.87 → "likely"
    verification_method = "source_crosscheck"
)

# With ReviewFlag if conflict:
ReviewFlag(
    flag_type = "questionable_source",
    description = "Agent found conflicting construction date: 879 CE vs 1200 CE"
)
```

---

## Implementation Stack

| Layer | Tool | Justification |
|---|---|---|
| PDF parsing | **docling** (IBM, Apache-2.0) | Preserves layout, tables, headers — better than PyMuPDF for archival texts |
| Semantic chunking | **chonkie** (MIT) | Sentence-aware, token-budget-aware chunking |
| Language detection | **langdetect** | Nepali/Sanskrit/English detection for prompt selection |
| Extraction LLM | **Llama 3.1 70B** via Ollama | Open weights, fully reproducible, citable in paper |
| Ontology validation | **pySHACL** (Apache-2.0) | SHACL shapes against your Heritage.ttl |
| Fuzzy entity matching | **rapidfuzz** (MIT) | Transliteration normalization (Swayambhu variants) |
| SPARQL queries | **SPARQLWrapper** → Oxigraph | Entity resolution against live graph |
| Pydantic validation | **pydantic v2** | Already in stack; schema-level type enforcement |
| Confidence scoring | Dual-temperature + cosine similarity | Novel, cheap, interpretable |
| Triple store | **Oxigraph** | Already in  repo |

---

## Evaluation Methodology 

### Intrinsic Metrics (automated)
- **Ontology Conformance Rate:** % of extracted triples that pass SHACL validation
- **Entity Coverage:** % of gold-standard entities found in test documents
- **Relation Precision/Recall/F1:** Standard IE metrics on held-out annotated pages
- **Confidence Calibration:** Brier score — does confidence 0.8 mean 80% correct?
- **Deduplication Accuracy:** % of co-references correctly resolved

### Extrinsic Metrics (downstream task)
- **SPARQL KBQA:** Can the resulting graph answer 50 expert-formulated questions about Nepalese heritage?
- **Expert Acceptance Rate:** % of assertions accepted by domain experts without modification
- **Review Turnaround:** Time to reach `confirmed` status through the review pipeline

### Ablation Studies 
Run the pipeline with each agent removed to prove each contributes:
1. Without Agent 1 (no ontology snippet) → measure precision drop
2. Without Agent 3 (no SHACL) → measure conformance drop
3. Without Agent 4 (no entity resolution) → measure duplicate rate
4. Single-temperature vs. dual-temperature → measure calibration improvement

### Baseline Comparisons
- **Naive LLM extraction** (no ontology constraint, no validation)
- **GraphRAG** (Microsoft, 2024)
- **iText2KG** (zero-shot incremental approach)
-  (HeritageGraph-AFE)





## The One Diagram for the Paper

```
PDF / Archival Text
        │
        ▼
[Doc Intelligence] ──ontology_snippet──┐
        │                              │
        ▼                              ▼
[Extraction Agent] ←──── HeritageGraph.yaml (CIDOC-CRM + PROV-O)
  (Llama 3.1 70B)
  2× temperature
        │
        ▼
  CandidateAssertion
  (crminf:I2_Belief)
  + confidence_score
        │
        ▼
[SHACL Validator] ←──── Heritage.ttl (OWL shapes)
        │
   PASS / FAIL
        │
        ▼
[Entity Resolver] ←──── Oxigraph (live SPARQL)
        │
   new_uri / existing_uri
        │
        ▼
[Epistemic Router]
   │           │           │
   ▼           ▼           ▼
AUTO-        REVIEW     REJECTED
ACCEPT       QUEUE      (logged)
   │           │
   ▼           ▼
Oxigraph   ReviewDecision
(SPARQL    (human expert)
INSERT)         │
                ▼
           CONFIRMED
           assertion
```

