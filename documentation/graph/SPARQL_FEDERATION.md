# SPARQL Federation — Current Surface & Public-Endpoint Plan

> Audit + build plan for the three-endpoint federation demonstrator
> (HeritageGraph ↔ Getty vocabularies ↔ Wikidata). Status date: 2026-06-13.

## 1. Current SPARQL surface (audited)

| Question | Answer |
|---|---|
| Is Oxigraph publicly routed? | **No.** `docker-compose.yml` service `oxigraph` uses `expose: 7878` on the internal `backend` network only — no `ports:`, no Traefik labels. Correct default. |
| Configured client endpoint | `apps/graph/oxigraph/client_oxigraph.py` → `settings.OXIGRAPH_URL` (default `http://localhost:7878`); compose sets `OXIGRAPH_URL=http://oxigraph:7878`, `RDF_QUERY_URL=http://oxigraph:7878/query`, `RDF_ENDPOINT_URL=http://oxigraph:7878/update`. Dev falls back to embedded pyoxigraph at `OXIGRAPH_STORE_PATH`. |
| Second triplestore (Fuseki)? | **None.** Only Oxigraph (`grep -ri fuseki` → only a placeholder filename). |
| Is graph/public queryable over HTTP today? | **Yes, mediated:** `POST /api/v1/cidoc/sparql/` (`SparqlProxyView`) proxies to Oxigraph and rejects writes via `is_readonly_sparql_query()` (rdf_signals.py — regex allowlist of SELECT/ASK/CONSTRUCT/DESCRIBE). The named graph `https://w3id.org/heritagegraph/graph/public` is addressable with `GRAPH`/`FROM`. |
| Resource IRIs | `https://w3id.org/heritagegraph/resource/<registry_key>/<pk>` (`RDF_RESOURCE_BASE_URI`). |

**Conclusion:** the paper's federation claim is *almost* supported today through the
read-only proxy; what's missing is (a) a stable public hostname, (b) SERVICE-clause
support guarantees (Oxigraph supports `SERVICE` for outbound federation since v0.3),
and (c) the external-identifier reconciliation data (`skos:exactMatch` triples) for
the demonstrator entities — dev currently has **zero** populated
`EntityCluster.external_identifiers`, so the join to Wikidata/Getty has nothing to
stand on until reconciliation is run.

## 2. Draft three-endpoint federation query

Demonstrator: **Bhimsen Tower (Dharahara)** —
`https://w3id.org/heritagegraph/resource/monument/21` (real row in the curated DB).
Prefixes are exactly those defined in `apps/graph/ontology_config.py`; Wikidata
*property* IRIs are written in full because `wdt:`/`wd:` are deliberately not in
`RDF_PREFIXES` (only `wikidata:` for the entity namespace).

```sparql
PREFIX heritageGraph: <https://w3id.org/heritagegraph/>
PREFIX crm:      <http://www.cidoc-crm.org/cidoc-crm/>
PREFIX rdfs:     <http://www.w3.org/2000/01/rdf-schema#>
PREFIX skos:     <http://www.w3.org/2004/02/skos/core#>
PREFIX aat:      <http://vocab.getty.edu/aat/>
PREFIX wikidata: <http://www.wikidata.org/entity/>
PREFIX gvp:      <http://vocab.getty.edu/ontology#>   # used only inside the Getty SERVICE

SELECT ?monument ?label ?wd ?wdLabel ?coord ?image ?aatType ?aatPref WHERE {

  # ── 1. HeritageGraph (local graph/public) ────────────────────────────────
  GRAPH <https://w3id.org/heritagegraph/graph/public> {
    BIND (<https://w3id.org/heritagegraph/resource/monument/21> AS ?monument)
    ?monument rdfs:label ?label .
    # Reconciled identity links (written by the identity workspace):
    OPTIONAL { ?monument skos:exactMatch ?wd
               FILTER STRSTARTS(STR(?wd), STR(wikidata:)) }
    OPTIONAL { ?monument skos:exactMatch ?aatType
               FILTER STRSTARTS(STR(?aatType), STR(aat:)) }
  }

  # ── 2. Wikidata: labels, coordinates, image ──────────────────────────────
  OPTIONAL {
    SERVICE <https://query.wikidata.org/sparql> {
      ?wd rdfs:label ?wdLabel FILTER(LANG(?wdLabel) = "en") .
      OPTIONAL { ?wd <http://www.wikidata.org/prop/direct/P625> ?coord }
      OPTIONAL { ?wd <http://www.wikidata.org/prop/direct/P18>  ?image }
    }
  }

  # ── 3. Getty AAT: preferred term + hierarchy for the monument type ───────
  OPTIONAL {
    SERVICE <http://vocab.getty.edu/sparql> {
      ?aatType gvp:prefLabelGVP/gvp:term ?aatPref .
    }
  }
}
LIMIT 10
```

Run it today (mediated proxy):

```bash
curl -s -X POST https://<backend-host>/api/v1/cidoc/sparql/ \
  -H 'Content-Type: application/json' \
  -d '{"query": "<the query above>"}'
```

**Prerequisite for a non-empty federation row:** reconcile Dharahara in the identity
workspace so its cluster carries the Wikidata QID and an AAT type (e.g. *towers
(single built works)*, `aat:300004847`) in `external_identifiers` — the projection
then emits the `skos:exactMatch` triples the SERVICE joins hang off. Do not hardcode
QIDs in the paper before reconciliation; the pipeline must produce them.

## 3. Exposing `sparql.heritagegraph.cair-nepal.org` (exact changes)

**Security model:** never expose Oxigraph's root (it serves `/update`). Route ONLY
`/query` through Traefik, add rate limiting, and keep the store on the internal
network. Two additions to `docker-compose.prod.yml`:

```yaml
  oxigraph:
    # …existing service unchanged, PLUS:
    networks:
      - backend
      - proxy            # NEW: reachable by Traefik
    labels:
      - "traefik.enable=true"
      # Public READ endpoint only — /query, nothing else.
      - "traefik.http.routers.sparql.rule=Host(`sparql.${DOMAIN:-example.com}`) && Path(`/query`)"
      - "traefik.http.routers.sparql.entrypoints=websecure"
      - "traefik.http.routers.sparql.tls.certresolver=letsencrypt"
      - "traefik.http.routers.sparql.middlewares=sparql-ratelimit,sparql-headers"
      - "traefik.http.services.sparql.loadbalancer.server.port=7878"
      - "traefik.http.middlewares.sparql-ratelimit.ratelimit.average=10"
      - "traefik.http.middlewares.sparql-ratelimit.ratelimit.burst=20"
      # CORS so the query is runnable from third-party SPARQL clients (YASGUI):
      - "traefik.http.middlewares.sparql-headers.headers.accesscontrolalloworiginlist=*"
      - "traefik.http.middlewares.sparql-headers.headers.accesscontrolallowmethods=GET,POST,OPTIONS"
```

And DNS: `sparql.heritagegraph.cair-nepal.org` → the Traefik host (same A record as
`api.`). No Django change needed; the in-app proxy (`/api/v1/cidoc/sparql/`) stays as
the authenticated/mediated alternative.

Checklist before flipping it on:
1. `GET https://sparql…/query?query=ASK{}` returns 200; `POST …/update` returns 404 (not routed).
2. Set query limits: run Oxigraph with `--cors` off (Traefik handles it) and front
   with the rate-limit above; document fair-use in the dataset page.
3. Publish the VoID/service description at the landing page with the named-graph IRI.
