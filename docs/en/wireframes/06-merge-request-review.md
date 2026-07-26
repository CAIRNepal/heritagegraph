# Phases 7–9 — Merge Request, Review & Merge Execution

> Covers: MergeRequest model (TODO), pre-flight conflict diff (TODO), reviewer RDF-star diff view (TODO), approval workflow (TODO), merge execution (TODO), PID minting (TODO), snapshot freeze (DONE model).
> Implementation tasks: `IMPLEMENTATION_PLAN.md § 7-A, 7-B, 7-C, 8-A, 8-B, 9-A`

---

## Feature Spec: MergeRequest Model & Workflow

| Field | Value |
|-------|-------|
| Feature | Formal lifecycle model for proposing a project graph into the main graph |
| Status | `[TODO]` — model, serializer, ViewSet, permissions all missing |
| States | `pending → (changes_requested → pending) or approved → merged` or `rejected` |
| Hard rule | `opened_by` user cannot be the approver — enforced in `CannotApproveOwnMergeRequest` permission |
| Files | `apps/heritage_data/models.py`, `apps/heritage_data/serializers.py`, `apps/heritage_data/views.py`, `apps/heritage_data/permissions.py` |
| API routes | `POST /api/merge-requests/` · `GET /api/merge-requests/{id}/` · `POST /api/merge-requests/{id}/approve/` · `POST /api/merge-requests/{id}/reject/` · `POST /api/merge-requests/{id}/request-changes/` |

---

## Feature Spec: Merge Execution

| Field | Value |
|-------|-------|
| Feature | On approval, apply project graph triples to main graph, mint PIDs, record provenance, freeze snapshot |
| Status | `[TODO]` |
| Files | `apps/graph/merge.py` |
| Steps | (1) SPARQL INSERT from project graph to main; (2) mint global PIDs via `uris.py`; (3) write `MergeActivity` PROV-O triple to outbox; (4) `ProjectSnapshot` + export TTL; (5) `MergeRequest.status = merged`; (6) enqueue nanopub export + VoID regen Celery tasks |
| Acceptance | After approval, `SPARQL SELECT * WHERE { GRAPH <main> { hg:structure/bhairabnath-temple ?p ?o } }` returns the contributed triples |

---

## MergeRequest State Machine

```mermaid
stateDiagram-v2
    [*] --> draft : Project created

    draft --> pending : Contributor opens MR\n(SHACL + LinkML pass)
    pending --> changes_requested : Reviewer: request changes
    changes_requested --> pending : Contributor updates assertions\nand re-opens

    pending --> approved : Reviewer approves\n(different user from opener)
    pending --> rejected : Reviewer rejects\n(archived with reason)

    approved --> merged : execute_merge() completes\n(triples → main graph\nPIDs minted\nsnapshot frozen\nnanopubs emitted)

    rejected --> [*] : Archived\nContributor may resubmit as new project

    merged --> [*] : Project graph frozen\nDOI minted\nContributor notified

    note right of pending
        Reviewers see:
        - RDF-star diff view
        - Source completeness check
        - DocumentationActivity check
    end note

    note right of changes_requested
        Contributor receives:
        - Reviewer feedback text
        - Specific assertion IDs to fix
        - Link back to project workspace
    end note
```

---

## Sequence: Open Merge Request

```mermaid
sequenceDiagram
    actor Contributor
    participant UI
    participant API as MergeRequestViewSet
    participant SHACL as shacl_validate.py
    participant Diff as conflict_diff.py
    participant DB
    participant Notify as Notification service

    Contributor->>UI: Click "Open Merge Request" in project workspace
    UI->>UI: Show MR form: summary, justification, scope (whole/subset)

    Contributor->>UI: Fill summary + justification, submit
    UI->>API: POST /api/merge-requests/ with project_id, summary, justification

    API->>SHACL: validate_project_graph(project_id)
    alt SHACL violations
        SHACL-->>API: conforms=False with violations list
        API-->>UI: 422 with violations
        UI-->>Contributor: Show errors, block submission
    else Clean
        SHACL-->>API: conforms=True
        API->>Diff: compute_diff(project_graph_uri, main_graph_uri)
        Diff-->>API: added list, removed list, conflicts list
        API->>DB: MergeRequest.objects.create with status=pending and conflict_diff
        API->>Notify: notify_reviewers(merge_request)
        API-->>UI: 201 with merge_request_id and status=pending
        UI-->>Contributor: Redirect to merge request page
    end
```

---

## Sequence: Review & Approve

```mermaid
sequenceDiagram
    actor Reviewer
    participant UI as Review UI
    participant API as MergeRequestViewSet
    participant Perm as CannotApproveOwnMR
    participant Merge as merge.py
    participant Oxigraph
    participant Outbox as RDFSyncOutbox
    participant Worker as Celery

    Reviewer->>UI: Open review page for merge request
    UI->>API: GET /api/merge-requests/id/rdf-diff/
    API-->>UI: RDF-star annotated diff with subject, predicate, object, confidence, source per triple
    UI-->>Reviewer: Show side-by-side proposed vs main graph

    Reviewer->>UI: Check every entity has DataSource — pass
    Reviewer->>UI: Check DocumentationActivity present — pass
    Reviewer->>UI: Click Approve

    UI->>API: POST /api/merge-requests/id/approve/ with verification_note
    API->>Perm: CannotApproveOwnMergeRequest.has_permission()
    alt Reviewer == Opener
        Perm-->>API: False
        API-->>UI: 403 Cannot approve your own merge request
    else Different user
        Perm-->>API: True
        API->>DB: Set MergeRequest.status = approved and save
        API->>Merge: execute_merge(merge_request_id)

        Merge->>Oxigraph: SPARQL INSERT project graph triples into main graph
        Oxigraph-->>Merge: 200 OK

        Merge->>Merge: mint_global_pids for new entities
        Merge->>Outbox: INSERT_NT MergeActivity PROV-O triples
        Merge->>DB: Create ProjectSnapshot, export TTL to media/snapshots/
        Merge->>DB: Set MergeRequest.status = merged, save merge_activity_uri
        Merge->>Worker: enqueue export_nanopubs_for_merge
        Merge->>Worker: enqueue regen_void_dcat
        Merge->>Worker: enqueue mint_doi

        API-->>UI: 200 with status=merged, new pids list, snapshot_uri
        UI-->>Reviewer: Show Merged with new PID list
        Worker->>Reviewer: async email — contribution live with DOI
    end
```

---

## Wireframe: Open Merge Request Form (`/contribute/projects/[slug]/merge-request`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Open Merge Request                                                  │
│  Project: Bhairabnath Temple Survey 2026                            │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  Pre-flight checks                                                   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  ✓ LinkML validation     11 assertions pass                    │ │
│  │  ✓ SHACL shapes          no violations                         │ │
│  │  ✓ DL consistency        no disjointness errors                │ │
│  │  ✓ PID uniqueness        no collisions with main graph         │ │
│  │  ✓ Every entity          has a DataSource                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Conflict diff preview                                               │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  + 14 triples to add     (all new — Bhairabnath not in main)  │ │
│  │  ~ 0 conflicts           (no overlapping subjects)             │ │
│  │  - 0 triples to remove                                         │ │
│  │  [View full diff ↗]                                            │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Scope                                                               │
│  [● Whole project graph]  [○ Select subset of entities]             │
│                                                                      │
│  Summary *                                                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Documents Bhairabnath Temple with 3 CIDOC entities and 11      │ │
│  │ HeritageAssertions sourced from Slusser 1982 field survey.     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Justification for any conflicts  (none required here)              │
│                                                                      │
│  [Cancel]                              [Open Merge Request →]        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe: Reviewer Diff View (`/review/[id]`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Merge Request #14  ·  Bhairabnath Temple Survey 2026   [pending]   │
│  Opened by: Nabin Oli  ·  2026-06-15  ·  Reviewer: You             │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  [Summary]  [RDF Diff]  [Entity Graph]  [Sources]  [History]        │
│                                                                      │
│  ── RDF-star Diff ─────────────────────────────────────────────────  │
│                                                                      │
│  Show: [● All]  [○ Added only]  [○ Conflicts only]                 │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ + hg:structure/bhairabnath-temple                            │   │
│  │      rdf:type          hg:Temple                             │   │
│  │      hg:name           "Bhairabnath Temple"@en               │   │
│  │      hg:confidence     0.95  ·  source: Slusser 1982        │   │
│  │      hg:reconciled     aat:300007987                         │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │ + hg:structure/bhairabnath-temple                            │   │
│  │      hg:architectural_style  hg:Shikhara                     │   │
│  │      hg:confidence           0.7  ·  source: Slusser 1982   │   │
│  │      hg:reconciled           aat:300002787  ✓               │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │ + hg:enshrinement/3f2a...                                    │   │
│  │      rdf:type          crm:E90_Symbolic_Object               │   │
│  │      hg:enshrined_deity  hg:deity/bhairab                   │   │
│  │      (materialised event node — auto-generated)              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Reviewer checklist                                                  │
│  ☑ Every entity traces to a DataSource                              │
│  ☑ DocumentationActivity present                                    │
│  ☐ Optional: add Verification activity note                         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Verification note (optional)                                  │ │
│  │  [Cross-checked against DoA 1975 survey — consistent          ] │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  [Request Changes]    [Reject ▾]    [Approve & Merge →]            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe: Post-Merge Notification

```
┌─────────────────────────────────────────────────────────────────────┐
│  ✓ Merge Request #14 — Merged                                       │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  Your contribution is now part of the HeritageGraph knowledge base. │
│                                                                      │
│  New global PIDs                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  hg:structure/bhairabnath-temple-taumadhi                     │ │
│  │  hg:deity/bhairab-taumadhi                                    │ │
│  │  hg:enshrinement/bhairab-in-bhairabnath                       │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Nanopublications (11 assertions → 11 nanopubs)                     │
│  https://w3id.org/heritagegraph/nanopub/np_4f2a...                 │
│                                                                      │
│  Dataset citation                                                    │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  DOI  10.5281/zenodo.xxxxxxx  [Copy citation] [View ↗]       │ │
│  │  CAIR-Nepal (2026). HeritageGraph — Nepalese Cultural         │ │
│  │  Heritage LOD, v1.3. Zenodo. doi:10.5281/zenodo.xxxxxxx      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  [View entities in Atlas →]  [Query SPARQL endpoint →]              │
└──────────────────────────────────────────────────────────────────────┘
```
