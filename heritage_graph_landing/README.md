# HeritageGraph — marketing landing

Public **collections discovery** UI for [HeritageGraph](https://github.com/CAIRNepal/heritagegraph) (LUX-style layout: search, category tabs, facet sidebar, result list). Uses the **same CSS design tokens** as `heritage_graph_ui` (primary `#1e4e8c`, surfaces, borders, dark mode). The **in-page chat** calls the Django **assistant** API at `POST /api/v1/assistant/chat/` (see `src/lib/chat/assistantClient.ts`); the backend must have **`OPENROUTER_API_KEY`** and model env vars. Dummy discovery data may still live in `src/data/dummyDiscovery.ts` where the discovery API is not yet wired.

## Local development

```bash
# From repo root (starts on http://localhost:3001)
make landing

# Or from this directory
npm install
NEXT_PUBLIC_APP_URL=http://localhost:3000 npm run dev
```

`NEXT_PUBLIC_APP_URL` must point at the **main app** (`heritage_graph_ui`) so “Sign in”, “Contribute”, category links, and the chat assistant open the correct origin.

Copy `.env.example` → `.env.local` to override.

## Docker / Traefik

Service `landing` in root `docker-compose.yml` — [http://landing.localhost](http://landing.localhost) with the default stack.

## Stack

Next.js 15 (App Router), Tailwind CSS v4, Framer Motion, Zustand, `next-themes`.
