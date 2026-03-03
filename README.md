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
| Keycloak | http://keycloak.localhost | Identity management |
| Traefik | http://traefik.localhost:8080 | Reverse proxy dashboard |

> 📖 **Full deployment guide**: See [DEPLOYMENT.md](DEPLOYMENT.md) for production setup, SSL, backups, and more.

### Useful Commands

```bash
make help           # Show all available commands
make up             # Start services
make down           # Stop services
make logs           # View logs
make health         # Check service health
make backup         # Backup database
make prod-up        # Start in production mode
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

- Landing page → [http://localhost:3000](http://localhost:3000)
- Dashboard → [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

---

## ⚙️ Backend

The backend is powered by **Django REST Framework** and uses **Keycloak** for authentication (JWT via OIDC).

> ⚠️ **Note:** Make sure to set up the required `.env` file (see `.env.example`).

Setup:

```bash
cd .. # Make sure you are in main directory
python -m venv .myvenv
source .myvenv/bin/activate  # Linux/Mac
pip install uv
uv pip install -r requirements.txt
python manage.py makemigrations
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

Access the backend at:

- API → [http://37.27.182.103:8000](http://37.27.182.103:8000)
- Admin dashboard → [http://37.27.182.103:8000/admin](http://37.27.182.103:8000/admin) (use superuser credentials)

---

## 🤝 Contributing

- Start from the `v1` branch.
- Open an issue or submit a PR with improvements.

---

## 📚 Documentation for AI Agents & Developers

This project includes comprehensive documentation designed to help both human developers and AI coding assistants work effectively:

**Documentation site:** A consolidated MkDocs site lives in the `docs/` folder and is configured to publish to GitHub Pages via CI. Visit the published site at: https://cairnepal.github.io/heritagegraph/ (update if your org URL differs).

| Document | Purpose |
|----------|---------|
| [AGENTS.md](AGENTS.md) | 🤖 **Start here** — Master guide for AI agents. Project overview, critical rules, directory structure, API summary |
| [FORMS.md](FORMS.md) | 📋 **How forms work** — Add fields, enums, sections, and new entity types. Registry-driven form system guide |
| [AUTH.md](AUTH.md) | 🔐 Authentication system — NextAuth + Google OAuth + Django token verification |
| [CLAUDE.md](CLAUDE.md) | 📝 Coding conventions and patterns for both Python/Django and TypeScript/Next.js |
| [SKILLS.md](SKILLS.md) | 🗺️ Feature capability matrix — maps every feature to exact files with status indicators |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 🏗️ System design with ASCII diagrams — network topology, auth flow, data models, Docker lifecycle |
| [CONVENTIONS.md](CONVENTIONS.md) | 📏 Naming rules, import ordering, code style patterns for all languages in the project |
| [PLATFORM_PLAN.md](PLATFORM_PLAN.md) | 🗺️ Contributing platform vision — phased roadmap, data flow, API contracts |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | 🔧 Known issues, gotchas, debugging tips, and deployment checklist |
| [DEPLOYMENT.md](DEPLOYMENT.md) | 🚀 Full deployment guide — Docker setup, production config, SSL, backups, monitoring |

> **AI agents:** Read `AGENTS.md` first, then consult other files as needed for your task.

---

## 📜 License

The license for this project is yet to be finalized. We’ll choose one that both empowers the community and benefits this project :-)


# Nepal Cultural heritage Linked Open Data (NCHLOD)
This repository contains the LinkML code for NCHLOD. It includes the following components:

1. `schema.yaml`: Defines the schema for NCHLOD.
