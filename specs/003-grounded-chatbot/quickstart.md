# Quickstart: Grounded chatbot verification

**Feature directory**: `specs/003-grounded-chatbot/`  
**Branch**: `003-grounded-chatbot`

## Prerequisites

- Backend running with **assistant** env vars set: **`OPENROUTER_API_KEY`**, **`OPENROUTER_MODEL_STANDARD`**, and optionally `OPENROUTER_MODEL_FAST` / `OPENROUTER_MODEL_PREMIUM` (see root and `heritage_graph/.env.example` for the full set, including optional `ASSISTANT_TIER_*` tuning).
- For **OCR / vision** in `document_processing`, set **`ANTHROPIC_API_KEY`** (direct Anthropic; not used for the in-app chat LLM).
- `NEXT_PUBLIC_API_URL` set to the Django origin (e.g. `http://localhost:8000` in dev, per constitution).
- Frontend: `heritage_graph_ui` dev server; optionally `heritage_graph_landing` for the mirror chat.

## Manual checks (P1/P2 from spec)

1. **Open chat** from a surface that shows `ChatWidget` (landing scroll rule vs dashboard `Cmd+K` / launcher).
2. **Ask a question** whose answer exists in the **grounding** doc (e.g. “What is HeritageGraph?”) — expect an answer that **aligns** with the About / mission phrasing, not a random story.
3. **Ask a heritage fact** (e.g. a monument name) — expect facts that **do not contradict** a manual check against `public_discovery` / the knowledge UI for the same item.
4. **Follow-up** in the same thread (second question referencing “it”) — expect coherent use of **conversation** history, not a reset to generic filler.
5. **Simulate failure** (stop the API or use wrong `NEXT_PUBLIC_API_URL`) — expect a **visible error**; UI must **not** stay in loading forever.
6. **Empty send** — clicking send on empty/whitespace must **not** add a user bubble (matches edge case).
7. **Nav suggestion** (if enabled): ask “take me to monuments” (or similar) — if API returns `nav`, browser navigates to an **allow-listed** path only.

## Reviewer batch (for SC-001/SC-003)

Prepare **20+ scripted prompts** in a doc (not committed if sensitive): 10 from **site/About themes**, 10 from **graph entity** names/descriptions. Two reviewers mark **aligned / partial / not aligned** per rubric in `spec.md`.

## Contract smoke test

- `POST /api/v1/assistant/chat/` (see `contracts/openapi-assistant-chat.v1.yaml`) with a minimal `messages` array; expect `200` and a JSON body with `message.role === "assistant"`.

## Known limitations

- If `OPENROUTER_API_KEY` or `OPENROUTER_MODEL_STANDARD` is missing, the assistant returns **503**; confirm env before manual checks.
- The keyword router in `dummyResponses.ts` is for **local experiments** only if you wire it in dev; production UIs use the live API.
