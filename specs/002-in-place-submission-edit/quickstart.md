# Quickstart: Verify in-place edit (P1)

**Feature**: `specs/002-in-place-submission-edit`  
**Date**: 2026-04-18

Prerequisites: app running (Docker or local), Google sign-in working, a **CIDOC** record the test user can edit (e.g. create one via contribute, or use an existing one where you are the **contributor**). After the permission change, anonymous PATCH must **fail**; ensure you are **logged in**.

## 1) Spot-check the current bug (before or after for comparison)

1. Open a knowledge **view** for any ontology type, e.g. `/knowledge/person/view/<id>` (or another domain in the registry).
2. Click **Edit** (in the header).
3. **Expected today (bug):** You land on `/contribute/person` with an **empty** “new” form; no **id** in the URL.
4. **Target behavior:** The contribute URL includes the record `id` (e.g. `?id=<uuid>`), the page **loads** then **pre-fills**, and the header text indicates **editing** an existing record.

## 2) API preflight (after implementation)

1. `GET` `{API}/cidoc/persons/{id}/` (replace with the correct `apiEndpoint` for the domain) — expect **200** and JSON with field values matching the view page.
2. `PATCH` the same URL with a tiny change and `Authorization: Bearer <token>` — expect **200**; repeat **GET** to confirm persistence.
3. `PATCH` without auth or as another user — expect **401/403** once permissions are tightened (not **200**).

## 3) UI acceptance (aligns with spec P1)

1. Open edit from the view page: all visible fields in the form match the view’s details for that record.
2. Change one optional field, save: other fields **unchanged** in the app after refresh.
3. Simulated failure: with backend stopped, expect **load error** state, **not** a blank “edit” form.
4. Optional: with two browser windows, two saves — confirm documented behavior (MVP: last write wins, see `research.md` R-007).

## 4) Config reminder

- Frontend must use `NEXT_PUBLIC_API_URL` (or `getPublicApiUrl()` in components that were refactored).
- No hardcoded `http://localhost:8000` in new edit-load paths.

## Reference contract

- See `contracts/openapi-ontology-contribute-edit.v1.yaml` for a representative **GET** + **PATCH** shape (pattern repeats per CIDOC viewset).
