# System Overview — Diagrams & Architecture

> Source: `docs/en/plan.md` (12-phase spec) + `docs/en/IMPLEMENTATION_PLAN.md` (grounded tasks)

---

## 1. System Context Diagram

```mermaid
C4Context
    title HeritageGraph — System Context

    Person(contributor, "Contributor", "Community member, researcher, field surveyor")
    Person(reviewer, "Reviewer", "Domain expert + data steward pair")
    Person(curator, "Curator", "Platform admin / moderator")
    Person(consumer, "Data Consumer", "Researcher, chatbot, LOD crawler, SPARQL user")

    System(hg, "HeritageGraph", "Community-curated CIDOC-CRM + PROV-O LOD platform for Nepalese cultural heritage")

    System_Ext(google, "Google OAuth", "Authentication provider")
    System_Ext(orcid, "ORCID", "Researcher identity — provides globally-unique agent URI")
    System_Ext(wikidata, "Wikidata", "Entity reconciliation + skos:exactMatch targets")
    System_Ext(getty, "Getty AAT / TGN / ULAN", "Controlled vocabulary alignment")
    System_Ext(oxigraph, "Oxigraph", "RDF triple store + SPARQL 1.1 endpoint")
    System_Ext(datacite, "DataCite", "DOI minting for dataset versions")
    System_Ext(nanopub, "Nanopublication Network", "Signed, citable assertion archive")

    Rel(contributor, hg, "Submits entities, uploads sources, opens merge requests")
    Rel(reviewer, hg, "Reviews diffs, approves / rejects merge requests")
    Rel(curator, hg, "Manages roles, resolves identity clusters, runs re-reconciliation")
    Rel(consumer, hg, "SPARQL queries, dereferenceable URI lookups, IIIF, REST API")

    Rel(hg, google, "OAuth login")
    Rel(hg, orcid, "ORCID link for researcher attribution")
    Rel(hg, wikidata, "Entity reconciliation")
    Rel(hg, getty, "Vocabulary alignment")
    Rel(hg, oxigraph, "RDF read/write")
    Rel(hg, datacite, "DOI minting on dataset version publish")
    Rel(hg, nanopub, "Publish signed nanopublications per assertion")
```

---

## 2. Container Diagram

```mermaid
C4Container
    title HeritageGraph — Containers

    Person(user, "User")

    Container(frontend, "Next.js 15 UI", "TypeScript / React 19", "App Router, shadcn/ui, Tailwind v4 — serves the contributor, reviewer, and curator dashboards")
    Container(backend, "Django REST API", "Python 3.12 / DRF", "Business logic, provenance capture, Celery task dispatch, SPARQL proxy")
    Container(worker, "Celery Worker", "Python 3.12", "Async: reconciliation, nanopub export, VoID regen, DOI minting")
    ContainerDb(postgres, "PostgreSQL", "Relational DB", "Django ORM: Users, Projects, HeritageAssertions, DataSources, MergeRequests, Revisions")
    ContainerDb(oxigraph, "Oxigraph", "RDF triple store", "Named graphs per project + main graph; SPARQL 1.1 endpoint at :7878")
    Container(traefik, "Traefik", "Reverse proxy", "TLS termination, routing frontend/:443, backend/api/:443, SPARQL/:443")

    Rel(user, frontend, "HTTPS")
    Rel(frontend, backend, "REST JSON — Bearer token from NextAuth session")
    Rel(backend, postgres, "Django ORM")
    Rel(backend, oxigraph, "SPARQL UPDATE / SELECT over HTTP")
    Rel(backend, worker, "Celery task queue (Redis)")
    Rel(worker, oxigraph, "Bulk RDF INSERT")
    Rel(traefik, frontend, "Proxy")
    Rel(traefik, backend, "Proxy /api/")
```

---

## 3. Master End-to-End Process Diagram

Condensed from plan.md's 12-phase flowchart — annotated with implementation status.

```mermaid
flowchart TD
    A0["🔑 Login via Google OAuth\n[DONE]"] --> A1["Link ORCID\n[TODO]"]
    A1 --> A2["Role resolved\ncontributor / reviewer / curator\n[DONE]"]

    A2 --> B0["Create Project\ntitle · scope · license\n[DONE - model exists]"]
    B0 --> B1["Mint project PID\nw3id.org/heritagegraph/project/id\n[TODO]"]
    B1 --> B2["Add collaborators\nviewer / editor / manager\n[DONE - ProjectMembership]"]

    B2 --> C0["Upload files\nimage · PDF · CSV · audio\n[PARTIAL]"]
    C0 --> C1["Type as DataSource subclass\nFieldSurvey / OralHistory / Archival\n[TODO - type field missing]"]
    C1 --> C2["Attach DataCite metadata\n[TODO]"]
    C1 --> C3["Apply CARE / TK labels\naccess_tier + care_labels\n[PARTIAL]"]

    C3 --> D0["Contribute entity\nform driven by ui-classmap.yaml\n[DONE]"]
    D0 --> D1["System materialises event layer\nProduction / Enshrinement / Consecration\n[PARTIAL]"]
    D1 --> D2["Capture HeritageAssertion\nproperty · value · source · author · confidence\n[DONE]"]
    D2 --> D3["Write to project named graph\n[PARTIAL]"]

    D3 --> E0["LinkML validation\n[DONE - partial]"]
    E0 --> E1["SHACL shapes check\n[TODO - pyshacl gate]"]
    E1 --> E2["DL reasoning consistency\n[TODO - HermiT]"]
    E2 --> F0["Reconcile vs Wikidata/Getty\n[PARTIAL - service.py exists]"]
    F0 --> G0["Preview: graph · timeline · map\n[PARTIAL]"]
    G0 --> H0["Open MergeRequest\n[TODO - model missing]"]

    H0 --> I0["Notify reviewers\n[TODO]"]
    I0 --> I1["RDF-star diff view\n[TODO]"]
    I1 --> J{Decision}

    J -->|changes requested| K0["Feedback to contributor\n[TODO]"]
    K0 --> D0

    J -->|approved| L0["Apply triples to main graph\n[TODO - merge.py]"]
    L0 --> L1["Mint global PIDs\n[TODO]"]
    L1 --> L2["MergeActivity provenance triple\n[TODO]"]
    L2 --> L3["Freeze project snapshot\n[DONE - ProjectSnapshot model]"]

    L3 --> M0["Emit nanopublications\n[PARTIAL - export command exists]"]
    M0 --> M1["RDF-star annotations\n[PARTIAL - rdfstar_export.py]"]
    M1 --> M2["Regenerate VoID + DCAT\n[TODO - generator missing]"]
    M2 --> M3["SPARQL endpoint refresh\n[DONE]"]

    M3 --> N0["Dereferenceable URIs\ncontent negotiation\n[PARTIAL - lod_views.py]"]
    N0 --> N1["CARE enforcement at query time\n[TODO - SPARQL proxy]"]
    N1 --> N2["schema.org + sitemaps\n[TODO]"]
    N2 --> N3["DataCite DOI\n[TODO]"]

    N3 --> O0["New evidence → supersedes assertion\n[PARTIAL - supersedes FK]"]
    O0 -->|re-enters review| H0

    style A1 fill:#f9a,stroke:#c66
    style B1 fill:#f9a,stroke:#c66
    style C2 fill:#f9a,stroke:#c66
    style E1 fill:#f9a,stroke:#c66
    style E2 fill:#f9a,stroke:#c66
    style H0 fill:#f9a,stroke:#c66
    style L0 fill:#f9a,stroke:#c66
    style M2 fill:#f9a,stroke:#c66
    style N1 fill:#f9a,stroke:#c66
    style N2 fill:#f9a,stroke:#c66
    style N3 fill:#f9a,stroke:#c66
```

> Red nodes = `[TODO]` in IMPLEMENTATION_PLAN.md — the critical path.

---

## 4. Data Model Overview

```mermaid
erDiagram
    User ||--o{ Project : owns
    User ||--o{ ProjectMembership : "member of"
    Project ||--o{ ProjectMembership : has
    Project ||--o{ ProjectAsset : contains
    Project ||--o{ ProjectSnapshot : "frozen as"
    Project ||--o{ MergeRequest : "opens (TODO)"

    MergeRequest ||--o{ ReviewDecision : "reviewed by"
    MergeRequest }o--|| User : "opened_by"

    HeritageAssertion }o--|| DataSource : "derived from"
    HeritageAssertion }o--o| HeritageAssertion : "supersedes"
    HeritageAssertion }o--o| Project : "scoped to (TODO)"
    HeritageAssertion }o--o| EntityCluster : "membership"

    DataSource ||--o{ HeritageAssertion : supports

    EntityCluster ||--o{ IdentityResolutionCandidate : "resolved via"
    EntityCluster ||--o{ ClusterAuditEvent : "audited by"

    User ||--o{ ReviewerRole : "has role"
    User ||--|| UserProfile : "has (ORCID link TODO)"
```
