# Research: Grounded frontend chatbot

**Feature**: `specs/003-grounded-chatbot/spec.md`  
**Plan**: `specs/003-grounded-chatbot/plan.md`  
**Date**: 2026-04-18

## R-001 — Where chat completion runs (BFF vs Django)

**Decision:** Implement **grounded chat completion on the Django API** as a new **versioned** endpoint (e.g. under `api/v1/assistant/…`), with the **LLM and retrieval logic server-side**. The Next.js apps call it with `getPublicApiUrl()` and, when the user is signed in, `Authorization: Bearer <session.accessToken>`.

**Rationale:** Keeps model/provider keys off the client, matches the spec’s need for **trustworthy** answers tied to **authoritative** data, and reuses the repo’s existing **Anthropic** usage pattern (`document_processing` already depends on `anthropic`). A thin Next.js `route.ts` that proxies to the same API would add latency and duplicate auth without benefit unless streaming is required in v1.

**Alternatives considered:**

- **Next.js Route Handler only** — *rejected* for v1: secrets in server env still OK, but duplicates DRF auth/token verification and drifts from “DRF is the product API” conventions.
- **Client-side LLM** — *rejected*: exposes keys or forces a public “prompt API” with no strong grounding.

## R-002 — How “About us and pages” are grounded

**Decision:** Use a **two-layer** grounding pack:

1. **Curated site copy** in the backend repo as **version-controlled markdown (or similar)** under a new `apps/assistant/grounding/` (or `heritage_graph/apps/assistant/grounding/`) directory—sections for mission, product overview, and pointers to in-app paths (e.g. contribute, knowledge areas). This file is the **source of truth** the assistant must prefer for “what is HeritageGraph / how do I use it” style questions, and can be **manually** aligned with `(dashboard)/about/page.tsx` content when marketing copy changes.
2. **Retrieved CIDOC/heritage facts** by calling **existing** read-only capabilities: in-process reuse of the same query logic as `universal_search` and/or `public_discovery` in `apps/cidoc_data/views.py` (import service helpers rather than HTTP self-calls) to build a **compact context block** (top matches, trimmed fields) for the user’s latest message.

**Rationale:** Fully automatic scraping of React pages is brittle; the spec’s success criteria (alignment with public pages) is satisfied if product owners **treat the grounding file as the assistant’s canonical “About” slice** and update it alongside `about` page edits. The graph data layer already exposes **search/discovery**—ideal for “monument / festival / …” questions.

**Alternatives considered:**

- **RAG with embeddings + vector DB** — *deferred* unless retrieval quality is insufficient: adds infra and ops; start with **keyword search + cap context size** + **strict system prompt** (“only use provided context”).
- **Client sends page HTML** — *rejected* as sole source: user-tamperable; OK later as a **supplemental hint** if needed, not the authority for mission/policy text.

## R-003 — LLM provider and model

**Decision:** Use **Anthropic Messages API** (already in use for `document_processing` vision rescue), configured via a **new server env var** (e.g. `ANTHROPIC_API_KEY` already may exist; if missing, add to `.env.example` without committing values). System prompt: **only answer from the provided context**; if missing, say so and point to “About / browse knowledge” in generic terms.

**Rationale:** One less vendor; operational overlap with existing Python dependency.

**Alternatives considered:** OpenAI / local models — *deferred* unless product mandates; would add deps and key management surface.

## R-004 — Endpoint shape and client wiring

**Decision:** **POST** JSON `ChatCompletionRequest` → JSON `ChatCompletionResponse` (see `contracts/openapi-assistant-chat.v1.yaml`). The UI replaces `getDummyResponse` in `heritage_graph_ui` and `heritage_graph_landing` with a `fetch` to `{API}/api/v1/assistant/chat/`, reusing `apiFetchJson` (or the same error-handling as other DRF clients) and preserving **message order**, `isLoading`, and **user-visible** `ApiError` / timeout strings.

**Rationale:** One contract for both frontends; dummy keyword router can be retained behind a `NEXT_PUBLIC_ASSISTANT_MODE=dummy` flag for offline demos *only if* needed—default **live API**.

**Alternatives considered:** WebSocket streaming — *out of v1* unless p95 latency fails SC-002 in testing.

## R-005 — Auth and public vs signed-in

**Decision:** **Allow unauthenticated** chat for **read-only, public** graph slices and published site copy; when `Authorization` is present, the backend may include **non-public** fields only where existing view permissions already allow (reuse queryset rules). If that is too heavy for v1, **document** in implementation: v1 = **same as anonymous** for retrieval (still satisfies public spec).

**Rationale:** Spec assumes visitors can use public-grounded content; protected enrichment is a stretch goal behind the same endpoint.

**Alternatives considered:** Chat only when logged in — *rejected*; contradicts landing/public scenarios unless product overrides.

## R-006 — Navigation / “take me to …”

**Decision:** Optional **`nav` path** in the API response, produced only when the model (or a small post-processor) returns a **known, allow-listed** app path (mirroring `dummyResponses`’s `nav` behavior). The UI keeps **client-side** `router.push` / `window.location` for those paths. **No open redirect:** validate against a prefix list (`/knowledge/`, `/contribute`, …).

**Rationale:** Preserves current UX; avoids security footgun from LLM-suggested arbitrary URLs.

## R-007 — Monorepo: two frontends

**Decision:** **Implement in `heritage_graph_ui` first** (dashboard + public surfaces using `ChatWidget`); **port the same** `lib/chat/assistantClient.ts` pattern to `heritage_graph_landing` to avoid long-term drift, or **extract** a tiny shared file if the team prefers (no new package required for v1).

**Rationale:** Code search shows **parallel** `ChatPanel` + `getDummyResponse` in both—both must call the new endpoint for “fully functional.”
