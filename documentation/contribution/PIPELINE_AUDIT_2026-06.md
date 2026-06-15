# HeritageGraph — End-to-End Pipeline Audit & npj Readiness

> Senior-engineer + research-rigor audit of the contribution pipeline, with the
> CRITICAL/HIGH fixes applied in this working tree. Status date: 2026-06-13.
> Test suite: **121 passing** (`manage.py test apps`). Frontend: `npm run build` clean.
> No missing migrations. Companion docs: [CONTRIBUTION_FLOW.md](CONTRIBUTION_FLOW.md),
> [CONTRIBUTION_UI_REPORT.md](CONTRIBUTION_UI_REPORT.md),
> [../graph/SPARQL_FEDERATION.md](../graph/SPARQL_FEDERATION.md).
>
> Scope note: the prompt requested Objectives 1, 2, 5, 6 (3 and 4 were not included;
> the constraints list was truncated mid-sentence — flagged, not guessed at).

---

## Objective 1 — End-to-End Pipeline Audit
**Status: PASS** (with the fixes below folded in).

Stage-by-stage, what the code actually does:

| # | Stage | Verified behavior | Notes |
|---|---|---|---|
| 1 | Auth gate | `DevHeaderAuthentication` (X-Dev-User, DEBUG+flag) → Google → GitHub → session → JWT chain; non-Google tokens return None to continue the chain | OK |
| 2 | Form submit | `ContributionFlowMixin.perform_create` requires auth, validates, saves CIDOC row + wrapper + Revision #1 | **now atomic** (was try/except-everything) |
| 3 | Registry validation | `_validate_registry_payload` → LinkML `registry_jsonschema` per class key | runs before save on create and update |
| 4 | Row+wrapper+revision | single `transaction.atomic()` block; FK `cidoc_content_type`/`cidoc_object_id` set | no orphan rows on rollback |
| 5 | Notifications | best-effort after the atomic block; contributor + active reviewers | failure can't roll back the contribution |
| 6 | Reviewer accept | `accept_contribution` transition-guarded, atomic; applies **current_revision** to the row | see post-review fix #1 |
| 7 | Status guard | `canonical_status.can_transition` enforced; `IllegalStatusTransition`→400 | unknown statuses now default-deny |
| 8 | accepted_revision FK | set on accept; backfilled by migration 0027 | head-of-lineage anchor |
| 9 | post_save → on_commit | `rdf_signals.queue_entity_projection` defers store writes to `transaction.on_commit` | no ghost triples on rollback |
| 10 | Publication gate | `is_published_for_rdf` via canonical mapping; withheld + unknown excluded | single source of truth |
| 11 | Triple projection | `rdf:type`, `rdfs:label` (lang-tagged), slot values, **`skos:exactMatch`** for external IDs | not `owl:sameAs` — verified |
| 12 | Assertion edges | `assertion_projection` → public + assertion + prov named graphs; `is_curated_assertion` gate | OK |
| 13 | Oxigraph write + outbox | `_store_replace`; failures → `RDFSyncOutbox`; `drain_pending` retries | **retry now re-checks the gate** (fix) |
| 14 | List visibility | `apply_cidoc_list_visibility` — published default; withheld → owner/staff only | **anon leak fixed** |
| 15 | SPARQL surface | read-only proxy `/api/v1/cidoc/sparql/`; `is_readonly_sparql_query` blocks writes | public route plan in SPARQL_FEDERATION.md |

Divergences found & corrected are listed under Objective 2.

---

## Objective 2 — Industry-Grade Quality Gaps
**Status: PARTIAL → fixed the CRITICAL/HIGH set; MEDIUM/LOW tracked.**

### Applied this pass

| Sev | Finding | Fix | File |
|---|---|---|---|
| CRITICAL | `?status=<withheld>` leaked **every** pending/rejected row to anonymous and non-owner users (missing-username path skipped the owner filter) | non-published status → owner/staff only; anonymous → `queryset.none()`; covers unknown statuses too | `list_visibility.py` |
| CRITICAL | Outbox retry could **republish a withdrawn entity**: a write that failed while accepted, then the entity is rejected, then `drain_pending` replays the stale accepted payload | retry re-derives from the system of record and re-checks `is_published_for_rdf`; withheld → retract, deleted → retract | `outbox.py`, `uris.py`, `cidoc_registry_keys.py` |
| HIGH | DELETE of a published CIDOC row bypassed the staged-edit invariant (published knowledge vanished on a contributor action) | `perform_destroy` blocks non-staff deletion of published rows (curators withdraw; staff hard-delete) | `cidoc_data/views.py` |
| HIGH | Concurrent PATCH/revise → revision-number race → 500 on `unique_together(entity, revision_number)`, losing one edit | `select_for_update` on the entity before allocating the number, in both staging and `create_revision` | `cidoc_data/views.py`, `heritage_data/models.py` |
| HIGH | A non-staff reviewer who promoted a QR note (`contributor="qr:<name>"`) couldn't edit the draft they created | `CidocObjectEditPermission` lets any active reviewer edit `qr:`-contributed rows | `permissions.py` |
| HIGH | Anonymous `POST /public-contributions/` (AllowAny) had no rate limit | per-IP `ScopedRateThrottle` `20/hour` on the create action only | `views.py`, `settings/base.py` |
| MEDIUM | `POST /api/v1/data/cultural-entities/` didn't return `entity_id`/`status` (client couldn't deep-link) | added to `CulturalEntityCreateSerializer` (read-only) | `serializers.py` |
| LOW | Stale `owl:sameAs` wording in projection docstring + flow doc | corrected to `skos:exactMatch` (the code was already correct: `EXTERNAL_MATCH_URI = skos:exactMatch`) | projection + docs |

**RDF-integrity verification (asked explicitly):**
- No path projects a non-accepted entity: gate is checked at save-time (`on_commit`) **and** at drain-time (new). Confirmed by `OutboxStaleReplayTest`.
- `skos:exactMatch` is the external-identifier predicate everywhere in our projection; remaining `owl:sameAs` occurrences are in `lux_museum.py` SPARQL that *reads* Yale LUX's own `owl:sameAs` (their data, inbound) — correct to leave.

### Tracked, not yet done (MEDIUM)

- **Staging invariant still lives in the ViewSet, not the model.** Django admin / shell / management commands can still edit a published row in place and reproject. The deep fix is a guard in a shared service or `MetaData.save`. Documented in CONTRIBUTION_UI_REPORT §4.7.
- **Three review payload dialects** (`/moderate`, `/decide/`, QR `/review/`) remain; fold into one surface post-MVP.
- **`canonical_status` not yet consumed by the UI** (serializers expose it; frontend still reads raw values).

---

## Objective 5 — SPARQL Federation
**Status: PARTIAL (proxy works; public endpoint + reconciliation data needed).**
Full audit, a runnable three-endpoint query against the real Dharahara IRI, and the
exact `docker-compose.prod.yml` + Traefik changes are in
[../graph/SPARQL_FEDERATION.md](../graph/SPARQL_FEDERATION.md). Headlines:
- Oxigraph is internal-only (correct); the read-only in-app proxy already federates.
- **Blocker for a non-empty demo:** zero populated `EntityCluster.external_identifiers`
  in dev → no `skos:exactMatch` triples → nothing to join on. Reconcile the
  demonstrator entities before claiming federation in the paper.
- No Fuseki / second store anywhere (Oxigraph only).

---

## Objective 6 — Test Coverage Gaps
**Status: PASS for the critical modules (8 tests added this pass; 121 total).**

Added in `apps/cidoc_data/test_pipeline_phases.py`:
- `StatusLeakageTest` — anon/other-user cannot list withheld or unknown statuses; owner can (the CRITICAL leak).
- `OutboxStaleReplayTest` — drain does not republish a withdrawn entity.
- `PublishedDeleteGuardTest` — contributor 403 on published delete; unpublished still deletable.
- `PromotedDraftEditPermissionTest` — active reviewer can edit a `qr:` draft; ordinary user cannot.
- `ProjectionTriplesTest` — `rdf_entity_projection` emits type + lang-tagged label with managed predicates.
- (prior pass) canonical transitions, unknown-status withholding, revise-after-changes-requested, re-accept-doesn't-resurrect, accept-syncs-wrapper-name.

CI already exists and is adequate: `.github/workflows/backend-tests.yml` runs
`makemigrations --check`, applies migrations on a fresh DB, and runs `manage.py test`
on push/PR to v1/main; `frontend-checks.yml` covers the UI. **No new CI file needed.**

Still-thin coverage (non-blocking, recommend before camera-ready): `identity_services`
cluster merge/split, `lod_views` content negotiation, assertion edge projection
round-trip.
