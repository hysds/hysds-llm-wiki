# HySDS Core

> Core library and worker framework for the Hybrid Cloud Science Data System — the distributed, Celery-based job execution engine that the rest of the PCM stack is built on.

**Owner:** hysds-core team  
**Criticality:** P1 — foundational library wrapped by `mozart`, `chimera`, and the Verdi/Factotum workers; if the orchestrator, job worker, or task worker primitives break, job submission and execution across the entire PCM cluster stop.  
**Language:** Python (>=3.12)  
**Repo:** `hysds/hysds` (https://github.com/hysds/hysds)  
**Last reviewed:** 2026-06-08

## Role in HySDS

`hysds` is the core component of the Hybrid Cloud Science Data System. It is a distributed job execution framework built on Celery that processes both lightweight Python tasks and complex containerized scientific workflows (PGEs). It provides the orchestrator (job routing, validation, deduplication), the job worker (containerized PGE lifecycle), the task worker (lightweight function execution), event processors, user-rule evaluation, and the pluggable container engine layer.

It sits at the bottom of the PCM dependency graph: per the dependency inventory, `mozart` uses the hysds Celery app and utilities, and `chimera` wraps PGE execution using hysds worker primitives. Verdi and Factotum workers run hysds worker code to consume queues and execute jobs.

## Deployment model

`hysds` is primarily a **library plus a set of Celery worker entry points and operational scripts**, not a standalone service. It is installed (`pip install .`) into the worker environments (Verdi, Factotum) and into Mozart.

- Celery app is defined in `hysds/celery.py` as `app = Celery("hysds")`, configured at runtime via `app.config_from_object("celeryconfig")` — i.e., the deployed `celeryconfig.py` supplies all broker, backend, queue-name, and OpenSearch settings.
- Worker processes (`hysds.job_worker`, `hysds.task_worker`, orchestrator `submit_job` task) are launched as Celery workers, typically under supervisord on PCM worker hosts.
- The `scripts/` directory ships operational helpers run on PCM hosts (e.g., `process_events.py`, `watchdog_job_timeouts.py`, `harikiri.py`, `sync_ec2_job_metric.py`, and numerous index-cleanup scripts).
- `supervisor` is listed in `requirements.txt`, consistent with supervisord-managed processes.

The in-repo `celeryconfig.py` is a **minimal localhost template for testing only** (broker/backend `redis://localhost:6379/0`); real deployments override it.

## Key interfaces

### Celery queues

Queue names are not hardcoded in the library — they are read from Celery config (`app.conf.*`) at runtime. Grounded references:

- **Orchestrator** (`hysds/orchestrator.py`): `submit_job` is an `@app.task`; it routes jobs to a target `job_queue` via `submit_job.apply_async((job_json,), queue=job_queue, ...)`.
- **Task worker** (`hysds/task_worker.py`): `run_task` is an `@app.task(bind=True)`; tasks submitted to a configurable `task_queue`.
- **User-rule queues** (`hysds/user_rules_job.py`, `hysds/user_rules_dataset.py`), all sourced from `app.conf`:
  - `JOBS_PROCESSED_QUEUE`
  - `USER_RULES_TRIGGER_QUEUE`
  - `USER_RULES_JOB_QUEUE`
  - `USER_RULES_DATASET_QUEUE`

Worker concurrency is set via Celery config; `worker_prefetch_multiplier = 1` and `task_acks_late = True` in the test config reflect the intended long-running-job worker pattern.

### OpenSearch / Elasticsearch indices

Index access goes through `hysds/es_util.py` (Mozart and GRQ ES clients). Grounded index/alias references:

- `job_status-current` — job status alias, queried/searched in `event_processors.py`, `user_rules_job.py` (`JOB_STATUS_ALIAS = "job_status-current"`), and `utils.py`. Used for job-status lookups, user-rule evaluation, and dedup checks.
- `job_failed` — fallback index for finished/failed jobs (`job_worker.py`: `job_index = "job_failed"` when no index present).
- `USER_RULES_JOB_INDEX`, `USER_RULES_DATASET_INDEX` — user-rule definition indices, names from `app.conf`.
- GRQ side: dataset existence/lookup against `grq` index (`utils.py`: `check_dataset(_id, es_index="grq")`, `dataset_exists`).

Note: `requirements.txt` pins both `elasticsearch>=7.0.0,<7.14.0` and `opensearch-py>=2.4.0`, reflecting the ES→OpenSearch transition.

### Redis

Redis is used for the Celery broker/result backend and for job-status caching/buffering (`hysds/log_utils.py`):

- `JOB_STATUS_KEY_TMPL = "hysds-job-status-%s"` — per-job status key (`app.conf.REDIS_JOB_STATUS_URL`).
- `app.conf.REDIS_JOB_STATUS_KEY` — list pushed (`rpush`) with msgpack job-status/info payloads for downstream ES indexing.
- `app.conf.REDIS_JOB_INFO_KEY` — job info buffer.
- Recent commit `HC-625` migrated the default Redis socket to `/run/redis` (from `/tmp`).

### Container engine

`hysds/containers/` provides a pluggable container layer via `container_engine_factory(engine=...)` in `factory.py`:

- `docker` → `Docker`, `podman` → `Podman` are wired in the factory.
- `base.py` (abstract base), `singularity.py` also present; the factory currently raises `ValueError` for engines other than docker/podman.
- Recent commit `HC-567` added multi-architecture container support.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `celery>=5.3.1,<6.0.0` | runtime | Distributed task/job execution framework (core) |
| `redis==5.2.1` | runtime | Broker, result backend, job-status cache |
| `opensearch-py>=2.4.0` | runtime | OpenSearch client (job/dataset status) |
| `elasticsearch>=7.0.0,<7.14.0`, `elasticsearch-dsl` | runtime | Legacy ES client (transition) |
| `osaka>=0.0.1` | runtime | Stage-in/stage-out data localization (sibling HySDS repo) |
| `hysds_commons>=0.1` | runtime | Shared HySDS utilities/config |
| `prov_es>=0.2.0` | runtime | PROV-ES provenance generation |
| `boto3`, `boto`, `awscli` | runtime | AWS/S3 access, EC2 scaling metrics |
| `google-cloud*` | runtime | GCP monitoring/storage integration |
| `flower>=2.0.1` | runtime | Celery monitoring UI |
| `gevent`, `eventlet`, `greenlet` | runtime | Concurrency for workers |
| `supervisor>=4.1.0` | runtime/infra | Process management for worker daemons |
| `backoff` | runtime | Retry decorators for transient failures |
| `msgpack` | runtime | Serialization of status payloads to Redis |
| `psutil` | runtime | Disk/resource usage for cleanup |
| `pytest`, `fakeredis`, `freezegun`, `pytest-mock`, `pytest-cov` | dev/test | Test suite (`extras_require['test']`) |
| `black`, `flake8`, `isort`, `mypy`, `pre-commit` | dev | Code quality |

Dependency edges (from `dependencies/inventory.md`): `chimera → hysds` (library), `mozart → hysds` (library); `hysds` itself uses `osaka` for S3 staging.

## Configuration

- **`celeryconfig.py`** — the central runtime config. Loaded via `app.config_from_object("celeryconfig")`. Supplies broker/backend URLs, queue names (`*_QUEUE`), OpenSearch endpoints (`MOZART_ES_*`, `GRQ_ES_*`, `JOBS_ES_URL`, `DATASETS_ES_URL`), Redis keys/URLs (`REDIS_JOB_STATUS_URL`, `REDIS_JOB_STATUS_KEY`, `REDIS_JOB_INFO_KEY`), user-rule index names, container registry, `ROOT_WORK_DIR`, and STAC publishing settings. The in-repo file is a localhost test template (copy from `configs/celery/celeryconfig.py.tmpl`).
- **`configs/orchestrator/orchestrator_jobs.json`** — maps job types to creator functions.
- **`configs/worker/job_worker.json.*`** — worker execution specifications.
- **`configs/datasets/datasets.json`** — dataset ingestion rules.

Never commit real broker URLs, registry credentials, or ES hosts to the wiki — reference their location in `celeryconfig.py` only.

## Known constraints / risks

- **Python 3.12+ required** (`python_requires=">=3.12"`). The codebase was modernized for it (timezone-aware datetimes, `logger.warning`, native `os.walk` disk usage). Older Python will not run it.
- **Pinned/legacy deps:** `prompt-toolkit==1.0.18` is pinned with an in-code TODO ("celery uses new version of click which broke this"); `zope.interface==4.7.1` is hard-pinned. Both are upgrade hazards.
- **Dual ES/OpenSearch clients:** the OpenSearch migration is in progress (both `elasticsearch<7.14` and `opensearch-py` present). Index code paths must be checked against the deployed engine.
- **ARM64/Graviton:** commit `HC-630` fixed a bug where cgroups v2 memory stats exceeded the long type range, breaking job-status updates in ES on Graviton workers — relevant when running mixed-architecture worker fleets.
- **Container engine coverage:** `singularity.py` exists but `container_engine_factory` only wires `docker` and `podman`; requesting another engine raises `ValueError`.
- **Config-driven coupling:** queue names and ES indices are not in the library; a misconfigured deployed `celeryconfig.py` silently changes routing and indexing behavior.
- **Low test coverage** in some modules (noted in README) and some tests require a running Docker/container engine.

## Open questions

- Are there recorded RISK-NNN entries for the dual ES/OpenSearch transition or the ARM64 cgroups issue? (Candidate risks; not yet logged.)
- Should the `prompt-toolkit` / `click` pin be tracked as a dedicated dependency risk?
- Is Singularity support intended to be completed, or is the stub deprecated?
