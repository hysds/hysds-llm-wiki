# HySDS Commons

> Shared Python utility library providing the canonical job-resolution / job-submission path and search-client helpers used across HySDS components.

**Owner:** hysds-core team  
**Criticality:** P1 — it is the shared library that implements `resolve_hysds_job` and the job-submission primitives imported by Mozart, Chimera, and other components; a regression here breaks job submission system-wide.  
**Language:** Python (≥3.12)  
**Repo:** `hysds-core/hysds_commons` (`github.jpl.nasa.gov/hysds-org/hysds_commons`)  
**Last reviewed:** 2026-06-08

## Role in HySDS

`hysds_commons` is a **shared utility library**, not a standalone service. It provides a consistent, high-level interface for the operations HySDS components have in common — most importantly resolving a job type into a complete job JSON payload (`resolve_hysds_job`) and submitting jobs either directly to the message queue or via the Mozart REST API. It also bundles the Elasticsearch/OpenSearch client wrappers (`SearchUtility` and its `ElasticsearchUtility` / `OpenSearchUtility` subclasses) that other components use to query the PCM data catalogs, plus JSON-schema validation for `hysds-io` and `job-spec` documents. It sits underneath Mozart, Chimera, and the worker tooling in the PCM topology as a foundational dependency rather than a node in the runtime graph.

## Deployment model

Library only — installed as a Python package (`pip install -e .` / `find_packages`) into the environment of whatever component imports it (e.g. the Verdi/Mozart `verdi` virtualenv in CI). There is no Dockerfile, no supervisord process, and no service entry point of its own. It is `zip_safe=False` and ships package data (the `schemas/` directory). Tests run in CircleCI against the `hysds/pge-base` image, with a build job on `cimg/python:3.12`.

## Key interfaces

### Public API (entry points)

As a library its "interfaces" are its public functions:

- `job_utils.resolve_hysds_job(...)` — resolves a job type + params into the full job JSON the `hysds` worker expects.
- `job_utils.submit_hysds_job(...)` — submits a resolved job JSON directly to Celery/RabbitMQ via `hysds.do_submit_job`.
- `job_utils.resolve_mozart_job(...)` / `submit_mozart_job(...)` — resolve and submit a Mozart job from a product + rule.
- `mozart_utils.submit_job(mozart_url, data, ...)` — submits via HTTP `POST` to the Mozart REST API (`api/<version>/job/submit`, default version `v0.1`).
- `job_rest_utils.single_process_and_submission(...)` — resolve-then-submit helper for the iterator path.
- `validate.py` — validates documents against `schemas/hysds-io-schema.json` and `schemas/job-spec-schema.json` (jsonschema Draft7).
- `stac_utils.create_stac_doc(...)` — builds STAC item JSON from product metadata + mappings.

Two submission patterns are supported (per `ARCHITECTURE_v2.md`):
- **Pattern A — direct-to-queue** (internal, used by Mozart): resolve → `submit_hysds_job` → publish to RabbitMQ.
- **Pattern B — API-based** (external/event-driven, e.g. Chimera): `mozart_utils.submit_job` → HTTP POST to Mozart, which then runs Pattern A internally.

### Celery / RabbitMQ queues

- `submit_hysds_job` hard-codes submission to the `jobs_processed` queue (via `hysds.do_submit_job`).
- `queue_utils.HYSDS_QUEUES` enumerates the system queues from `app.conf` (`JOBS_PROCESSED_QUEUE`, `USER_RULES_JOB_QUEUE`, `DATASET_PROCESSED_QUEUE`, `USER_RULES_DATASET_QUEUE`, `USER_RULES_TRIGGER_QUEUE`, `ON_DEMAND_DATASET_QUEUE`, `ON_DEMAND_JOB_QUEUE`, `PROCESS_EVENTS_TASKS_QUEUE`).
- `queue_utils.get_all_queues(rabbitmq_admin_url)` lists user/job queues via the RabbitMQ management API (`api/queues`), excluding `celery*` internal queues and the system `HYSDS_QUEUES`. It uses a `CustomCipherAdapter` that pulls ciphers from `app.conf["broker_use_ssl"]` (Data-in-Transit support).

### OpenSearch / Elasticsearch indices (read)

The library reads these indices to resolve jobs (it does not own/write them):

| Index | Read by | Purpose |
|-------|---------|---------|
| `job_specs` | `job_utils.py` | Job specification lookup by job type |
| `containers` | `job_utils.py` | Container/image definition lookup |
| `hysds_ios-grq` / `hysds_ios-mozart` | `job_utils.py`, `job_iterator.py` | hysds-io wiring; index chosen by component (`tosca/grq` vs `mozart/figaro`) |

`SearchUtility` (in `search_utils.py`) is the shared base client; `ElasticsearchUtility` and `OpenSearchUtility` are the engine-specific subclasses. The OpenSearch client implements deep pagination via the PIT (point-in-time) + `search_after` API.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `hysds` | runtime (circular) | `from hysds.celery import app`; `do_submit_job` for queue publishing — resolved at runtime |
| `elasticsearch` (&gt;=7.0.0,&lt;7.14.0) | runtime | Elasticsearch client backend |
| `opensearch-py` (&gt;=2.3.0) | runtime | OpenSearch client backend (OpenSearch 3.x supported per HC-606) |
| `requests` (&gt;=2.7.0) | runtime | Mozart REST + RabbitMQ admin HTTP calls |
| `jsonschema` (&gt;=3.0.1) | runtime | hysds-io / job-spec validation |
| `shapely` (&gt;=1.8.2) | runtime | Geometry handling in STAC doc generation |
| `numpy` (&lt;2.0.0) | runtime | Pinned for ES client compatibility |
| `future` (&gt;=0.17.1) | runtime | Py2/3 compatibility shims |
| `pytest`, `jsonschema` | dev | CircleCI test stage |

See [`dependencies/inventory.md`](../dependencies/inventory.md) for the cross-repo edge list (note: `mozart` and `chimera` consume `hysds`/`hysds_commons` as libraries).

## Configuration

This library has **no configuration file of its own**. It is configured implicitly by the importing service, which must supply connection details (Elasticsearch/OpenSearch URLs, Mozart URL) and the Celery config. Notably it reads `hysds.celery.app.conf` at import time for queue names and `broker_use_ssl` ciphers — so a valid `celeryconfig.py` must be present in the host environment (CI copies `celeryconfig.py.tmpl` before running tests). Credentials for search clients are resolved via `.netrc` (`get_creds`); RabbitMQ admin auth failures point the user at `.netrc`. No secret values are stored in this repo.

## Known constraints / risks

- **Circular dependency on `hysds`.** `hysds_commons` imports `hysds.celery.app` and `hysds.do_submit_job`; `hysds`-family components in turn import `hysds_commons`. This is resolved only at runtime and is a known coupling to be careful with when reordering imports or refactoring either package.
- **Implicit Celery config requirement.** Importing `queue_utils`/`job_iterator` evaluates `app.conf[...]` at module load; a missing or stale `celeryconfig.py` will fail at import, not at call time.
- **TLS verification disabled** in the search clients and HTTP calls (`verify_certs=False`, `verify=False`, `ssl_show_warn=False`). Intentional for the internal PCM trust boundary but worth noting before exposing any of these helpers more broadly.
- **Pinned/legacy version ranges.** `elasticsearch<7.14.0` and `numpy<2.0.0` are deliberate compatibility pins; bumping either risks breaking the ES client.
- **Closed-index handling is subtle.** Recent PIT fixes (HC-600, HC-611) had to special-case which indicesOptions params each API accepts (PIT APIs reject `allow_no_indices`); changes to `CLOSED_INDEX_PARAMS` plumbing need care across the base class and both engine subclasses.

## Open questions

- None recorded at this time. Log any in [`open-questions.md`](../open-questions.md).
