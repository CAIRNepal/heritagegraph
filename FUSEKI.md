# Apache Jena Fuseki (standalone)

This repository includes a **Fuseki-only** Compose stack using the community image [`stain/jena-fuseki`](https://hub.docker.com/r/stain/jena-fuseki): a **SPARQL 1.1** server with a **web UI**, backed by Apache Jena **TDB** on disk.

The image is convenient for local experiments. It targets an older OpenJDK/Debian base; for production, evaluate upstream Apache Jena releases and supported images separately.

## Quick start

From the repository root:

```bash
docker compose -f docker-compose.fuseki.yml up -d
```

Open the UI: **http://localhost:3030/**

- Default host port is **3030**. Override with `FUSEKI_PORT` (e.g. `FUSEKI_PORT=8080 docker compose -f docker-compose.fuseki.yml up -d`).
- The stack creates an empty dataset named **`heritage`** on first run (`FUSEKI_DATASET_1`, overridable via env).

### Admin login

- **Username:** `admin` (Fuseki default).
- **Password:** set in [docker-compose.fuseki.yml](docker-compose.fuseki.yml) via `ADMIN_PASSWORD`, which reads **`FUSEKI_ADMIN_PASSWORD`** from the environment if set, otherwise falls back to **`heritage_dev_admin`** for local development.

  ```bash
  # Example: stronger password without editing the compose file
  FUSEKI_ADMIN_PASSWORD='your-secret' docker compose -f docker-compose.fuseki.yml up -d
  ```

  If you **omit** `ADMIN_PASSWORD` in Compose entirely and use a plain `docker run` of the image, a random password may be generated on first start — see `docker logs` in that case.

  **Production or shared hosts:** always set `FUSEKI_ADMIN_PASSWORD` (or edit the compose default) — never rely on the checked-in dev default outside your machine.

### Stop and data lifecycle

| Command | Effect |
|--------|--------|
| `docker compose -f docker-compose.fuseki.yml stop` | Stops containers; **data kept** in volume `heritage-fuseki-data`. |
| `docker compose -f docker-compose.fuseki.yml down` | Removes containers; **volume kept** (named `heritage-fuseki-data`). |
| `docker compose -f docker-compose.fuseki.yml down -v` | Removes containers **and** the named volume — **all TDB data lost**. |

Only **one** Fuseki process should use a given `/fuseki` volume at a time.

### JVM memory

Default heap in the image is about **1200 MiB**. To override (example **2 GiB**), set in `.env` or the shell:

```bash
FUSEKI_JVM_ARGS=-Xmx2g docker compose -f docker-compose.fuseki.yml up -d
```

(Already wired in [docker-compose.fuseki.yml](docker-compose.fuseki.yml) as `JVM_ARGS`.)

## Datasets

- **Via UI:** sign in as admin → **Manage datasets** → add a dataset (e.g. persistent TDB) → use the **Query** tab.
- **Via environment:** the Compose file sets `FUSEKI_DATASET_1` (default `heritage`). For more empty datasets at startup, merge an override with `FUSEKI_DATASET_2`, `FUSEKI_DATASET_3`, … as supported by the image (see Docker Hub README).

## SPARQL in the browser

1. Log in as **admin**.
2. Open your dataset (e.g. **heritage**).
3. Run a simple query:

```sparql
SELECT (COUNT(*) AS ?triples) WHERE { ?s ?p ?o }
```

## Bulk loading (image `load.sh`)

The image includes **`./load.sh`**, which runs **tdbloader** against files under **`/staging`** into a dataset directory on the **same** `/fuseki` volume.

**Before loading into an existing dataset, stop Fuseki** (or load only into a **new** dataset name Fuseki has not created yet — see image README).

Example pattern (host directory mounted read-only into `/staging`; volume shared with the load container):

```bash
docker compose -f docker-compose.fuseki.yml stop

docker run --rm \
  -v heritage-fuseki-data:/fuseki \
  -v /path/on/host/rdf:/staging:ro \
  stain/jena-fuseki ./load.sh heritage file1.ttl file2.ttl
```

- If you omit file names, the script loads globs such as `*.ttl`, `*.ttl.gz`, `*.nt`, etc. under `/staging` (see upstream Docker Hub docs).
- `load.sh` loads the **default graph**; named graphs need **tdbloader** with an assembler file (advanced).

After loading into an **existing** dataset, start Fuseki again:

```bash
docker compose -f docker-compose.fuseki.yml start
```

If you created **brand-new** TDB directories on the volume, use **Manage datasets** in the UI: **Add new dataset** → **Persistent**, name must match the directory you loaded (e.g. `heritage`).

## TDB 2

To use **TDB2**, set in a merge file:

```yaml
services:
  fuseki:
    environment:
      TDB: "2"
```

Then use **`tdbloader2`** for bulk loads (see image README). Example against a running container named `heritage-fuseki`:

```bash
docker exec -it heritage-fuseki /bin/bash -c 'tdbloader2 --loc /fuseki/databases/heritage /staging/data.ttl'
```

(Adjust paths and dataset name to match your layout.)

## HeritageGraph and Fuseki

Django exposes a **read-only SPARQL proxy** at **`/cidoc/sparql/`** when the API prefix is as documented in [AGENTS.md](AGENTS.md). Implementation: `SparqlProxyView` in [`heritage_graph/apps/cidoc_data/views.py`](heritage_graph/apps/cidoc_data/views.py). It forwards **GET** requests to `RDF_ENDPOINT_URL` when that setting is non-empty; otherwise it can fall back to the embedded **Oxigraph** store path.

Optional RDF projection hooks (`RDF_SYNC_ENABLED`) send **SPARQL UPDATE** via [`heritage_graph/apps/cidoc_data/rdf_signals.py`](heritage_graph/apps/cidoc_data/rdf_signals.py).

### Fuseki endpoint URLs (important)

Unlike Oxigraph’s single **`/sparql`** URL, **Fuseki 2** uses **per-dataset** paths:

| Operation | Typical path |
|-----------|----------------|
| SPARQL Query (GET/POST) | `http://<host>:3030/<dataset>/query` |
| SPARQL Update | `http://<host>:3030/<dataset>/update` |

With the default Compose dataset name **`heritage`**:

- Query: `http://localhost:3030/heritage/query`

If Django runs **on the host** and Fuseki in Docker with published port 3030, point read-only proxy config at that URL (see [.env.example](.env.example) comments).

If Django runs **inside Docker** on the same Compose project as Fuseki, you would use the service hostname (e.g. `http://fuseki:3030/heritage/query`) on a **shared user-defined network** — the standalone Fuseki compose file does not attach the main app stack by default; merge networks or run Fuseki as an extra service in the main compose if you need that.

### `RDF_ENDPOINT_URL` vs SPARQL Update

Today, **`RDF_ENDPOINT_URL`** is used for **both** the proxy’s **query** GETs and for **SPARQL UPDATE** POSTs in `_sparql_update`. Fuseki expects **different paths** for query and update. For **browsing and read-only proxy** setup, set `RDF_ENDPOINT_URL` to the **`/query`** endpoint. Enabling **`RDF_SYNC_ENABLED`** against Fuseki may require a future **`RDF_UPDATE_URL`** (or similar) in Django settings — until then, treat Fuseki as the manual / research triplestore or extend the backend.

## Validate Compose

```bash
docker compose -f docker-compose.fuseki.yml config
```

## License / notices

Licensing for the image layers (Dockerfile, Jena, OpenJDK, Debian) is summarized on [Docker Hub](https://hub.docker.com/r/stain/jena-fuseki). For Jena questions, use the public **users@jena** mailing list and the Apache Jena issue tracker.
