# HeritageGraph — Developer Setup Guide

A step-by-step guide to running HeritageGraph locally. Two paths are provided:

- **[Path A — Local](#path-a-local-dev)** — Django + Next.js running directly on your machine, SQLite database, no Docker required. Best for rapid feature iteration.
- **[Path B — Docker Compose](#path-b-docker-compose-dev)** — Full stack in containers with Traefik, PostgreSQL, Redis, and Oxigraph. Mirrors production topology.

Both paths work on **macOS, Linux, and Windows** (Windows requires Git Bash or WSL2 for `make` commands).

---

## Prerequisites

Install the following before continuing. Version requirements are strict — mismatches cause subtle failures.

| Tool | Required version | Install |
|------|-----------------|---------|
| Git | any recent | [git-scm.com](https://git-scm.com) |
| Python | **3.12** | [python.org](https://www.python.org/downloads/) · macOS: `brew install python@3.12` · Windows: Microsoft Store or python.org |
| Node.js | **22+** | [nodejs.org](https://nodejs.org) · or [mise](https://mise.jdx.dev) · or [nvm](https://github.com/nvm-sh/nvm) |
| uv | latest | `pip install uv` or `curl -LsSf https://astral.sh/uv/install.sh \| sh` (Mac/Linux) · Windows: `powershell -c "irm https://astral.sh/uv/install.ps1 \| iex"` |
| Docker Desktop | 24+ | [docker.com/get-started](https://www.docker.com/get-started) — required for Path B; optional for Path A |
| make | any | Included on macOS/Linux. Windows: install via [Chocolatey](https://chocolatey.org) (`choco install make`) or use Git Bash with `mingw32-make` aliased to `make` |

> **Windows note:** All `make` commands shown below must run inside **Git Bash** or **WSL2**. PowerShell does not support GNU Make natively.

---

## 1. Clone and switch to the dev branch

```bash
git clone https://github.com/CAIR-Nepal/heritagegraph.git
cd heritagegraph
git checkout v1
```

---

## 2. Configure environment variables

The project uses three `.env` files — one at the repo root (Docker / shared), one for the backend (local dev), and one for the frontend.

### 2a. Root `.env` (Docker Compose / shared secrets)

```bash
cp .env.example .env
```

Open `.env` and set at minimum:

```dotenv
DJANGO_SECRET_KEY=<generate: python -c "import secrets; print(secrets.token_urlsafe(50))">
GOOGLE_CLIENT_ID=<from Google Cloud Console — see §3>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console — see §3>
NEXTAUTH_SECRET=<generate: openssl rand -base64 32>
DB_PASSWORD=changeme          # only matters for Docker path
POSTGRES_PASSWORD=changeme    # only matters for Docker path
```

Everything else has safe defaults for local dev. You do **not** need to fill in Anthropic, OpenRouter, or OCR keys to run the basic platform.

### 2b. Backend `.env` (local dev only)

```bash
cp heritage_graph/.env.example heritage_graph/.env
```

Minimum required:

```dotenv
GOOGLE_CLIENT_ID=<same value as above>
```

The development settings (`DJANGO_ENV=development`) already use SQLite and an insecure `DEBUG=True` secret key — no other changes needed.

### 2c. Frontend `.env.local`

```bash
cp heritage_graph_ui/.env.example heritage_graph_ui/.env.local
```

Edit `heritage_graph_ui/.env.local`:

```dotenv
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<same value as root .env>
GOOGLE_CLIENT_ID=<same value as above>
GOOGLE_CLIENT_SECRET=<same value as above>
NEXT_PUBLIC_API_URL=http://localhost:8000   # local dev; use http://backend.localhost for Docker
```

---

## 3. Google OAuth setup (required for sign-in)

The app authenticates via Google. Without valid credentials the login page will show an error.

1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Create a project (or select an existing one).
3. Click **Create Credentials → OAuth client ID**.
4. Application type: **Web application**.
5. Add **Authorised redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google` (local)
   - `http://frontend.localhost/api/auth/callback/google` (Docker)
6. Copy the **Client ID** and **Client Secret** into the `.env` files above.

> **Skip for quick testing:** Set `HERITAGEGRAPH_DEV_AUTH=true` in `heritage_graph/.env` and `NEXT_PUBLIC_DEV_AUTH=true` in `heritage_graph_ui/.env.local`. This enables a dev-only email/password login that bypasses Google OAuth. Never enable this in production.

---

## Path A — Local dev

No Docker required. Django uses SQLite; Celery tasks run synchronously (no Redis needed).

### Install dependencies

```bash
make setup
```

This command:
- Creates a Python 3.12 virtual environment at `.venv/`
- Installs all Python packages via `uv pip install`
- Runs Django migrations (creates `heritage_graph/db.sqlite3`)
- Runs `npm ci` in `heritage_graph_ui/`

> If `make` is unavailable, run the steps manually:
> ```bash
> uv venv .venv --python 3.12
> uv pip install -r heritage_graph/requirements.txt --python .venv/bin/python
> cd heritage_graph && DJANGO_ENV=development ../.venv/bin/python manage.py migrate && cd ..
> cd heritage_graph_ui && npm ci && cd ..
> ```
>
> On Windows (Git Bash), replace `.venv/bin/python` with `.venv/Scripts/python`.

### Create a superuser (optional)

```bash
make superuser
```

This opens an interactive prompt for username/email/password. Use these credentials to access `/admin/`.

### Start the services

Open **two terminals** from the repo root:

**Terminal 1 — Django API (http://localhost:8000)**

```bash
make backend
```

**Terminal 2 — Next.js UI (http://localhost:3000)**

```bash
make frontend
```

The frontend starts with `NEXT_PUBLIC_API_URL=http://localhost:8000` automatically.

### Verify it works

| URL | What you see |
|-----|-------------|
| `http://localhost:8000/health/` | `{"status": "ok"}` |
| `http://localhost:8000/admin/` | Django admin login |
| `http://localhost:3000` | HeritageGraph dashboard (sign-in required) |
| `http://localhost:8000/schema/` | OpenAPI schema (Swagger) |

---

## Path B — Docker Compose dev

All services run in containers. The stack includes PostgreSQL, Redis, Oxigraph (RDF triplestore), Traefik, the Django backend, and the Next.js frontend.

### Start everything

```bash
docker compose up --build
```

First build takes 5–10 minutes. Subsequent starts are fast (`docker compose up`).

### URLs after startup

| URL | Service |
|-----|---------|
| `http://frontend.localhost` | Next.js UI |
| `http://backend.localhost` | Django API |
| `http://backend.localhost/admin/` | Django admin |
| `http://traefik.localhost:8080` | Traefik dashboard |
| `http://oxigraph.localhost` | Oxigraph SPARQL browser |

> Services use `*.localhost` domains routed by Traefik. On most systems these resolve without `/etc/hosts` changes. If `frontend.localhost` doesn't resolve, add `127.0.0.1 frontend.localhost backend.localhost traefik.localhost` to your hosts file.

### Run migrations inside Docker

```bash
make docker-migrate
# or directly:
docker compose exec backend python manage.py migrate
```

### Create a superuser inside Docker

```bash
docker compose exec backend python manage.py createsuperuser
```

### Tail logs

```bash
make docker-logs
# or a single service:
docker compose logs -f backend
```

### Stop everything

```bash
docker compose down          # keep volumes
docker compose down -v       # also delete data volumes (full reset)
```

---

## Common development commands

All commands assume you are at the repo root.

### Django / backend

| Command | What it does |
|---------|-------------|
| `make migrate` | Apply pending migrations |
| `make migrations` | Generate new migration files |
| `make shell` | Open Django interactive shell |
| `make reset-dev-db` | Wipe and recreate SQLite dev DB |
| `make seed` | Load sample heritage data |

### Frontend

| Command | What it does |
|---------|-------------|
| `cd heritage_graph_ui && npm run dev` | Start Next.js (same as `make frontend`) |
| `cd heritage_graph_ui && npm run lint` | ESLint check |
| `cd heritage_graph_ui && npm test` | Vitest unit tests |
| `cd heritage_graph_ui && npm run build` | Production build check |

### Ontology / schema pipeline

Run these after editing `ontology/HeritageGraph.yaml`:

| Command | What it does |
|---------|-------------|
| `make generate` | Full pipeline: registry → viz → SHACL → serializers → entityrefs |
| `make ontology` | Regenerate `registry.generated.*` only |
| `make shacl` | Regenerate SHACL shapes file |
| `make schema-rebuild` | Persist ontology snapshot to Django DB |

### Knowledge graph

| Command | What it does |
|---------|-------------|
| `make rdf-rebuild` | Reproject curated data into the public RDF graph |
| `make rdf-diagnose` | Report RDF sync config and triple counts |
| `make kg-publish` | Full KG publish pipeline |

---

## Project structure (quick reference)

```
heritagegraph/
├── heritage_graph/          # Django backend (Python 3.12)
│   ├── apps/                # All Django apps (cidoc_data, heritage_data, graph, …)
│   ├── settings/            # development.py · production.py · pipeline_e2e.py
│   ├── manage.py
│   └── db.sqlite3           # auto-created in local dev (gitignored)
├── heritage_graph_ui/       # Next.js 15 frontend (TypeScript)
│   ├── src/app/(dashboard)/ # Route group — all authenticated pages
│   ├── src/components/      # Shared components (shadcn/ui + custom)
│   └── src/lib/             # API clients, auth config, utilities
├── heritage_graph_landing/  # Marketing site (separate Next.js app)
├── ontology/                # LinkML schema + generated artifacts
├── infra/                   # Traefik, Postgres init scripts
├── docker-compose.yml       # Dev stack
├── docker-compose.prod.yml  # Production overrides
├── Makefile                 # All automation targets
├── .env.example             # Root env template
└── CLAUDE.md                # Coding conventions for AI agents
```

---

## Troubleshooting

### `make: command not found` (Windows)

Install Make via Chocolatey in an elevated PowerShell:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
choco install make
```

Or use Git Bash (included with Git for Windows) which has `make` via MinGW.

### Port already in use

```bash
make kill-ports   # frees 8000, 3000, 3001
```

### `uv` not found

```bash
pip install uv
```

Or see [docs.astral.sh/uv](https://docs.astral.sh/uv/getting-started/installation/) for platform-specific installers.

### Migrations fail on startup

If `make setup` errors on migrations (usually after switching branches), reset the dev DB:

```bash
make reset-dev-db
make migrate
```

### Google sign-in returns "redirect_uri_mismatch"

The redirect URI in Google Cloud Console must exactly match the running app's URL. For local dev it must be `http://localhost:3000/api/auth/callback/google` (not `https`, not a different port).

### Frontend shows "Network error" / can't reach API

Check `NEXT_PUBLIC_API_URL` in `heritage_graph_ui/.env.local`:
- Local dev: `http://localhost:8000`
- Docker: `http://backend.localhost`

Then restart the Next.js dev server (it reads `.env.local` at startup).

### RDF sync errors in Docker

The backend writes RDF to Oxigraph on every save. If Oxigraph is not healthy yet, saves still succeed but RDF projection queues for retry. Run `make docker-logs` and wait for `heritage-oxigraph` to report healthy before testing RDF features.

---

## Next steps

- Read `CLAUDE.md` for coding conventions (models, serializers, views, components).
- Read `AGENTS.md` for a full inventory of apps, models, and API endpoints.
- Read `ARCHITECTURE.md` for the service topology and data flow diagram.
- Run `make help` to see all available automation targets.
