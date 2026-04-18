# Tasks: Grounded frontend chatbot

**Input**: Design documents from `/home/nabin2004/Desktop/heritagegraph/specs/003-grounded-chatbot/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi-assistant-chat.v1.yaml`, `quickstart.md`

**Tests**: Not requested in the feature spec; no dedicated TDD/contract test tasks. Optional manual verification is in `quickstart.md` and the Polish phase.

## Constitution Gates (apply to all tasks)

Per `.specify/memory/constitution.md`: no committed secrets; new env names in `.env.example` files; frontend API base from `getPublicApiUrl()` / `NEXT_PUBLIC_*` (no new hardcoded production URLs); protected calls use `Authorization: Bearer <accessToken>` from NextAuth; `ruff` on Python, `next build` on touched TS; Docker/Traefik behavior unchanged except documented env for the backend service.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Safe to run in parallel (separate files, no ordering dependency).
- **[USn]**: User story from `specs/003-grounded-chatbot/spec.md` (US1 = P1, US2 = P2, US3 = P3).
- **Setup** and **Foundational** and **Polish** phases: no story label.

## Path Conventions

Django app under `heritage_graph/apps/assistant/`; main UI in `heritage_graph_ui/src/`; landing in `heritage_graph_landing/src/`. API include in `heritage_graph/urls.py`.

---

## Phase 1: Setup (shared infrastructure)

**Purpose**: New app package, settings, grounded copy, environment documentation.

- [x] T001 Add Django app `heritage_graph/apps/assistant/` with `__init__.py` and `apps.py` using `name = "apps.assistant"`, and register `"apps.assistant"` in `heritage_graph/settings/base.py` `INSTALLED_APPS` list
- [x] T002 [P] Create `heritage_graph/apps/assistant/grounding/site.md` with curated mission/product/usage text aligned with themes in `heritage_graph_ui/src/app/(dashboard)/about/page.tsx` (no HTML—plain markdown for the model)
- [x] T003 [P] Ensure `ANTHROPIC_API_KEY` (or the project’s single Anthropic var) is documented in root `.env.example` and `heritage_graph/.env.example`; confirm `docker-compose.yml` already passes `ANTHROPIC_API_KEY` to the backend and document any new key only in example files, not in git
- [x] T004 [P] Confirm `anthropic` is already listed in `requirements.txt` / `heritage_graph/requirements.txt` (no new dependency for v1 unless a split install path requires adding the package to an optional requirements file the backend image uses)

**Checkpoint**: App importable, grounding file present, env discoverable for operators.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: API route exists and is wired; services package ready. **No user story work should start before this phase completes** (except parallel doc-only work).

- [x] T005 Add `heritage_graph/apps/assistant/urls.py` with a `urlpatterns` list and `heritage_graph/apps/assistant/services/__init__.py` (empty re-export or package marker) so service modules can be imported
- [x] T006 Wire `path("api/v1/assistant/", include("apps.assistant.urls"))` in `heritage_graph/urls.py` next to other `api/v1/` includes; map `path("chat/", ...)` in `heritage_graph/apps/assistant/urls.py` to the post view added in the next tasks

**Checkpoint**: URL namespace resolves; running server returns a defined response for `POST` once the view is implemented in US1.

---

## Phase 3: User Story 1 – Get trustworthy answers in chat (Priority: P1) (MVP)

**Goal** (from spec): Users get answers that reflect real graph data and official site copy, not the dummy keyword router.

**Independent test**: With API + UI wired, ask (1) an “About” style question and (2) a heritage fact findable via public search/discovery; answers should not contradict `site.md` or a manual check against the same entity in the app.

- [x] T007 [US1] Implement `heritage_graph/apps/assistant/services/retrieval.py` to build a bounded text context from CIDOC data by reusing or extracting query logic from `heritage_graph/apps/cidoc_data/views.py` (`universal_search` / `public_discovery` patterns; cap row count and field length per `specs/003-grounded-chatbot/data-model.md`)
- [x] T008 [US1] Implement `heritage_graph/apps/assistant/services/chat_completion.py` to load `heritage_graph/apps/assistant/grounding/site.md`, merge retrieval context, call **Anthropic** with a strict “only use provided context” system prompt, and return assistant text plus optional `sources` / `nav` candidates
- [x] T009 [US1] Implement DRF `POST` handler in `heritage_graph/apps/assistant/views.py` (and optional `heritage_graph/apps/assistant/serializers.py` if you prefer DRF serialization) with request body matching `specs/003-grounded-chatbot/contracts/openapi-assistant-chat.v1.yaml`, return `200` with `{ message, sources?, nav? }` and map upstream failures to `502`/`503` with safe messages
- [x] T010 [US1] Add `heritage_graph_ui/src/lib/chat/assistantClient.ts` that POSTs to `getPublicApiUrl()` + `/api/v1/assistant/chat/`, passes `Authorization: Bearer <accessToken>` when the NextAuth session provides `accessToken`, and throws/returns errors compatible with `heritage_graph_ui/src/lib/api-client.ts` patterns
- [x] T011 [US1] Update `heritage_graph_ui/src/components/chat/ChatPanel.tsx` to call `assistantClient` instead of `getDummyResponse` from `heritage_graph_ui/src/lib/chat/dummyResponses.ts`, preserving message order, `isLoading` in `heritage_graph_ui/src/lib/chat/useChatStore.ts`, and optional `navigationPath` when the API returns `nav`

**Checkpoint**: Primary app chat returns live grounded answers; MVP demonstrable.

---

## Phase 4: User Story 2 – Chat is usable (Priority: P2)

**Goal** (from spec): Clear sending and error states, no stuck loading, empty/oversized input handled, both apps updated.

**Independent test**: Use `specs/003-grounded-chatbot/quickstart.md` items 2–6 (errors, empty send, follow-up in thread) on both UIs.

- [x] T012 [P] [US2] Add request timeout and `AbortController` support in `heritage_graph_ui/src/lib/chat/assistantClient.ts` and map failures to user-visible copy in `heritage_graph_ui/src/components/chat/ChatPanel.tsx` (no infinite `isLoading` per FR-005)
- [x] T013 [P] [US2] Enforce max input length and block empty/whitespace sends in `heritage_graph_ui/src/components/chat/ChatPanel.tsx` (spec edge cases: empty and very long input)
- [x] T014 [US2] Add `heritage_graph_landing/src/lib/chat/assistantClient.ts` and update `heritage_graph_landing/src/components/chat/ChatPanel.tsx` to match the `heritage_graph_ui` behavior (copy or keep in sync with `useChatStore` in `heritage_graph_landing/src/lib/chat/useChatStore.ts` and `getPublicApiUrl` in `heritage_graph_landing/src/lib/config` or equivalent)

**Checkpoint**: Both frontends show grounded answers with robust UX; US2 independent test passes on landing + dashboard.

---

## Phase 5: User Story 3 – Stakeholder trust (Priority: P3)

**Goal** (from spec): No open redirects, reduced fabrication risk, optional `sources` for review.

**Independent test**: `nav` only ever goes to allow-listed internal paths; reviewers can compare `sources` (if exposed) to graph rows; vague questions get deferral, not invention (spot-check with `specs/003-grounded-chatbot/spec.md` Story 3).

- [x] T015 [US3] Implement allow-listed `nav` paths only (e.g. constant prefix set in `heritage_graph/apps/assistant/services/chat_completion.py` or `heritage_graph/apps/assistant/nav_allowlist.py`) and strip or null invalid model suggestions before returning JSON from `heritage_graph/apps/assistant/views.py` (per `specs/003-grounded-chatbot/research.md` R-006)
- [x] T016 [US3] Tighten system/assistant instructions in `heritage_graph/apps/assistant/services/chat_completion.py` for speculation and out-of-context questions; include optional `sources` array in responses from `heritage_graph/apps/assistant/views.py` for internal or future UI citation (per `data-model.md`)

**Checkpoint**: US3 acceptance scenarios reviewable; security footgun for `nav` closed.

---

## Phase 6: Polish & cross-cutting

**Purpose**: Quality gates, operator docs, manual spec validation.

- [x] T017 [P] Run `ruff format` and `ruff check` on `heritage_graph/apps/assistant/` and any edited `heritage_graph/apps/cidoc_data/` modules
- [x] T018 [P] Run `npm run build` in `heritage_graph_ui` and `heritage_graph_landing` after TypeScript changes
- [x] T019 Update `AGENTS.md` at the repository root with a short “Assistant / LLM” section: env vars, cost/latency expectations, and that `POST /api/v1/assistant/chat/` is the supported contract (link to `specs/003-grounded-chatbot/contracts/openapi-assistant-chat.v1.yaml`)
- [x] T020 Manually execute `specs/003-grounded-chatbot/quickstart.md` and note any follow-ups; align `heritage_graph/apps/assistant/grounding/site.md` with `heritage_graph_ui/src/app/(dashboard)/about/page.tsx` if copy drift is found (SC-004)

---

## Dependencies & execution order

### Phase dependencies

- **Phase 1 (Setup)**: No dependencies; start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 (app must be registered before URL include).
- **Phase 3 (US1)**: Depends on Phase 2. **MVP** = Phases 1–3 complete.
- **Phase 4 (US2)**: Depends on Phase 3 (client and API must exist).
- **Phase 5 (US3)**: Depends on Phase 3 (core completion path); can overlap with Phase 4 if staffed (touch different files, but T015/T016 should not race with unfinished T008–T009).
- **Phase 6 (Polish)**: Depends on desired user stories being done (at minimum US1+US2 for a shippable slice).

### User story order

- **US1 (P1)**: First story after Foundational; delivers grounded answers end-to-end.
- **US2 (P2)**: Depends on US1 client+API; extends reliability to both apps.
- **US3 (P3)**: Builds on the live endpoint; can follow US2 or in parallel with US2 if **T014** is already merged (separate files for landing vs allowlist in backend).

### Parallel opportunities

- **T002, T003, T004** (Phase 1) — different files.
- **T012, T013** (Phase 4) — same feature area: one developer can do both in `heritage_graph_ui` sequentially; if two devs, split `assistantClient` vs `ChatPanel` (watch merge conflicts on `ChatPanel.tsx`).
- **T017, T018** (Polish) — ruff vs npm builds in parallel.

---

## Parallel example: User Story 1 (after T006)

```text
# Backend track (one developer)
T007 retrieval.py
T008 chat_completion.py
T009 views.py

# Frontend track (after T009 contract is stable, can start T010–T011 in parallel with T009 once response shape is agreed)
T010 assistantClient.ts
T011 ChatPanel.tsx
```

(Adjust if you prefer API-first: complete T007–T009, then T010–T011 strictly after.)

---

## Parallel example: User Story 2

```text
# Same developer, sequential: T012 (timeout) then T013 (validation) in heritage_graph_ui
# Parallel across repos after US1: Developer A: T012–T013; Developer B: T014 landing
```

---

## Implementation strategy

### MVP (User Story 1 only)

1. Complete Phase 1 and Phase 2.  
2. Complete Phase 3 (US1).  
3. **Stop**: Run manual checks from `specs/003-grounded-chatbot/quickstart.md` for the main UI.  
4. Ship or demo: grounded chat in `heritage_graph_ui` only; landing still on dummy (acceptable only as a **temporary** gap—complete T014 for external parity).

### Incremental delivery

1. **MVP** (Phases 1–3) → internal demo.  
2. **+US2** (Phase 4) → both apps production-ready on UX.  
3. **+US3** (Phase 5) → nav safety + review signals.  
4. **Polish** (Phase 6) → merge readiness.

### Task counts

| Area | Count |
|------|------:|
| Phase 1 (Setup) | 4 |
| Phase 2 (Foundational) | 2 |
| Phase 3 (US1) | 5 |
| Phase 4 (US2) | 3 |
| Phase 5 (US3) | 2 |
| Phase 6 (Polish) | 4 |
| **Total** | **20** |

- **By user story**: US1 = 5 tasks (T007–T011), US2 = 3 tasks (T012–T014), US3 = 2 tasks (T015–T016).

---

## Notes

- `heritage_graph_ui/src/lib/chat/dummyResponses.ts` can remain for optional offline dev toggles, but production path should use the API per `specs/003-grounded-chatbot/plan.md`.  
- If `drf_spectacular` auto-discovers the new view, optionally add schema annotations in `heritage_graph/apps/assistant/views.py` in T019 polish—optional, not a gate.  
- All tasks use checkbox + Task ID + optional `[P]` + story label when required by phase rules.
