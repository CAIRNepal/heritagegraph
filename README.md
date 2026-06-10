# HeritageGraph

HeritageGraph is an initiative taken by researchers at **CAIR-Nepal**.

While many individuals and organizations are doing remarkable work to preserve cultural heritage at the ground level, the growing trend is that today most users discover and interact with knowledge through the internet via browsers, search engines, and even chatbots like ChatGPT.

To make heritage truly accessible in the digital age, we need to go beyond physical preservation and digitally preserve, publish, and democratize access of knowledge where,

- 🕸️ **Crawlers** can crawl,
- 🤖 **Agents** can interact,
- 👩‍💻 **Developers** can query, and
- 💬 **Users** can seek answers through chatbots.

We intend to provide **unparalleled digital access** to the knowledge of our shared heritage.

---

## 🌏 Why Cultural Heritage?

There is a powerful quote:

> _“If you want to know where we should head in the future, then you should know where we came from our past, our shared understanding of it, and the experiences of our forefathers. These things serve as a strong moral compass for where to go and what to pursue in the future.”_

Heritage is not just memory, it’s **direction**.

---

## 🚀 Getting Started

Sounds interesting and want to try it out?

Clone the repository:

```bash
git clone https://github.com/CAIRNepal/CHLOD
```

Switch to the working branch (`v1`):

```bash
git switch v1
```

### Quick Start with Docker (Recommended)

The fastest way to get everything running:

```bash
# 1. Copy the environment template
cp .env.example .env

# 2. Build and start all services
make setup
# Or: docker-compose up --build
```

Once running, access:

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://frontend.localhost | Main application UI |
| Backend API | http://backend.localhost/api | REST API |
| API Docs | http://backend.localhost/docs | Swagger documentation |
| Authentication | NextAuth (Google OAuth in production) | Authentication provider used by the frontend and backend |
| Traefik | http://traefik.localhost:8080 | Reverse proxy dashboard |

> 📖 **Full deployment guide**: See [documentation/deployment/DEPLOYMENT.md](documentation/deployment/DEPLOYMENT.md) for production setup, SSL, backups, and more.

> 📖 **Dokploy**: Compose stack (`docker-compose-dokploy.yml`) and automatic Dokploy redeploy when **`v1`** advances are documented in [DOKPLOY.md](documentation/deployment/DOKPLOY.md) (GitHub Actions hook + optional Git webhook).

### Useful Commands

```bash
make help              # Show all available commands
make docker-up         # Start all Docker services
make docker-down       # Stop services
make docker-logs       # View logs
make backend           # Local Django dev server
make frontend          # Local Next.js dev server
make test-e2e          # Platform E2E test suite
make backup            # Backup database
make prod-up           # Start in production mode
```

---

If you want to contribute :-) \
Here is a guide for setting up frontend and backend.

## 🖥️ Frontend

The frontend is built with **Next.js** and uses **shadcn** components.

> ⚠️ **Note:** Avoid adding custom colors directly to components. We manage colors globally via `global.css` using **tweakcn**.

Setup:

```bash
cd heritage_graph_ui
npm install
npm run dev
```

Access the app at:

- Main app (authenticated UI) → [http://localhost:3000/](http://localhost:3000/)
- Marketing landing (Docker + Traefik) → [http://landing.localhost](http://landing.localhost)
- **Platform admin** (staff or expert curators only) → `/platform-admin/users` — see [Platform admin](#platform-admin-in-app) below

---

## Platform admin (in-app)

The dashboard includes a **platform admin** area for day-to-day user and reviewer access management. It complements the Django admin (`/admin/`): use Django admin for full model access and superuser setup; use the in-app UI for searchable user directory and **reviewer role assignment**.

| | |
|--|--|
| **UI routes** | `/platform-admin` (redirects to `/platform-admin/users`), `/platform-admin/users/[id]` for detail and role assignment |
| **Who can access** | Django **`is_staff`** users, or users with an active **expert curator** reviewer role (`can_manage_roles` in `/api/user/info`) |
| **User directory API** | `GET /data/api/platform-admin/users/` — list & retrieve; supports `search`, `ordering`, and limit/offset pagination |
| **Assign reviewer role** | `POST /data/api/reviewer-roles/assign/` — updates `ReviewerRole` and syncs **`Reviewers`** / **`Moderators`** Django groups |

Ensure role groups exist (e.g. `python manage.py setup_roles`). See [AUTH_ROLES_DEVELOPER_GUIDE.md](documentation/auth/AUTH_ROLES_DEVELOPER_GUIDE.md) for how contributor, reviewer, staff, and `ReviewerRole` map to permissions.

---

## ⚙️ Backend

The backend is powered by **Django REST Framework** and uses **Google OAuth** for authentication (NextAuth issues a Google ID token that Django verifies via `google-auth`).

> ⚠️ **Note:** Make sure to set up the required `.env` file (see `.env.example`).

Setup:

```bash
# From repo root — or use: make setup
python3 -m venv .venv
source .venv/bin/activate   # Linux/Mac
pip install -r heritage_graph/requirements.txt
cd heritage_graph
python manage.py migrate
```

Create a superuser (optional, for admin access):

```bash
python manage.py createsuperuser
```

Run the backend:

```bash
python manage.py runserver
```

Access the backend at (development):

- API → `http://backend.localhost/api` or `http://localhost:8000`
- Admin dashboard → `http://backend.localhost/admin` or `http://localhost:8000/admin` (use superuser credentials)
- Platform admin APIs → under `/data/api/platform-admin/` and `/data/api/reviewer-roles/` (Bearer token; staff or expert curator as documented above)

---

## 🤝 Contributing

- Start from the `v1` branch.
- Open an issue or submit a PR with improvements.

---

## 📚 Documentation for AI Agents & Developers

This project includes comprehensive documentation designed to help both human developers and AI coding assistants work effectively. **See [DOCS.md](DOCS.md) for the full categorized index;** the most-used docs are listed below.

**Documentation hub:** [`documentation/README.md`](documentation/README.md) — topic guides, testing, deployment, and internal notes.

| Document | Purpose |
|----------|---------|
| [AGENTS.md](AGENTS.md) | 🤖 **Start here** — Master guide for AI agents. Project overview, critical rules, directory structure, API summary |
| [documentation/ontology/ONTOLOGY.md](documentation/ontology/ONTOLOGY.md) | 🧬 **Ontology v1.0.0** — registry types, lifecycle events, enums, LUX interop |
| [documentation/contribution/FORMS.md](documentation/contribution/FORMS.md) | 📋 **How forms work** — Add fields, enums, sections, and new entity types |
| [documentation/auth/AUTH.md](documentation/auth/AUTH.md) | 🔐 Authentication — NextAuth + Google OAuth + Django token verification |
| [documentation/auth/AUTH_ROLES_DEVELOPER_GUIDE.md](documentation/auth/AUTH_ROLES_DEVELOPER_GUIDE.md) | 👥 Roles & permissions — contributor / reviewer / staff |
| [CLAUDE.md](CLAUDE.md) | 📝 Coding conventions for Python/Django and TypeScript/Next.js |
| [documentation/developer/SKILLS.md](documentation/developer/SKILLS.md) | 🗺️ Feature capability matrix |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 🏗️ System design — topology, auth flow, data models, Docker |
| [documentation/testing/TESTING.md](documentation/testing/TESTING.md) | ✅ E2E tests and validation (`make test-e2e`, `tests/`) |
| [documentation/TROUBLESHOOTING.md](documentation/TROUBLESHOOTING.md) | 🔧 Known issues, debugging, deploy checklist |
| [documentation/deployment/DEPLOYMENT.md](documentation/deployment/DEPLOYMENT.md) | 🚀 Production Docker, SSL, backups |

> **AI agents:** Read `AGENTS.md` first, then consult other files as needed for your task.

---

## 📜 License

HeritageGraph is released under the [MIT License](LICENSE) — code, ontology, and data. If you
use it in your research, please cite it (see [`CITATION.cff`](CITATION.cff)).


## Nepal Cultural Heritage Linked Open Data (NCHLOD)

The canonical LinkML schema is [`ontology/HeritageGraph.yaml`](ontology/HeritageGraph.yaml) (**v1.0.0**,
event-centric CIDOC-CRM + PROV-O). UI types are listed in `tools/ui-classmap.yaml` (see
[`documentation/ontology/ONTOLOGY.md`](documentation/ontology/ONTOLOGY.md)). Regenerate derived
artifacts with `make generate` or `make ontology`.
