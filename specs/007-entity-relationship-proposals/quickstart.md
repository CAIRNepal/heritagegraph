# Quickstart: Knowledge Graph Proposals (007)

## Migrate

```bash
cd heritage_graph && DJANGO_ENV=development python manage.py migrate
```

## Seed predicates

```bash
DJANGO_ENV=development python manage.py seed_relationship_predicates
```

## API (Bearer auth)

- `GET/POST /data/entity-proposals/` — list/create  
- `PATCH /data/entity-proposals/<uuid>/` — draft only, author  
- `POST /data/entity-proposals/<uuid>/submit/` — author  
- `POST …/withdraw/` — author  
- `POST …/approve/` — Moderators group or staff  
- `POST …/reject/` — moderator; JSON `{ "comment": "…" }`  
- `GET …/audit/`  

Same shape under `/data/relationship-proposals/` plus:

- `GET /cidoc/relationship-predicates/` — vocabulary  
- `GET /cidoc/entity-clusters/suggest-duplicates/?q=prithvi` — duplicate hints  

Versioned prefix: `/api/v1/data/…`, `/api/v1/cidoc/…`.

## UI

- Contribute: `/contribute/entity-proposal`, `/contribute/relationship-proposal`  
- Curation → Identity hub lists links to proposal queues.
