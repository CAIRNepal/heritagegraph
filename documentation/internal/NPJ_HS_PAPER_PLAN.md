# npj Heritage Science — Paper Plan: HeritageGraph

**Target venue:** *npj Heritage Science* (Nature portfolio, OA, IF ~2.5 as of 2025, scope: digital heritage infrastructure, computational cultural heritage, FAIR/CARE for heritage).
**Core thesis (one sentence):** Nepali heritage is structurally invisible in the global Linked Open Data cloud, and this paper introduces and evaluates a community-contributable methodology that makes it visible — with the HeritageGraph platform as the instrument, not the contribution.

---

## 0. Read this first — what would get this desk-rejected

These are not "things to fix later." Any one of them, unfixed at submission, materially raises desk-reject risk at *npj HS*.

| # | Blocker | Why it desk-rejects | Fix before submission |
|---|---|---|---|
| **B1** | No declared license on code, data, or ontology | Nature portfolio is OA; FAIR-compliance is a stated review criterion; *npj HS* explicitly requires a data availability statement with an open license. README literally says "license is yet to be finalized." | Adopt **CC-BY-4.0** for data + ontology, **Apache-2.0** for code, commit `LICENSE` + `LICENSE-DATA`, embed `dct:license` in the ontology IRI metadata. Do this in week 1. |
| **B2** | No data availability statement with persistent identifier | *npj HS* requires a Zenodo/Dryad/Figshare DOI for data and code. Personal GitHub URLs are not acceptable as the only deposit. | Cut a `paper-v1.0` tag; archive on Zenodo; cite the DOI. Mint a **w3id.org/heritagegraph/** prefix for the ontology — vendor-neutral, community-resolvable. |
| **B3** | No ethics statement on community heritage data | Nature portfolio enforces ethics review on community/indigenous data. Newar heritage qualifies. Without an FPIC/CARE/TK Labels statement, expect editor pushback before review. | See §7 of this document. Even a brief, honest "consultation is in progress with X stakeholders" is better than silence. |
| **B4** | Documentation drift visible in the public repo | Reviewers read the repo. Three schema files (`schema.yaml`, `new_schema.yaml`, `final_schema.yaml`), two cache strategy docs, three auth docs, empty `new.owl` and `Dockerfile.keycloak`. This signals unfrozen artifact. | One-week submission-hardening sprint: collapse to one canonical schema, delete dead files, archive `deleted/`, pin one auth approach, declare it in `SCHEMA.md` and `AUTH.md`. |
| **B5** | Claims without evaluation numbers | "We demonstrate X" with no F1/conformance/κ is desk-rejectable at a Nature venue. The 17,894 triples figure is engineering output, not evaluation. | See §5 of this document. Run the four evaluations. Without them, you cannot defend the contribution. |

If any of B1–B5 are unresolved at submission, **delay the submission**. A preprint on arXiv/SocArXiv while fixing them is a better use of the time than a rejected submission.

---

## 1. Paper structure

The structure puts the **research question** and **the LOD-visibility gap** in front; the platform is described only as the instrument that produced the evidence. *npj HS* tolerates — actually rewards — methodology-forward framing over system-description framing.

### Section map

| § | Title | Length | Purpose |
|---|-------|--------|---------|
| — | **Abstract** | 250 w | Lead with the invisibility gap. End with the federation-query result. |
| 1 | **Introduction** | 800–1000 w | Establish the gap (South Asian heritage in LOD), the research question, and the contribution. Do **not** describe the platform here. |
| 2 | **Background and related systems** | 700–900 w | CIDOC-CRM, Linked Art, LOD landscape. Comparison table vs ResearchSpace, ArCo, WissKI, Linked.art. |
| 3 | **A methodology for community-contributable LOD construction** | 1200–1500 w | The actual contribution. The community-contribution workflow as research methodology. CIDOC-CRM-aligned proposal → review → publish pipeline. LLM-assisted curation as instrumented method. |
| 4 | **HeritageGraph: instrument and deployment** | 800–1000 w | The platform, briefly. Architecture, ontology layering (LinkML/OWL-DL/SHACL), reasoning, dual triplestores. Frame as *the instrument by which the methodology was operationalized for Newar heritage*. |
| 5 | **Evaluation** | 1200–1500 w | Four evaluations from §5 of this doc. Each with a sub-heading: SHACL conformance, Getty alignment quality, reasoner novelty, inter-annotator agreement. |
| 6 | **Results: making Newar heritage visible in the LOD cloud** | 1000–1300 w | The centerpiece. The 3-endpoint SPARQL federation walk-through. Before/after LOD visibility. Coverage statistics. |
| 7 | **Discussion** | 700–900 w | What this implies for Global South digital heritage. Transferability. Limitations (honest). |
| 8 | **Ethics, FPIC, and data sovereignty** | 500–700 w | TK Labels, CARE, community engagement. See §7 of this document. |
| 9 | **Conclusion** | 200–300 w | Re-anchor on the gap and the methodological claim. |
| — | **Data and code availability** | required | Zenodo DOI, w3id IRI, license. |
| — | **Author contributions, competing interests, acknowledgments** | required | Standard. |

**Structural rules:**
- Do **not** put architecture diagrams in §1.
- Do **not** describe Django/Next.js/Docker in §1, §2, or §3. They belong in §4 only, and even there, briefly.
- The Cesium Heritage Atlas is a figure, not a section.
- The OCR benchmark is **not the paper**. It is supplementary (Appendix A). See §4 of this document.

---

## 2. Abstract (draft, 248 words)

> **Background.** South Asian heritage is structurally underrepresented in the global Linked Open Data (LOD) cloud. Major heritage knowledge graphs — ResearchSpace, ArCo, WissKI, and Linked.art deployments — concentrate on European and North American collections, leaving Nepali, Newar, and broader Himalayan cultural heritage effectively invisible to crawlers, agents, and federated SPARQL clients. Closing this gap requires more than digitization: it requires infrastructure that lets community contributors enter heritage data and immediately participate in the global semantic web.
>
> **Methods.** We introduce a methodology for community-contributable LOD construction in under-represented heritage domains. The methodology comprises (i) a CIDOC-CRM-aligned proposal-and-review workflow operated by community contributors and expert reviewers, (ii) LLM-assisted entity classification and Getty alignment, (iii) OWL-DL reasoning with SHACL validation gates, and (iv) dual-triplestore publication for both embedded and federated access. We operationalize the methodology in HeritageGraph, a deployed instance for Newar and Nepali heritage.
>
> **Results.** A three-endpoint SPARQL federation query — HeritageGraph ↔ Getty AAT ↔ Wikidata — resolves a contributed Newar entity end-to-end across the global LOD cloud, demonstrating that newly contributed data is immediately discoverable through the same paths used for European collections. We report SHACL conformance, Getty alignment F1, reasoner novelty rate, and inter-annotator agreement on the community contribution workflow.
>
> **Conclusion.** The methodology is transferable to other under-represented heritage corpora. Released artifacts (ontology, deployment, evaluation harness) are FAIR-compliant under CC-BY-4.0 and Apache-2.0.

**Word count check:** 248. Hits the 250-word ceiling. Keep it tight.

**Why this abstract works for *npj HS*:**
1. Sentence 1 = the gap (LOD invisibility), not the platform.
2. Methods sentence = the *methodology* is the contribution. Platform is named once, in passing.
3. Results = the federation query is the centerpiece. Numbers come from §5 evaluations.
4. Conclusion gestures at transferability (preempts the Newar-only-scope weakness).
5. Final clause kills the FAIR/license question.

**Cannot claim in this abstract without evidence:**
- "Outperforms" — do not use.
- "First" — do not use unless you have done a literature scan (see §3 below).
- "Novel reasoning patterns" — only if novelty rate evaluation is run.
- "Community contributors" (plural, real) — only if there are real ones; otherwise say "expert curators and community contributors" once you have at least 3 community contributors with documented engagement. If you have zero, switch to "designed for community contributors and validated by domain experts" and be honest in §5.

---

## 3. Section-by-section evidence requirements

For each section, the evidence you must already have in hand before drafting.

### §1 Introduction
**Claim:** South Asian / Newar / Nepali heritage is structurally underrepresented in LOD.

**Evidence you must generate:**
- **Quantitative gap statement.** Pick one or more:
  - A SPARQL query against Wikidata counting heritage entities tagged with `country = Nepal` vs comparable countries (Italy, France, Greece). Report ratio.
  - A query against the LOD Cloud diagram / lod-cloud.net dataset descriptions counting datasets with South Asian heritage coverage. Likely close to zero — that *is* the contribution.
  - A query against Getty AAT/TGN counting Newar/Nepali terms vs total. (Watch: TGN does cover Kathmandu Valley; quantify how thinly.)
- A 1-paragraph survey of prior digital Nepali heritage efforts (museums, archives, NHDP, ICIMOD) and a clear claim about what was missing: no CIDOC-CRM-aligned, SPARQL-queryable, community-contributable instance.
- A figure: world map shaded by LOD heritage entity count per country, with Nepal highlighted as a near-empty cell. *This is your motivation figure.*

**What you cannot claim without more work:**
- "First CIDOC-CRM deployment for Nepal." Only safe if you have done a literature scan covering at least: Google Scholar + Semantic Scholar + DBLP + the CIDOC-CRM SIG mailing list archives + GitHub topic search. Document the scan as a supplementary appendix.

### §2 Background and related systems
**Claim:** Existing CH-LOD platforms do not meet the community-contributable + Global South requirements.

**Evidence:**
- The comparison table in §6 of this document, with citations.
- Brief description of CIDOC-CRM v7.x, Linked.art profile, FAIR + CARE principles, TK Labels.

**What you cannot claim:**
- Architectural superiority. Frame as *different design choices for different requirements*, not better.

### §3 Methodology
**Claim:** A community-contributable LOD methodology is feasible and produces well-formed CIDOC-CRM-aligned data.

**Evidence:**
- Workflow diagram (Figure 2): contributor → proposal → LLM-assisted classification → expert review → SHACL gate → reasoner → publish. Each box maps to a real component (cite repo paths in supplementary).
- Numbers: throughput per contributor, time per proposal, accept/reject/revise ratios.
- The inter-annotator κ from §5 of this document.

**What you cannot claim:**
- That LLM-assisted curation improves quality. Only that it changes throughput. To claim quality improvement you need an A/B ablation (with/without LLM suggestion). If you don't have time, drop the quality claim and keep the throughput claim.

### §4 HeritageGraph: instrument and deployment
**Claim:** The methodology is operationalized in a deployed, reproducible artifact.

**Evidence:**
- Architecture diagram (Figure 3) — repurpose `ARCHITECTURE.md`'s diagrams. One diagram, not five.
- Ontology layering note: LinkML for forms/validation, OWL-DL for reasoning, SHACL for conformance, PROV-O for provenance. One sentence each, citing the W3C specs.
- Triplestore choice rationale: Oxigraph (embedded, low-friction) + Fuseki (federated SPARQL endpoint). Cite both projects.
- Reproducibility: Zenodo DOI, Docker image hashes, `make verify` target.
- **Cut from §4:** Django, Next.js, NextAuth, Keycloak, Traefik, Dokploy. These are deployment substrate, not contribution. Mention in passing or in supplementary.

**What you cannot claim:**
- That the deployment has been independently reproduced. Unless someone external has actually run `make setup` and confirmed, do not write "independently reproducible." Write "designed for reproducibility" and back it up with the artifact.

### §5 Evaluation
See §5 of this document for methodology. Each sub-section needs:
- Pre-registration: shapes, gold set, novelty definition, κ task — all fixed *before* running.
- A table with numbers + 95% CIs where appropriate.
- A short paragraph on threats to validity.

### §6 Results: making Newar heritage visible
See §4 of this document for the centerpiece design.

**Evidence:**
- The full federation query (in a code block in the paper).
- A figure showing the resolved entity's LOD neighborhood before and after contribution.
- Coverage statistics: count of HG entities with at least one Getty alignment, with at least one Wikidata sameAs, with at least one inferred triple.

### §7 Discussion
**Claim:** Transferable to other under-represented corpora.

**Evidence:**
- A short "how would you redeploy this for Bhutanese / Sri Lankan / Khmer heritage" subsection. Identify the swappable components (ontology extensions, language packs, OCR engine).
- Honest limitations subsection: Newar-only validation, modest scale, evaluation gold-set size, no third-party reproduction yet, no longitudinal user study.

### §8 Ethics
See §7 of this document.

### §9 Conclusion
Restate the gap, the methodology, the evidence. No new claims.

---

## 4. The centerpiece: 3-endpoint SPARQL federation query

This is the result the paper rises and falls on. Design it so a reviewer can copy-paste it and reproduce the result against the published Fuseki endpoint.

### Choose the demonstrator entity

**Selection criteria:**
1. Unambiguously Newar/Nepali (resists "this is generic South Asian heritage" pushback).
2. Has a real Wikidata Q-number (otherwise federation breaks).
3. Has at least one plausible Getty AAT type alignment (architectural style, object type, or material).
4. Has community-curatable, non-contested provenance (avoid repatriation-disputed objects in the centerpiece — discuss those separately in §8).
5. Has imagery/coordinates suitable for the Atlas figure.

**Recommended candidate:** the **Krishna Mandir, Patan Durbar Square** (Wikidata: Q3196273, Shikhara-style stone temple, 17th c., UNESCO WHS component, non-contested, geocodable). Alternatives: **Swayambhunath stupa** (more famous but heavily duplicated globally; lower marginal visibility gain), **a guthi** (intangible heritage — more compelling but harder to align to Getty AAT).

**Decision rule:** pick the candidate that, before your contribution, has the *thinnest* LOD presence but a Wikidata Q-number. Quantify "thinness" by counting incoming/outgoing LOD links pre-contribution. That delta *is* the result.

### Query design

The query must traverse three endpoints and return a single resolved entity with cross-cluster context. Sketch (replace placeholders with real IRIs from your deployment):

```sparql
PREFIX crm:     <http://www.cidoc-crm.org/cidoc-crm/>
PREFIX hg:      <https://w3id.org/heritagegraph/entity/>
PREFIX aat:     <http://vocab.getty.edu/aat/>
PREFIX wd:      <http://www.wikidata.org/entity/>
PREFIX wdt:     <http://www.wikidata.org/prop/direct/>
PREFIX skos:    <http://www.w3.org/2004/02/skos/core#>
PREFIX owl:     <http://www.w3.org/2002/07/owl#>

SELECT ?entity ?label ?aatType ?aatLabel ?wdItem ?wdLabel ?wdCoords ?wdImage
WHERE {
  # Local: HeritageGraph
  SERVICE <https://heritagegraph.cair-nepal.org/sparql> {
    ?entity a crm:E22_Human-Made_Object ;
            rdfs:label ?label ;
            crm:P2_has_type ?aatType ;
            owl:sameAs ?wdItem .
    FILTER(STRSTARTS(STR(?entity), "https://w3id.org/heritagegraph/"))
  }

  # Federated: Getty AAT
  SERVICE <https://vocab.getty.edu/sparql> {
    ?aatType skos:prefLabel ?aatLabel .
    FILTER(LANG(?aatLabel) = "en")
  }

  # Federated: Wikidata
  SERVICE <https://query.wikidata.org/sparql> {
    ?wdItem rdfs:label ?wdLabel ;
            wdt:P625 ?wdCoords .
    OPTIONAL { ?wdItem wdt:P18 ?wdImage . }
    FILTER(LANG(?wdLabel) = "en")
  }
}
```

**Pre-flight checks before you commit this query to the paper:**
1. Your Fuseki endpoint must be publicly resolvable at a **stable URL** (not `localhost`, not an IP). Mint a subdomain.
2. The HG entity IRI must be a `w3id.org/heritagegraph/...` PURL that 303-redirects to your Fuseki content-negotiable endpoint. *Do not use bare backend.localhost URIs in the paper.*
3. The `owl:sameAs` link to Wikidata must be asserted in your graph and serialized.
4. The Getty AAT type IRI must actually exist (verify against vocab.getty.edu).
5. The query must execute end-to-end in under 30s against live endpoints. Test it from a fresh machine.

### Figures to accompany

| Fig | Title | Content |
|-----|-------|---------|
| **Fig 4a** | *LOD neighborhood of Krishna Mandir before contribution* | Graph diagram of Wikidata's existing LOD links for the entity — likely sparse, no CIDOC alignment, no AAT type. |
| **Fig 4b** | *LOD neighborhood after contribution* | Same diagram + new edges introduced by HG: CIDOC type, AAT alignment, PROV-O contribution chain, inferred triples. |
| **Fig 4c** | *The federation walk* | Three-pane figure: HG endpoint → Getty endpoint → Wikidata endpoint, with the resolved triples flowing across. Annotate with response sizes and latencies. |
| **Fig 4d** | *Coverage delta* | Bar chart: for the N entities contributed during the study window, count of Getty alignments, Wikidata sameAs links, inferred triples. |

### Narration (template for §6)

> We selected the Krishna Mandir at Patan Durbar Square (Wikidata Q3196273) as a demonstrator entity. Before contribution, Wikidata recorded only basic instance-of and location triples for this entity; no CIDOC-CRM type assertion, no Getty AAT architectural-style alignment, and no PROV-O contribution provenance existed in the LOD cloud. After contribution through the HeritageGraph workflow, the entity is assigned a CIDOC-CRM E22_Human-Made_Object type, aligned to Getty AAT 300xxx (shikhara), linked to Wikidata via owl:sameAs, and carries PROV-O provenance recording the contributor, reviewer, and timestamp. Listing 1 shows the three-endpoint SPARQL federation query that traverses HG → Getty AAT → Wikidata to resolve the entity. The query returns labels in English, Newari (nwe), and Nepali (ne), the architectural-style concept hierarchy from Getty, and Wikidata's geographic coordinates and image — all in a single round-trip, with HeritageGraph acting as the originating endpoint. **This is the result.** The same query path used to traverse European heritage collections now traverses Newar heritage.

**Do not** narrate this as "we demonstrate a federation query." Narrate it as "the entity is now visible to the same crawlers and agents that already index European heritage."

### What you cannot claim from the federation query alone
- That community contribution scales. (That is §5's κ + throughput.)
- That LLM-assisted curation works. (That is a separate ablation.)
- That the alignment is correct in general. (That is the Getty F1 evaluation.)
- That the reasoning is novel. (That is the novelty rate evaluation.)

The federation query is **proof of visibility**, not proof of quality. Quality is §5.

---

## 5. Minimum viable evaluation suite

Four evaluations. Each is small and runnable in days, not weeks. Pre-register every choice in a `evaluation/PROTOCOL.md` committed *before* you run anything, so reviewers can verify you didn't tune to the gold set.

### 5.1 SHACL conformance rate

**Question:** What fraction of the published graph conforms to declared SHACL shapes?

**Methodology:**
1. Define a shape per major CRM class in scope. At minimum: `E22_Human-Made_Object`, `E53_Place`, `E21_Person`, `E5_Event`, `E7_Activity`, `E55_Type`, plus key properties: cardinality on `P2_has_type`, format on `P1_is_identified_by`, datatype on temporal properties.
2. Freeze the shapes file (`evaluation/shapes.ttl`) with a SHA-256 hash, commit it.
3. Materialize the full graph (post-reasoning) to N-Triples.
4. Run `pyshacl --inference rdfs --shapes shapes.ttl --data graph.nt`.
5. Report:
   - Overall conformance: % of focus nodes with zero violations.
   - Per-shape pass rate.
   - Top 5 most-violated constraints, with counts.

**Report format:**
> "Over N=X focus nodes covering Y shapes, the published graph achieves Z% overall SHACL conformance. The most common violation (V%) is missing `crm:P3_has_note` on `E22_Human-Made_Object`, an optional-by-policy field; with this shape relaxed to advisory, conformance rises to Z'%."

**Threats to validity:** SHACL shapes are author-defined. State this. Cite the precedent (Linked.art shapes, CRM-SHACL community profile).

**Time to run:** 1–2 days including shape authoring.

### 5.2 Getty alignment F1

**Question:** How accurate is the system's alignment of HG entities to Getty AAT/TGN/ULAN?

**Methodology:**
1. **Sample:** N=200 HG entities, stratified by CRM class (50 E22 objects, 50 E53 places, 50 E21 persons, 50 E55 types). If a stratum has fewer than 50, take all and rebalance.
2. **Annotators:** Two annotators independently. Both need basic CRM literacy. The student lead + one CAIR-Nepal collaborator works; document who and credit them.
3. **Task:** For each sampled entity, each annotator independently selects the best Getty URI (AAT for type/material, TGN for place, ULAN for person) or "no appropriate match."
4. **Adjudication:** Disagreements resolved by Dr. Chhetri (or a third annotator). Record adjudication time.
5. **Gold set:** The adjudicated set is the gold.
6. **System evaluation:** Run the system's automatic alignment over the same 200 entities. Compute:
   - Precision = TP / (TP + FP)
   - Recall = TP / (TP + FN)
   - F1 = 2PR/(P+R)
   - Per-stratum breakdown.
7. **Report inter-annotator agreement** on the gold-set construction itself (Cohen's κ on agree/disagree at URI level, with "no match" as a category).

**Report format:**
> "On a stratified random sample of N=200 entities, the system's Getty alignment achieves P=X%, R=Y%, F1=Z% (95% CI [...]). Inter-annotator κ on gold-set construction was K. F1 on place entities (TGN) was highest at...; F1 on type entities (AAT) was lowest at..., driven by..."

**Threats to validity:** Sample size. Annotator pool size. Annotator familiarity with Newar heritage. State all three.

**What you cannot claim:** That F1 generalizes beyond Newar heritage. Frame as "F1 on this corpus."

**Time to run:** 1 week (most of it annotation).

### 5.3 Reasoner novelty rate

**Question:** Of the 17,894 inferred triples, how many are non-trivially novel?

**Definition of "novel":** An inferred triple T is *novel* if it is **not** derivable by (a) RDFS subClassOf/subPropertyOf closure alone, **and** (b) single-hop CIDOC-CRM property-chain inference (e.g., `P14_carried_out_by ∘ P107_has_current_or_former_member` produces a one-hop chain — that's not novel).

**Methodology:**
1. Run a baseline closure over the asserted graph with only RDFS rules + CRM property-chain axioms expanded to depth 1. Call the result `G_baseline`.
2. Run the full HermiT reasoning. Call the result `G_full`.
3. Compute `G_novel = G_full \ G_baseline \ G_asserted`.
4. Report `|G_novel| / |G_inferred|` as the novelty rate.
5. Stratified sample of 50 novel triples; have a domain expert classify each as:
   - (a) semantically informative (would help a user/query),
   - (b) tautological-but-non-trivial,
   - (c) noise/error.
6. Report the (a)/(b)/(c) distribution.

**Report format:**
> "Of 17,894 HermiT-inferred triples, N% are not derivable by RDFS + single-hop CRM property chains. Manual classification of a 50-triple stratified sample finds A% semantically informative, B% tautological-but-non-trivial, C% noise. Examples of informative inferences include..."

**Threats:** The novelty definition is author-set. Cite it explicitly.

**What you cannot claim:** That HermiT produces "knowledge discovery." Stick to "non-trivial entailments under the deployed axioms."

**Time to run:** 2–3 days.

### 5.4 Inter-annotator κ on community contribution workflow

**Question:** Is the proposal-review workflow reliable — i.e., do two reviewers reach similar accept/reject/revise decisions on the same proposals?

**Methodology:**
1. **Sample:** N=50–100 real proposals submitted through the workflow during a defined window.
2. **Reviewers:** Two independent reviewers. Document who and their qualifications.
3. **Task:** Each reviewer independently issues:
   - A decision in {accept, revise, reject}.
   - A CIDOC class assignment (single label from the controlled list).
   - A Getty alignment suggestion (URI or "none").
4. **Metrics:**
   - Cohen's κ on the {accept, revise, reject} decision.
   - Cohen's κ (or Fleiss if extended to 3+ reviewers) on the CIDOC class label.
   - Agreement rate on the Getty URI (exact match), and on "any Getty URI vs none" as a coarser metric.
   - Median time per proposal per reviewer.
5. **Report disagreements:** Sample 10 disagreements, qualitatively summarize cause.

**Report format:**
> "Two reviewers independently triaged N=X proposals. Cohen's κ on the accept/revise/reject decision was K1 (substantial agreement, Landis–Koch 1977). κ on CIDOC class assignment was K2; exact-URI agreement on Getty alignment was K3%. Median review time was T minutes per proposal. Disagreements concentrated on... ."

**Threats:** Two reviewers is the minimum. State so. If only one reviewer (you) is available, this evaluation cannot run and **you must drop the "community-validated workflow" claim**.

**Time to run:** 1 week.

### Evaluation summary table (paste into §5)

| Evaluation | N | Headline metric | Time to run |
|---|---|---|---|
| SHACL conformance | All focus nodes | % conformant per shape; overall % | 1–2 d |
| Getty alignment quality | 200 entities | P/R/F1 vs adjudicated gold | ~1 wk |
| Reasoner novelty | 17,894 triples | % non-trivially novel | 2–3 d |
| Reviewer agreement | 50–100 proposals | Cohen's κ on decision and class | ~1 wk |

**Total wall time:** ~3 weeks if run in parallel. **Do not skip any.** Each maps to a specific reviewer attack vector.

---

## 6. Related systems comparison table

For §2. Cite from primary sources only — not blog posts.

| Axis | **HeritageGraph** | **ResearchSpace** (British Museum / Metaphacts) | **ArCo** (ICCU / Italian MiBACT) | **WissKI** (German CH consortium) | **Linked.art** (consortium profile) |
|---|---|---|---|---|---|
| **Primary domain** | Newar/Nepali heritage (Global South exemplar) | Museum collections (British Museum core) | Italian state cultural heritage catalog | German Sprachraum CH research projects | Art-museum cross-institution profile |
| **Geographic coverage** | South Asia | UK / global museum holdings | Italy | Germany + neighbors | International (LA-county-led, mostly US/EU) |
| **Ontology** | CIDOC-CRM + OWL-DL + LinkML + PROV-O | CIDOC-CRM (Metaphacts platform) | CIDOC-CRM-derived, custom extensions | CIDOC-CRM + project-specific extensions via Erlangen-CRM | CIDOC-CRM-derived JSON-LD profile |
| **Reasoning** | HermiT (materialized inference, SHACL gates) | Platform-dependent, typically none asserted | RDFS-level, no DL reasoner reported | Project-dependent | None (profile, not reasoning system) |
| **Validation** | SHACL shapes (declared) | Platform-level constraints | Custom validation | Drupal/WissKI field-level | JSON Schema + SHACL community efforts |
| **Triplestore** | Oxigraph (embedded) + Fuseki (federated) | Blazegraph / Stardog | Virtuoso | Various (often GraphDB) | Endpoint-agnostic |
| **Community contribution model** | **Open: proposal → expert review → publish pipeline, with LLM-assisted classification** | Closed (curatorial staff) | Closed (institutional catalogers) | Project-team only | N/A (profile, not platform) |
| **LLM-assisted curation** | **Yes, instrumented as a methodology component** | No (as of public documentation) | No | No | N/A |
| **Multilingual / non-Latin script support** | English, Nepali, Newari (Devanagari + Ranjana research) | Multilingual via SKOS labels | Italian + multilingual SKOS | German-focused, multilingual via SKOS | Multilingual via JSON-LD `language` keys |
| **OCR for source documents** | **Yes: Devanagari OCR benchmark (Tesseract, EasyOCR, Bhashini Dhruva)** | N/A | N/A | N/A | N/A |
| **Geographic visualization** | Cesium-based 3D Atlas | 2D maps via platform widgets | 2D maps | Project-dependent | N/A |
| **License (code)** | **Apache-2.0** *(to declare)* | Apache-2.0 (Metaphacts community) / commercial | EUPL / open | GPL-family / open | CC-BY (profile docs) |
| **License (data)** | **CC-BY-4.0** *(to declare)* | Institution-dependent | CC-BY | Institution-dependent | Institution-dependent |
| **TK Labels / CARE alignment** | **Documented in §8** | Not documented in public materials | Not documented | Not documented | Not in profile scope |
| **Deployable artifact** | **Yes: Docker Compose, Make targets, Zenodo DOI** | Platform-as-service, deployable but commercial-leaning | Web service; codebase partially open | WissKI is a Drupal distribution, deployable | N/A — profile, not deployment |
| **Reasoning + reproducibility claim** | **Pinned ontology IRI, frozen shapes, CI reasoner gate** | Not documented | Versioned releases | Project-dependent | Versioned profile |

**Bolded cells = differentiators where HG distinguishes itself.**

**Honest concessions to include in prose, not the table:** ResearchSpace and ArCo dwarf HG on scale; Linked.art has stronger cross-institutional adoption; WissKI has longer track record. Concede these in §2. You are not claiming to be bigger or older; you are claiming to be the first community-contributable Global-South-focused instance with this stack.

**What you cannot claim from this table:**
- "Better." Use "different design choices addressing different requirements."
- That competitors *cannot* do community contribution — they may; document only what is *publicly documented* about them.

---

## 7. §Ethics, FPIC, and data sovereignty

This section is short but high-stakes. Editor-level rejections often come from a missing or weak ethics section on community heritage data.

### What to include

#### 7.1 Framing
> Newar heritage is a living tradition stewarded by Newar communities in the Kathmandu Valley. Digitizing heritage data without explicit attention to community authority, benefit, and control risks reproducing extractive patterns of colonial-era documentation. We adopt the **CARE Principles for Indigenous Data Governance** (Collective benefit, Authority to control, Responsibility, Ethics; Carroll et al., 2020) as complementary to FAIR.

#### 7.2 Free, Prior, and Informed Consent (FPIC)
State explicitly:
- Who was consulted (named institutions and community representatives — name them only with their consent).
- When (dates).
- What was agreed (scope of data, withdrawal terms, attribution).
- What was not consulted yet (be honest — list gaps).

**If no formal FPIC has been conducted yet,** write:
> Formal FPIC processes with community stewards are in progress and will be completed before the corpus expands beyond [scope]. The current deployment uses only [publicly available / previously-published / institutionally-cleared] data. A community advisory process, documented in supplementary material, governs additions.

This is acceptable to *npj HS* if honest and specific. What is **not** acceptable is silence.

#### 7.3 Traditional Knowledge (TK) Labels
Apply Local Contexts labels (localcontexts.org) where appropriate:
- **TK Attribution (TK A)** — attribution to community of origin.
- **TK Verified (TK V)** — community-verified accuracy.
- **TK Community Voice (TK CV)** — non-community interpretations flagged.
- **TK Outreach (TK O)** — appropriate-use guidance.
- **BC Notices** — biocultural notices on sacred or restricted content.

For each label adopted, state which CIDOC-CRM property carries it and how it propagates to the LOD cloud.

#### 7.4 Data sovereignty
- **Hosting jurisdiction:** state where servers are physically located and which jurisdiction governs the data.
- **Withdrawal mechanism:** how a community member can request takedown of an entity, what the SLA is, and how the LOD-cloud tombstone is handled (HTTP 410 + PROV-O retraction).
- **Sensitive geocoordinates:** policy on whether precise locations of sacred sites are published (default: SHOULD be coarsened or withheld).

#### 7.5 Repatriation-contested objects
A specific subsection. Newar heritage includes objects in foreign museum collections with contested provenance.
- State the platform's policy: HG records *both* current physical location *and* community-asserted origin location as separate `crm:E53_Place` assertions linked by a contestation-typed relation; PROV-O records the assertion source.
- Cite the demonstrator entity in §4 as deliberately non-contested. Discuss one contested case briefly to show the policy works.

#### 7.6 Limitations
- Honestly: a single deployment with a single community-consultation process is not a generalizable ethics framework.
- The methodology is *open to* CARE/FPIC but does not by itself guarantee compliance — that requires ongoing community governance.

### What you cannot write in §8 without evidence

- "Community-driven" without a named community partner.
- "Co-created with the Newar community" — only if there were actual co-design sessions, documented.
- "Endorsed by [organization]" — only with written endorsement.
- "Decolonizing" — a contested adjective in this literature. Use it only if your engagement actually constitutes decolonial practice; otherwise "redistributive" or "Global-South-centered" is safer.

---

## 8. Risk-to-claim mapping (what you cannot say without what evidence)

| Desired claim | Evidence required | Status |
|---|---|---|
| "First CIDOC-CRM deployment for Nepali heritage" | Documented literature scan | Not done |
| "Community-contributable" | At least 3 named community contributors with consent to be named, OR explicit reframing to "designed for community contribution" | Verify before writing |
| "LLM-assisted curation improves throughput" | Throughput numbers with and without LLM | Need to run |
| "LLM-assisted curation improves quality" | Quality A/B; drop this claim if not run | High effort — recommend dropping |
| "SHACL-validated" | §5.1 results | Run before submission |
| "Aligned to Getty" | §5.2 results | Run before submission |
| "Reasoner produces novel triples" | §5.3 results | Run before submission |
| "Reliable expert-review workflow" | §5.4 results | Run before submission |
| "Visible in the LOD cloud" | §4 federation query running against live endpoints | Run and screenshot before submission |
| "Reproducible" | Zenodo DOI + `make verify` success on a clean machine | Test on a clean VM |
| "FAIR-compliant" | License, PID, machine-readable metadata, MIME negotiation | License is B1; rest tractable |
| "CARE-aligned" | Documented community engagement, TK labels in the data | Partial — be honest about partial |
| "Transferable" | One worked sketch of redeployment to another corpus | 1–2 paragraphs sufficient |
| "Outperforms ResearchSpace/ArCo/WissKI/Linked.art" | **Don't claim this.** | Drop |

---

## 9. Pre-submission checklist (don't skip any)

- [ ] License declared and committed (CC-BY-4.0 data, Apache-2.0 code).
- [ ] `LICENSE` and `LICENSE-DATA` files present at repo root.
- [ ] Ontology has `dct:license` metadata.
- [ ] `paper-v1.0` tag cut.
- [ ] Zenodo deposit with DOI.
- [ ] `w3id.org/heritagegraph/` PURL prefix registered (PR to perma-id/w3id.org).
- [ ] One canonical schema file; others archived or deleted.
- [ ] One canonical auth doc; others archived or deleted.
- [ ] Empty files (`new.owl`, `Dockerfile.keycloak`) removed.
- [ ] `deleted/` directory cleared or excluded from artifact.
- [ ] `evaluation/PROTOCOL.md` committed *before* running evals.
- [ ] All four §5 evaluations run, results in `evaluation/results/`.
- [ ] Federation query runs in <30s from a clean machine against published endpoints.
- [ ] Demonstrator entity has stable w3id PURL that 303-redirects.
- [ ] CARE/FPIC/TK Labels statement drafted and reviewed by Dr. Chhetri.
- [ ] At least one named community partner has reviewed §8.
- [ ] All figures drafted; world-map motivation figure (§1) and federation walk (§6) prioritized.
- [ ] Author contributions statement drafted (lead = student, senior = Chhetri).
- [ ] Competing interests statement.
- [ ] Acknowledgments include CAIR-Nepal funders and named community partners (with consent).
- [ ] Cover letter draft addressing why *npj HS* specifically.

---

## 10. Tactical recommendations for the next 4 weeks

| Week | Focus | Deliverables |
|---|---|---|
| **1** | Hardening sprint | License, doc cleanup, `paper-v1.0` tag, Zenodo deposit, w3id PURL, demonstrator entity selection, `evaluation/PROTOCOL.md` |
| **2** | Run evaluations | SHACL conformance, reasoner novelty, federation query end-to-end |
| **3** | Run evaluations + write | Getty F1 annotation + adjudication, reviewer κ task, start drafting §3 + §5 |
| **4** | Draft + review | Full draft, internal review with Dr. Chhetri, address one external reviewer's feedback, submit |

**If you are behind on week 1 deliverables by end of week 2, delay submission.** A rejected submission costs more than a 6-week delay.

---

## 11. What I cannot help you with

- **Real community engagement.** A document cannot manufacture FPIC. If §8 is currently aspirational, prioritize one real community consultation in week 1.
- **Wikidata Q-numbers for entities that don't have them.** If your demonstrator entity isn't on Wikidata yet, you need to create the Wikidata item *before* the paper goes out — and disclose that you did so.

---

*End of plan. Use this document as the contract between you and the paper. When in doubt, return to §0 (desk-reject blockers) and §8 (claim-to-evidence map).*
