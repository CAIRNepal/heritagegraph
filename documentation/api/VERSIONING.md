# API_VERSIONING.md — API Versioning & How to Add New APIs

HeritageGraph uses **URL path versioning** for the backend API so we can evolve endpoints without breaking existing clients.

## Current versions

- **`v1`**: current stable API

## Base URLs

The same app APIs are exposed via both legacy and versioned prefixes:

- **Legacy (still supported)**:
  - `/data/...` and `/data/api/...`
  - `/cidoc/...`
- **Versioned (recommended for new clients)**:
  - `/api/v1/data/...`
  - `/api/v1/cidoc/...`

## Rules of engagement

- **Do not make breaking changes inside the same version** (`v1`).
- **Breaking changes require a new version** (`v2`), released alongside `v1`.
- **Non-breaking additions** (new fields, new endpoints, new optional query params) can be added to `v1`.

### What counts as “breaking”?

- Removing/renaming a field in a response
- Changing a field type (string → number, object → array, etc.)
- Changing authentication/permissions requirements for an existing endpoint
- Changing URL shape or required query parameters
- Changing semantics of an existing status code (e.g., returning 200 where 404 was returned)

## How versioning works (DRF)

DRF is configured to use `URLPathVersioning`, so the URL determines the version.

- Example: `GET /api/v1/data/cultural-entities/` → `request.version == "v1"`

## Non-breaking changes in `v1` (examples)

Adding **optional** query parameters is allowed in `v1` when it does not change default behavior.

- **Activities filter**: `GET /api/v1/data/activities/?username=<username>`
  - **Purpose**: fetch activity rows for a specific user without downloading a global feed and filtering client-side.
  - **Compatibility**: if `username` is omitted, behavior is unchanged.

## How to add a new endpoint (recommended pattern)

### 1) Prefer ViewSets + routers

Inside an app (e.g. `apps/heritage_data`):

- Add a ViewSet in `apps/<app>/views.py`
- Register it in `apps/<app>/urls.py` on the app `DefaultRouter`

This automatically gives consistent URL patterns, schema generation, pagination, and standard HTTP method behavior.

### 2) Keep response shapes stable

- Add new response fields as **optional** and/or with sensible defaults.
- Avoid changing existing keys or meanings.

### 3) If you need a breaking change, add `v2`

High-level steps:

- Add new versioned URL includes:
  - `path("api/v2/data/", include(...))`
  - `path("api/v2/cidoc/", include(...))`
- Create new ViewSets/serializers that implement `v2` behavior **without** changing `v1`.
- Update docs to clearly mark the differences.

## Client examples

### Using the versioned API (recommended)

```bash
curl -H "Authorization: Bearer <token>" \
  http://backend.localhost/api/v1/data/cultural-entities/
```

Fetch a user’s activity feed (server-side filtered):

```bash
curl -H "Authorization: Bearer <token>" \
  "http://backend.localhost/api/v1/data/activities/?limit=20&username=alice"
```

### Using the legacy API (still supported)

```bash
curl -H "Authorization: Bearer <token>" \
  http://backend.localhost/data/cultural-entities/
```

