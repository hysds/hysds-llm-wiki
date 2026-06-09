# grq2

> GeoRegionQuery (GRQ) — the HySDS data catalog and dataset-metadata REST API over an Elasticsearch/OpenSearch backend.

**Owner:** hysds-core team (Confirmed)  
**Criticality:** P1 — GRQ is the HySDS data catalog and the primary dataset-metadata ingest/query API. The `hysds` `job_worker` POSTs every finished product to its `dataset/index` endpoint, and the TOSCA UI and downstream services query it for products; if GRQ is down, the system cannot register or find data products. (Confirmed; rationale per `ARCHITECTURE_v2.md` §3)  
**Language:** Python (>=3.12)  
**Repo:** `hysds-core/grq2`  
**Last reviewed:** 2026-06-08

## Architecture diagram

![grq2 core architecture](/img/diagrams/grq2-core-architecture.svg)

*Source: `grq2/grq2_core_architecture.drawio.xml` (draw.io), exported to SVG.*

## Role in HySDS

`grq2` is the HySDS **Data Catalog and Query API** — a Flask web application exposing a RESTful interface for indexing, managing, and searching dataset metadata held in an Elasticsearch or OpenSearch backend. It is the primary mechanism by which new data products are registered with HySDS: a `hysds` `job_worker` that has finished a job POSTs the product metadata to GRQ's dataset-index endpoint. GRQ enriches incoming metadata (most notably reverse geolocation deriving city/continent from coordinates) and provides the search API that the TOSCA UI and other services use to discover datasets. It sits between the job-execution layer (`hysds`/Mozart) and the dataset metadata store (the "GRQ" OpenSearch cluster).

## Deployment model

GRQ runs as a long-lived Flask app served by **Gunicorn with gevent workers**, listening on port **8878**:

```bash
gunicorn -w2 -b 0.0.0.0:8878 -k gevent --daemon -p grq2.pid grq2:app
```

Development entry points are `run.py` and `run_debug.py` (which import `grq2:app`). It lives on the GRQ/Mozart PCM host and is fronted by a web proxy that exposes the Swagger UI under `/grq/api/...`. There is no Dockerfile or `requirements*.txt` in the repo; dependencies are declared in `setup.py`.

## Key interfaces

### REST API

- Base port: `8878`; proxied under `/grq/...`.
- Swagger UI:
  - `https://<mozart host>/grq/api/v0.1/` (api `v0.1`)
  - `https://<mozart host>/grq/api/v0.2/` (api `v0.2`)
- Key write endpoints (from `celeryconfig.py` `GRQ_UPDATE_URL*`):
  - `POST /api/v0.1/grq/dataset/index` — single dataset index.
  - `POST /api/v0.2/grq/dataset/index` — bulk dataset index (chunked to stay under the ES payload limit).
- Search/read endpoints (TOSCA search URL `/search/`) and `v01`/`v02` resources for `datasets`, `jobs`, `tags`, `specs`, and `user_rules` under `grq2/services/api_v01/` and `grq2/services/api_v02/`. A `geonames` blueprint is also registered (`grq2/__init__.py`).

### Celery queues

`grq2` itself is a synchronous Flask/Gunicorn REST service and does not run as a Celery worker. However, the repo ships a shared `celeryconfig.py` (broker `amqp://...:5672`, redis result backend) consumed by HySDS workers, which defines the dataset/GRQ-related queues:

| Queue | Purpose |
|-------|---------|
| `grq_update` | GRQ dataset update (`GRQ_UPDATE_QUEUE`) |
| `grq_ingest` | GRQ dataset ingest (`GRQ_INGEST_QUEUE`) |
| `grq_delete` | GRQ dataset delete (`GRQ_DELETE_QUEUE`) |
| `dataset_processed` | processed-dataset events (`DATASET_PROCESSED_QUEUE`) |
| `user_rules_dataset` | user-rule evaluation on datasets (`USER_RULES_DATASET_QUEUE`) |
| `on_demand_dataset` | on-demand dataset actions (`ON_DEMAND_DATASET_QUEUE`) |

### OpenSearch indices

| Index / alias | Store | Writer |
|---------------|-------|--------|
| `grq` (alias) / `grq_*` | Dataset metadata catalog; per-type/version dataset indices behind the `grq` alias (`GRQ_INDEX`, `DATASET_ALIAS`) | GRQ dataset-index API |
| `geonames` | Reverse-geolocation reference data (cities/continents) used to enrich dataset metadata (`GEONAMES_INDEX`) | loaded out-of-band; read by GRQ |
| `user_rules-grq` | User rules for dataset triggers — lives in Mozart's ES (`USER_RULES_INDEX` / `USER_RULES_DATASET_INDEX`) | GRQ user_rules API |
| `hysds_ios-grq` | HySDS I/O specs for the GRQ side — lives in Mozart's ES (`HYSDS_IOS_INDEX`) | GRQ specs API |
| `job_specs` | Job specifications (`JOB_SPECS_INDEX`) | shared |

This matches the existing edge in `dependencies/inventory.md`: `grq2 (package) → GRQ OpenSearch | grq_*, user_rules-grq, hysds_ios-grq`.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| Flask (`<2.3.0`) | runtime | Web framework (pinned — kluge pending Flask-DebugToolbar import fix) |
| flask-restx (`>=0.5.1`) | runtime | REST API + Swagger UI |
| werkzeug (`<3.0.0`) | runtime | WSGI lib (pinned to avoid `url_quote` import error) |
| gunicorn | runtime | Production WSGI server |
| eventlet | runtime | Async worker support |
| elasticsearch (`>=7.0.0,<7.14.0`) | runtime | ES client |
| opensearch-py (`>=2.3.0`) | runtime | OpenSearch client |
| shapely (`>=1.5.15`) | runtime | Geospatial geometry handling |
| Cartopy (`>=0.13.1`) | runtime | Geospatial / geolocation support |
| pyshp | runtime | Shapefile parsing |
| Cython (`>=0.15.1`) | runtime | Build dependency for geospatial libs |
| redis | runtime | Result backend / caching (`REDIS_URL`) |
| pymongo | runtime | Mongo client |
| requests | runtime | HTTP client |
| future | runtime | Py2/3 compat shim |
| pytest, pytest-cov, black, flake8, isort | dev | Test + lint/format tooling (`extras_require['dev']`) |

Python: `>=3.12`. Version: `2.4.0` (`setup.py`).

## Configuration

- `settings.cfg` / `config/settings.cfg.tmpl` — main Flask config: `ES_ENGINE`, `AWS_ES`, `ES_URL`, `GRQ_INDEX` (`grq`), `GEONAMES_INDEX` (`geonames`), `USER_RULES_INDEX` (`user_rules-grq`), `HYSDS_IOS_INDEX` (`hysds_ios-grq`), `JOB_SPECS_INDEX`, `REDIS_URL`, `AWS_REGION`, and bulk-ingest tuning (`BULK_REQUEST_TIMEOUT=30`, `BULK_LIMIT=100MB`). The shipped defaults set `DEBUG=True`/`TESTING=True` and a placeholder `SECRET_KEY` — these are dev-only and must be overridden in deployment. Never store real secrets in this file.
- `celeryconfig.py` — broker/result-backend, Mozart/GRQ URLs (`GRQ_UPDATE_URL`, `GRQ_UPDATE_URL_BULK`, `TOSCA_URL`), and the dataset/GRQ queue + index names listed above. Shared with HySDS workers.
- `config/` mappings & templates: `es_template.json`, `hysds_ios.mapping`, `user_rules_dataset.mapping`, `ingest_pipeline.json`.

## Known constraints / risks

- **Pinned web stack.** `Flask<2.3.0` and `werkzeug<3.0.0` are explicit kluges noted in `setup.py` (Flask-DebugToolbar import error; `url_quote` removal in Werkzeug 3). Upgrading either requires resolving those upstream issues.
- **Dual search backend in transition.** Both `elasticsearch` (`>=7.0,<7.14`) and `opensearch-py` are pinned dependencies. Recent work migrated GRQ to OpenSearch — commits `HC-606` (OpenSearch 3.x support), `HC-484` (initial OpenSearch support) — and to Python 3.12 (`HC-563`). Verify backend (`ES_ENGINE`/`GRQ_ES_ENGINE`) matches the target cluster.
- **Missing `geonames` index.** As of `HC-597`, GRQ gracefully ignores a missing `geonames` index; before that fix a missing index could break reverse geolocation during ingest.
- **Cross-cluster index ownership.** `user_rules-grq`, `hysds_ios-grq`, and `job_specs` physically live in Mozart's ES, not the GRQ cluster — changes to those indices must be coordinated with Mozart.
- **Data in Transit.** `HC-530` added updates to support "Data in Transit"; review that flow before changing the ingest path.
- Dev defaults in `settings.cfg` (`DEBUG`/`TESTING`/placeholder `SECRET_KEY`) must not reach production.

## Open questions

- Worker concurrency in production is documented as `-w2` gevent in the README — is this the deployed value, or is it tuned per-cluster? (should also be logged in `open-questions.md`)
- Exact relationship/ownership boundary between the GRQ queues defined in `celeryconfig.py` and the `hysds` worker that consumes them — confirm which repo owns the consumer.
