# Data model: Grounded chatbot (API + UI)

**Feature**: `specs/003-grounded-chatbot/spec.md`  
**Plan**: `specs/003-grounded-chatbot/plan.md`

## Overview

The feature adds **ephemeral** chat (no new PostgreSQL tables required for v1). State lives in the **browser** (Zustand store) and in the **request/response** bodies. Optional future persistence (sessions, analytics) is out of scope unless product adds it.

## Client-side entities

### `Message` (existing, `useChatStore.ts`)

- **id**: string (client-generated, unique in thread)
- **role**: `"user" | "assistant"`
- **content**: string (markdown or plain text; `[[…]]` wiki links may continue if API returns them)
- **navigationPath** (optional): in-app path when assistant suggests navigation (e.g. `/knowledge/monument`)

**Validation:**

- Reject **empty/whitespace** `content` for **user** sends (FR edge case).
- **Max input length** enforces a cap (e.g. 2–4k chars) with a user-visible message; exact limit is implementation-tuned to model context policy.

**Transitions:** add user message → set loading → append assistant message or show error (no message append on hard failure, or append assistant “couldn’t complete” per UX choice—prefer **one** pattern documented in `quickstart.md`).

## API request/response (ephemeral, versioned)

### `ChatMessageDTO`

- **role**: `"user" | "assistant" | "system"` (system only if the backend later injects; clients typically send `user`/`assistant` for history)
- **content**: string

### `ChatClientContext` (optional)

- **surface**: e.g. `"public" | "dashboard"` (mirrors `ChatContextProvider`)
- **path**: string — current app path, for allow-listed nav hints
- **locale** (optional): BCP-47 if future i18n; v1 can omit

### `ChatCompletionRequest`

- **messages**: `ChatMessageDTO[]` — at least one **user** turn in the tail; may include **prior** user/assistant pairs for follow-ups.
- **context** (optional): `ChatClientContext`
- **maxContextEntities** (optional, int): cap for retrieved graph rows (server may clamp)

### `SourceAttribution` (optional but recommended for QA / SC-001)

- **id**: string (slug or table primary key as string)
- **type**: e.g. `"graph_monument" | "graph_festival" | "site_doc"` (enum extensible)
- **title**: short label
- **excerpt** (optional): string ≤ ~300 chars for reviewer comparison

### `ChatCompletionResponse`

- **message**: `ChatMessageDTO` — with `role: "assistant"`
- **sources** (optional): `SourceAttribution[]` — **not** user-facing in v1 if clutter; may power devtools or future “citations” UI
- **nav** (optional): string — in-app path; **must** be validated allow-listed server-side
- **error** (optional): for non-2xx, DRF may use standard `{ detail, … }` instead; document in contract

## Server-side (non-DB) bundles

### `SiteGroundingDocument`

- **storage**: one or more files under `apps/assistant/grounding/*.md` (or `.yaml`)
- **content**: free text, structured with headings; loaded at process start or on each request (MVP: read per request with caching).
- **relationships**: *none*; editing is file-based, deployed with the API.

## Retrieval (virtual)

### `RetrievalSnapshot`

- Built per request, not stored:
- **searchQuery**: string (from last user turn)
- **matchedRows**: list of **trimmed** serializer excerpts from CIDOC search/discovery
- **limits**: cap rows and string length to fit model context

## State diagram (client)

```text
idle → [user sends] → sending → (success | error)
  success: append messages, loading false
  error: toast or inline error, loading false, thread preserved
```

## Validation rules (cross-cutting)

- **NAV** in response: must match `^/(knowledge|contribute|...)` allow list (exact allow list in code).
- **PII** in logs: do not log full user prompts in production; align with constitution “sensitive data”.
