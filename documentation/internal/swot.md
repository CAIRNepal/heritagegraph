# SWOT Analysis — HeritageGraph for npj Heritage Science (Nature portfolio)

**Frame:** Reviewer + author dual-perspective. Evidence cited from README, doc filenames, top-level directory structure, and recent commit history only.

---

## 1. Strengths

  <b>S1 — Full-stack, standards-aligned semantic infrastructure (CRITICAL)</b>

  <b>Evidence:</b> Co-presence of <font color="#B1B9F9">ONTOLOGY.md</font>, <font color="#B1B9F9">doc_schema.owl</font>, <font color="#B1B9F9">final_schema.yaml</font>, <font color="#B1B9F9">oxigraph_db/</font>, <font color="#B1B9F9">docker-compose.fuseki.yml</font>, <font color="#B1B9F9">FUSEKI.md</font>, and the commit <i>&quot;add tool to emit minimal SHACL and verify </i>
  <i>intent routes&quot;</i> (89f42850f) indicates a real CIDOC-CRM/OWL-DL/SHACL/PROV-O pipeline backed by both an embedded triplestore (Oxigraph) <b>and</b> a federated SPARQL endpoint (Fuseki). Few
  heritage-informatics submissions ship two graph stores plus a SHACL emitter.
  <b>Leverage:</b> Position the paper as an <i>implemented reference architecture</i>, not a model. Cite Oxigraph + Fuseki as evidence of openness to both embedded and federated deployment topologies.

  <b>S2 — End-to-end ingestion → curation → publish lifecycle (CRITICAL)</b>

  <b>Evidence:</b> Commits in the last cycle cover OCR (<font color="#B1B9F9">OCR_INTEGRATION_SUMMARY.md</font>, <font color="#B1B9F9">feat(ingestion): … OCR preview</font>), supervised document/tabular ingestion wizards, an entity &amp; relationship proposal
   workflow (3a6cf529b, 685a42b07), reviewer triage spec (<font color="#B1B9F9">specs/006-reviewer-triage-and-approval</font>), RDF sync signals (<font color="#B1B9F9">rdf_signals.py</font> in dirty state), and a Cesium-based Heritage Atlas
  (<font color="#B1B9F9">feat(ui): add Heritage Atlas globe workspace</font>). This is rare — most CH-KG papers ship only the schema.
  <b>Leverage:</b> Frame contribution as <i>socio-technical pipeline</i>, not ontology. Quantify human-in-the-loop curation throughput and reviewer SLA — this is the differentiator vs ResearchSpace/ArCo.

  <b>S3 — Domain depth on an under-represented corpus (CRITICAL)</b>

  <b>Evidence:</b> Project framing as Newar/Nepali heritage + <font color="#B1B9F9">TRANSLATION.md</font> + multilingual UI artifacts (<font color="#B1B9F9">site/ne/</font>) + CAIR-Nepal authorship. South Asian / Himalayan intangible heritage is
  critically under-represented in LOD literature dominated by EU/US collections.
  <b>Leverage:</b> Lead the abstract with the gap. Pair with FAIR + CARE narrative; Nature portfolio actively solicits Global South digital infrastructure work.

  <b>S4</b> <b>—</b> <b>Reproducibility-by-construction</b>

  <b>Evidence:</b> <font color="#B1B9F9">Dockerfile.backend</font>, <font color="#B1B9F9">Dockerfile.frontend</font>, <font color="#B1B9F9">docker-compose.{prod,dokploy,coolify,fuseki}.yml</font>, <font color="#B1B9F9">DEPLOYMENT.md</font>, <font color="#B1B9F9">DOKPLOY.md</font>, <font color="#B1B9F9">Makefile</font>, <font color="#B1B9F9">entrypoint.sh</font>, <font color="#B1B9F9">mkdocs.yml</font> + published <font color="#B1B9F9">site/</font>. A
  reviewer can run <font color="#B1B9F9">make setup</font> and replicate.
  <b>Leverage:</b> Submit a Zenodo-archived <font color="#B1B9F9">v1</font> tag as supplementary; include <font color="#B1B9F9">make verify</font> target that runs SHACL + ontology consistency.

  <b>Top 3 prioritized:</b> S1, S2, S3.

  ---
  <b>2. Weaknesses</b>

  <b>W1 — No declared license (CRITICAL, BLOCKING)</b>

  <b>Evidence:</b> README literally states <i>&quot;The license for this project is yet to be finalized.&quot;</i> npj Heritage Science is fully OA and requires FAIR-compliant code + data with a declared open
  license. Without this, the paper is desk-rejectable.
  <b>Mitigation:</b> Adopt CC-BY-4.0 for data + Apache-2.0/MIT for code <b>before submission</b>; commit <font color="#B1B9F9">LICENSE</font> and <font color="#B1B9F9">LICENSE-DATA</font> files; add license metadata to ontology IRI; cite Zenodo DOI in the paper.

  <b>W2 — Documentation drift signalling immature research artifact (CRITICAL)</b>

  <b>Evidence:</b> README says backend uses <i>&quot;Keycloak (JWT via OIDC)&quot;</i> while <font color="#B1B9F9">CLAUDE.md</font> says <i>&quot;NextAuth v4 + Google OAuth&quot;</i>. Three overlapping auth docs (<font color="#B1B9F9">AUTH.md</font>, <font color="#B1B9F9">AUTH_GUIDE.md</font>,
  <font color="#B1B9F9">AUTH_ROLES_DEVELOPER_GUIDE.md</font>). Three schema files (<font color="#B1B9F9">schema.yaml</font>, <font color="#B1B9F9">new_schema.yaml</font>, <font color="#B1B9F9">final_schema.yaml</font>) co-existing. Empty files: <font color="#B1B9F9">new.owl</font> (0 bytes), <font color="#B1B9F9">Dockerfile.keycloak</font> (0 bytes). <font color="#B1B9F9">deleted/</font>
  directory present. Multiple cache strategies (<font color="#B1B9F9">CACHE.md</font> + <font color="#B1B9F9">CACHING_STRATEGY_NO_REDIS.md</font>).
  <b>Mitigation:</b> Freeze a <i>paper-release</i> branch; delete or quarantine stale files; collapse auth docs; pick one schema and label it canonical with a version IRI. Reviewers read repos in 2026.

  <b>W3 — Engineering scale ≠ scientific evaluation (CRITICAL)</b>

  <b>Evidence:</b> The 17,894-inferred-triples figure is operational throughput, not a benchmark. There is no <font color="#B1B9F9">evaluation/</font>, no <font color="#B1B9F9">benchmarks/</font>, no published precision/recall on Getty AAT/TGN/ULAN
  alignment, no inter-annotator agreement artefact in <font color="#B1B9F9">specs/006-reviewer-triage-and-approval</font>, no SHACL conformance report committed. <font color="#B1B9F9">PLATFORM_ISSUES_CHECKLIST.md</font> and <font color="#B1B9F9">UI_UX_AUDIT_ALL_PAGES.md</font>
   suggest a product audit posture, not a research-evaluation posture.
  <b>Mitigation:</b> Add a §Evaluation with: (a) entity-linking F1 against a held-out Getty alignment gold set, (b) SHACL conformance pass-rate over the corpus, (c) reasoner-derived-triple novelty
  rate (how many are non-tautological), (d) reviewer agreement κ on the proposal workflow.

  <b>W4 — Active churn during submission window</b>

  <b>Evidence:</b> Recent commits (<font color="#B1B9F9">feat(cidoc): relationship predicates and binary HeritageAssertion fields</font>, <i>&quot;Restructuring oxigraph components&quot;</i>, <i>&quot;Final testing of oxigraph&quot;</i>) indicate ontology +
  triplestore are still moving. <font color="#B1B9F9">specs/004-yaml-driven-schema</font>, <font color="#B1B9F9">specs/007-entity-relationship-proposals</font> are open spec directories.
  <b>Mitigation:</b> Cut a tagged <font color="#B1B9F9">paper-v1.0</font> release; freeze ontology IRI version; document any post-submission changes in a CHANGELOG referenced in the paper.

  <b>W5 — Newar-specific scope undermines generality claims</b>

  <b>Evidence:</b> README + commit history are entirely Newar/Nepali. No multi-region pilot, no cross-collection federation demonstration in commits.
  <b>Mitigation:</b> Reframe scope as <i>exemplar deployment of a generalizable architecture</i>, not a universal platform. Add a §Transferability subsection with one swappable component diagram.

  <b>Top 3 prioritized:</b> W1, W2, W3.

  ---
  <b>3. Opportunities</b>

  <b>O1 — Global-South digital heritage gap (CRITICAL)</b>

  South Asian / Newar / Himalayan heritage is structurally absent from LOD ecosystems (Europeana, ResearchSpace, ArCo, WissKI). npj Heritage Science explicitly solicits non-EU/non-US
  heritage infrastructure work.
  <b>Leverage:</b> Lead the framing. Cite the gap quantitatively (e.g., proportion of CIDOC-CRM-aligned datasets covering Nepal/South Asia in LOD Cloud).

  <b>O2 — LLM-assisted curation is an emerging publishable angle (CRITICAL)</b>

  <b>Evidence:</b> <font color="#B1B9F9">AGENTS.md</font>, <font color="#B1B9F9">SKILLS.md</font>, <font color="#B1B9F9">.cursor/</font>, <font color="#B1B9F9">.specify/</font> indicate substantial AI-agent-driven workflow. This is a hot venue topic in 2025–26 (LLM + KG construction for cultural heritage).
  <b>Leverage:</b> Add a small ablation: ingestion throughput with vs without agent-assisted curation; F1 of LLM-suggested CIDOC class assignments.

  <b>O3 — Federation/Linked-Data-Fragments demo (CRITICAL)</b>

  <b>Evidence:</b> Co-presence of Fuseki + Oxigraph + Getty alignments + Cesium Atlas. A small SPARQL federation demo (HG ↔ Wikidata ↔ Getty AAT) would directly answer the &quot;so what?&quot; reviewer
  question.
  <b>Leverage:</b> Build one published SPARQL query that traverses 3 endpoints and resolves a Newar entity end-to-end. Include the URL in the paper.

  <b>O4 — FAIR + CARE alignment for indigenous/community heritage</b>

  The CARE principles (Collective benefit, Authority to control, Responsibility, Ethics) for Indigenous data are gaining traction at Nature portfolio. Newar community heritage is a natural
  fit.
  <b>Leverage:</b> Add a §FAIR+CARE compliance table; cite TK Labels.

  <b>Top 3 prioritized:</b> O1, O2, O3.

  ---
  <b>4. Threats</b>

  <b>T1 — Established competitor platforms set the bar (CRITICAL)</b>

  ResearchSpace (British Museum, CIDOC-CRM-native), ArCo (Italian MiBACT, ~169M triples), WissKI (German CH consortium), Linked.art. Reviewers will demand a head-to-head table.
  <b>Mitigation:</b> Include a comparison matrix (ontology depth, reasoning, license, deployment model, languages, OCR, agentic curation). Concede where they win (scale); claim where you differ
  (agent-assisted curation + Global South + reproducibility).

  <b>T2 — Reasoning/SHACL claim is fragile under change (CRITICAL)</b>

  HermiT over an evolving OWL-DL ontology + SHACL shapes can quietly drift to inconsistency. With three schema files committed and active ontology commits, a reviewer running the consistency
   check at review time may get a different result than reported.
  <b>Mitigation:</b> Freeze ontology version IRI; commit reasoner logs and SHACL conformance reports as supplementary data; add CI that re-runs reasoning on every commit and refuses merges that
  change inferred-triple count without explanation.

  <b>T3 — Ethics, FPIC, and repatriation sensitivity (CRITICAL)</b>

  Publishing identifying/location data on Newar heritage objects (especially given Nepal&apos;s contested artifact-repatriation context) without documented community consent and TK Labels invites
   rejection on ethics grounds — increasingly enforced at Nature portfolio.
  <b>Mitigation:</b> Document the FPIC / community-engagement process; apply Local Contexts TK Labels; redact sensitive geocoordinates by default; cite community partners (e.g., Department of
  Archaeology Nepal, Newar heritage trusts) as co-authors or acknowledged stakeholders.

  <b>T4 — Sustainability question</b>

  CAIR-Nepal is a small organization. Reviewers ask: who maintains the IRIs in 10 years? Persistent identifier strategy?
  <b>Mitigation:</b> Register a w3id.org or PURL prefix; mirror to Zenodo; name an institutional steward.

  <b>Top 3 prioritized:</b> T1, T2, T3.

  ---
  <b>5. Reviewer Attack Vectors (npj HS-flavored) &amp; Preemption</b>

  ┌──────┬────────────────────────────────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────┐
  │  #   │                                  Likely objection                                  │                                     Preempt in paper                                      │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ RA1  │ <i>&quot;What is the scientific contribution beyond engineering?&quot;</i>                          │ Lead Section 1 with the <b>gap claim</b> (Global South + agent-assisted curation), not the stack │
  │      │                                                                                    │  list. Move infrastructure description to §3.                                             │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ RA2  │ <i>&quot;How does this differ from ResearchSpace, ArCo, WissKI, Linked.art?&quot;</i>               │ Mandatory §Related Systems with a quantitative comparison table.                          │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ RA3  │ <i>&quot;17,894 inferred triples — what is novel vs tautological CRM expansion?&quot;</i>           │ Report a <b>novelty rate</b>: % of inferred triples not derivable by single-step CRM property    │
  │      │                                                                                    │ chains. Show the histogram.                                                               │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ RA4  │ <i>&quot;Where is the entity-linking evaluation against Getty AAT?&quot;</i>                        │ Provide a gold-standard 200-entity sample with κ and F1.                                  │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ RA5  │ <i>&quot;FAIR compliance: PIDs, license, machine-readable metadata?&quot;</i>                       │ Add §FAIR self-assessment table; resolve W1 (license) and add a w3id namespace.           │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ RA6  │ <i>&quot;Reproducibility: docker image hashes, ontology version IRI, Zenodo DOI?&quot;</i>          │ Cut a <font color="#B1B9F9">paper-v1.0</font> tag; archive on Zenodo; cite DOI in §Data Availability.                  │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ RA7  │ <i>&quot;Ethics / FPIC / TK Labels for community heritage?&quot;</i>                                │ Add §Ethics with community-partner statement and TK label coverage.                       │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ RA8  │ <i>&quot;Sample size and coverage of the deployed instance?&quot;</i>                               │ Report counts per CRM class, geographic coverage map, time-period histogram, growth       │
  │      │                                                                                    │ curve.                                                                                    │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ RA9  │ <i>&quot;Why CIDOC-CRM + LinkML + OWL-DL — isn&apos;t this redundant?&quot;</i>                          │ Justify the layering: LinkML for forms/validation, OWL-DL for reasoning, SHACL for        │
  │      │                                                                                    │ closed-world conformance. Cite Linked.art&apos;s similar three-layer choice.                   │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ RA10 │ <i>&quot;Multiple schema files in the repo (</i><font color="#B1B9F9"><i>new_schema.yaml</i></font><i>, </i><font color="#B1B9F9"><i>final_schema.yaml</i></font><i>) — which is │ Resolve W2 before review; pin one schema; add a </i><font color="#B1B9F9"><i>SCHEMA.md</i></font><i> declaring the canonical IRI.    │</i>
  <i>│      │  canonical?&quot;</i>                                                                       │                                                                                           │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ RA11 │ <i>&quot;NextAuth + Google OAuth tied to a US-vendor identity provider for a heritage </i>     │ Address sovereignty concern; document that institutional SSO / Keycloak is supported      │
  │      │ <i>repository?&quot;</i>                                                                       │ (already in <font color="#B1B9F9">keycloak/</font> directory).                                                         │
  ├──────┼────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ RA12 │ <i>&quot;Reasoner = HermiT but the project also ships Oxigraph (no OWL reasoning) and </i>     │ Diagram the reasoning pipeline; state whether inference is materialized in the            │
  │      │ <i>Fuseki — where is reasoning actually performed in production?&quot;</i>                     │ triplestore or computed offline.                                                          │
  └──────┴────────────────────────────────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────┘

  ---
  <b>6. Weakness → Threat Exposure Map</b>

  ┌─────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────┐
  │    Weakness     │                                              Exposes us to threats                                               │                       Why                       │
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────┤
  │ <b>W1</b> No license   │ T1 (competitor comparison: they all have licenses), T3 (cannot make CARE/TK Label claims without an IP           │ License is foundational; absence amplifies      │
  │                 │ framework), T4 (no license = no sustainable downstream reuse)                                                    │ every other criticism.                          │
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────┤
  │ <b>W2</b> Doc/schema   │ T2 (reviewers run the code and get a different graph than reported), T1 (competitors look mature by contrast)    │ Drift makes the reasoning claim unverifiable.   │
  │ drift           │                                                                                                                  │                                                 │
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────┤
  │ <b>W3</b> No           │ T1 (no quantitative basis to claim differentiation), T2 (no SHACL conformance baseline to anchor reasoning       │ Without evaluation, every comparison reduces to │
  │ evaluation      │ claim)                                                                                                           │  opinion.                                       │
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────┤
  │ <b>W4</b> Active churn │ T2 (reasoning brittleness), T1 (moving target undermines comparison)                                             │ A paper describes a moving artifact.            │
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────┤
  │ <b>W5</b> Newar-only   │ T1 (competitors will be framed as <i>general</i>; you as <i>narrow</i>)                                                        │ Without a transferability section, scope is a   │
  │ scope           │                                                                                                                  │ liability.                                      │
  └─────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────┘

  <b>7. Strength → Threat-to-Opportunity Conversion</b>

  ┌────────────────────────────────────┬────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │              Strength              │    Converts threat     │                                                    Into opportunity                                                    │
  ├────────────────────────────────────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ <b>S1</b> Standards-aligned semantic      │ <b>T1</b> &quot;what&apos;s novel?&quot;     │ <b>O3</b> SPARQL federation demo: only a CIDOC-CRM + Getty + Fuseki+Oxigraph stack supports a 3-endpoint federation query     │
  │ stack                              │                        │ end-to-end.                                                                                                            │
  ├────────────────────────────────────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ <b>S2</b> End-to-end pipeline             │ <b>T1</b> competitor          │ <b>O2</b> LLM-assisted curation paper: existing platforms ship the schema, not the agent-assisted ingestion workflow.         │
  │                                    │ comparison             │                                                                                                                        │
  ├────────────────────────────────────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ <b>S3</b> Newar/Nepali corpus             │ <b>T3</b> ethics scrutiny     │ <b>O1</b> + <b>O4</b> FAIR+CARE Global South exemplar: turn ethics from threat into the paper&apos;s central thesis.                      │
  ├────────────────────────────────────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ <b>S4</b> Reproducibility-by-construction │ <b>T2</b> reasoning fragility │ A <font color="#B1B9F9">make verify</font> target + CI gate <b>operationalizes</b> the reasoning claim, turning a fragility threat into a methodological   │
  │                                    │                        │ contribution.                                                                                                          │
  └────────────────────────────────────┴────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  ---
  <b>8. SWOT 4×4 Strategy Matrix</b>
  
  <b>Column 1:</b> <b>Strengths (S1–S4)</b>
  <b>Opportunities (O1 Gap • O2 LLM-curation • O3 Federation • O4 CARE):</b> <b>SO — Aggressive moves</b> • S1+S3 → O1: lead with &quot;first CIDOC-CRM-aligned, OWL-DL-reasoned KG for Newar heritage&quot; • S2 →
  O2:
     report agent-curation ablation as a contribution • S1 → O3: ship one federated SPARQL query (HG ↔ Wikidata ↔ Getty) in the paper • S4 → O4: a <font color="#B1B9F9">make audit</font> target that prints FAIR+CARE
    compliance evidence
  <b>Threats (T1 Competitors • T2 Reasoning fragility • T3 Ethics • T4 Sustainability):</b> <b>ST — Defensive moves</b> • S1 vs T1: comparison table where standards-completeness is your axis • S4 vs T2:
    pinned ontology IRI + CI reasoner gate; ship <font color="#B1B9F9">reasoner-report.ttl</font> • S2+S3 vs T3: document the community-in-the-loop proposal workflow as the ethics mechanism • S4 vs T4: Zenodo DOI + w3id

    PID + named institutional steward
  ────────────────────────────────────────
  <b>Column 1:</b> <b>Weaknesses (W1–W5)</b>
  <b>Opportunities (O1 Gap • O2 LLM-curation • O3 Federation • O4 CARE):</b> <b>WO — Catch-up moves</b> • W1 → O1/O4: pick CC-BY + CARE-compatible TK labels in one stroke (license decision becomes a
    contribution) • W3 → O2: the missing evaluation can be the LLM-curation evaluation (reuse the work) • W5 → O3: federation  demo <i>itself</i> widens scope without writing more Newar data
  <b>Threats (T1 Competitors • T2 Reasoning fragility • T3 Ethics • T4 Sustainability):</b> <b>WT — Survival moves</b> • W1+W2 vs T1: a 1-week &quot;submission-hardening sprint&quot;: freeze branch, finalize
    license, collapse auth docs, delete empty files, pin one schema • W3 vs T2: minimal acceptable evaluation = SHACL conformance % + 200-entity Getty alignment F1 + reasoner novelty rate •
    W4 vs T2: cut <font color="#B1B9F9">paper-v1.0</font> tag, declare it the artifact-of-record; all later commits go in a CHANGELOG • W2+W3 vs T1: do <b>not</b> submit to npj HS until W1+W2 are resolved; soft-launch as a
    preprint first

  ---
  <b>9. Critical Path Before Submission</b>

  In order, no skipping:

  1. <b>Choose and commit license</b> (W1). Resolves T1, T3, T4 partial.
  2. <b>Cut </b><font color="#B1B9F9"><b>paper-v1.0</b></font><b> release branch</b> and archive on Zenodo (W4, T2, T4).
  3. <b>Collapse documentation drift</b>: one auth doc, one canonical schema, delete <font color="#B1B9F9">new.owl</font>/<font color="#B1B9F9">Dockerfile.keycloak</font>, retire <font color="#B1B9F9">deleted/</font> (W2).
  4. <b>Build the minimal evaluation</b>: SHACL pass-rate, Getty alignment F1, reasoner novelty rate, inter-annotator κ (W3, T1, T2).
  5. <b>Run one 3-endpoint SPARQL federation query</b> and screenshot/document it (O3, ST move).
  6. <b>Draft §Ethics with FPIC + TK Labels + community-partner acknowledgment</b> (T3, O4).
  7. <b>Write §Related Systems comparison table</b> vs ResearchSpace/ArCo/WissKI/Linked.art (T1).

  ---
  <i>Generated from README, doc filenames, top-level structure, and recent commit history only. No source files inspected.</i>
</pre>