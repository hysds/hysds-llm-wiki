# Mozart

> Flask REST API and job-orchestration hub for HySDS — the central entry point for job submission, status tracking, and system management.

**Owner:** hysds-core team
**Criticality:** P1 — Mozart is the central control-plane entry point. It hosts the job-submission REST API and the orchestrator, and reads/writes the job-status OpenSearch indices. If Mozart is down, no jobs can be submitted or tracked and the PCM control plane is effectively offline.
**Language:** Python 3.12 (`>=3.12`, per `setup.py` / `README.md`)
**Repo:** `hysds-core/mozart`
**Last reviewed:** 2026-06-08

## Role in HySDS

Mozart is the central orchestration node of the PCM (Processing Control and Data Management) layer. It is a Flask-based web application that exposes versioned REST APIs (v0.1 and v0.2) for the full job lifecycle: submitting jobs, querying job/queue/worker status, managing job specs and containers, and managing user (trigger) rules. It resolves job parameters via `hysds_commons`, publishes work to RabbitMQ for execution by Verdi workers, and serves as the API backend for `hysds_ui`. Mozart also hosts the orchestrator process that evaluates trigger rules and creates follow-on jobs. (Sources: `ARCHITECTURE_v2.md`, `CLAUDE.md`.)

## Deployment model

- **Production web server:** `gunicorn -w2 -b 0.0.0.0:8888 -k gevent --daemon -p mozart.pid mozart:app` (README). Asynchronous request handling via `gevent` workers; `gevent` is pinned (`>=1.1.1,<25.4.1`) after a job-submit error (commit HC-573).
- **Development:** `python run.py`.
- **Reverse proxy:** built-in middleware for deployment behind nginx/Apache; the Apache proxy on the Mozart host also proxies `/grq/`, `/pele/`, and `/metrics/` (per `dependencies/inventory.md`). API served under `/mozart/`.
- **Orchestrator:** `scripts/orchestrator.py` runs as a separate long-lived background process (consumes RabbitMQ trigger queues), distinct from the web API process.
- **Host:** runs on the Mozart PCM node alongside RabbitMQ, Redis, and the Mozart OpenSearch instance (per glossary).
- Recent build work added multi-architecture container support (commit HC-567).

## Key interfaces

### REST API

- Versioned APIs built with `flask-restx`: **v0.1** and **v0.2** (v0.2 is the primary API; both expose largely identical endpoints).
- Base URLs / Swagger UI:
  - `https://<mozart host>/mozart/api/v0.1/`
  - `https://<mozart host>/mozart/api/v0.2/`
- Namespaces (from `mozart/services/api_v0{1,2}/`):
  - `/job/*` — submit, status, info, revoke/purge. Most critical endpoint: `POST /api/v02/job/submit` (`services/api_v02/jobs.py`, `SubmitJob`).
  - `/queue/*` — RabbitMQ queue listing/inspection.
  - `/on-demand/*` — on-demand job handling.
  - `/event/*` — event management.
  - `/user-rules/*` — trigger-rule CRUD.
  - `/tags` — user tags on job-status docs (restricted to `job_status-*` indices).
- Job submission flow: validate params → `hysds_commons.job_utils.resolve_hysds_job` → `submit_hysds_job` → publish to RabbitMQ (`ARCHITECTURE_v2.md`). `publish_overwrite_ok` is exposed via the APIs (commit HC-473); job disk-usage / time-limit overrides are settable at submission time.

### RabbitMQ queues

- Mozart connects to RabbitMQ via `pika`.
- On-demand submissions go to `ON_DEMAND_JOB_QUEUE` (resolved from the Celery app config; `services/api_v0{1,2}/jobs.py`).
- System-protected queues are filtered from user-visible queue lists: `PROTECTED_QUEUES = [SYSTEM_JOBS_QUEUE]`; `JOB_SUBMISSION_QUEUE = SYSTEM_JOBS_QUEUE` (`settings.cfg.tmpl`).
- Queues are dynamically discovered from RabbitMQ (`CLAUDE.md`).
- Orchestrator (`scripts/orchestrator.py`) consumes trigger queues and uses an `error_queue` for failed messages (`scripts/pikaUtils.py`, `process_error_queue.py`).
- Queue admin/monitoring via the RabbitMQ management API at `:15672` (`RABBITMQ_ADMIN_API`, `settings.cfg.tmpl`).

### OpenSearch indices

Index names from `settings/settings.cfg.tmpl` and code:

| Index | Purpose | Written by |
|-------|---------|-----------|
| `job_status-current` (+ `job_status-*` rollover) | Job status / lifecycle tracking | Logstash pipeline (jobs); read by Mozart API (`lib/job_utils.py`, `services/jobs.py`) |
| `job_specs` | Registered job specifications | Mozart API (`services/api_v02/specs.py`) |
| `containers` | Registered PGE container images | Mozart API (`services/api_v02/specs.py`) |
| `user_rules-mozart` | User trigger rules | Mozart API + orchestrator |
| `hysds_ios-mozart` | HySDS I/O signatures for job types | Mozart API |

- The ES client is obtained via `hysds.es_util.get_mozart_es()` (`mozart/__init__.py`), i.e. Mozart shares the `hysds` package's Mozart ES client.
- ILM: `scripts/install_ilm_policy.py` installs the `ilm_policy_mozart` lifecycle policy; rollover of old job/task/worker/event docs is supported (commit NSDS-2584).
- An optional separate Mozart ES cluster deployment and clustered (multi-node) ES are supported (`ES_CLUSTER_MODE`, commits HC-496, HC-487).
- Migration to OpenSearch 3.x is in progress (commit HC-606); the `elasticsearch` client dependency is currently pinned to 7.x.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `hysds` (package) | runtime / library | Celery app + `get_mozart_es()` ES client; job submission utilities |
| `hysds_commons` | runtime / library | `resolve_hysds_job` / `submit_hysds_job` job resolution & publishing |
| Flask `<2.3.0`, `flask-restx`, `Flask-SQLAlchemy`, `Flask-Login`, `Flask-WTF` | runtime | Web framework, versioned REST API, auth, SQLite ORM |
| `gunicorn`, `gevent`, `eventlet` | runtime | Production WSGI server / async workers |
| `pika` | runtime | RabbitMQ (AMQP) client |
| `elasticsearch >=7.0.0,<7.14.0` | runtime | OpenSearch/ES access (migrating to OpenSearch 3.x) |
| `boto` | runtime | AWS access |
| `simpleldap` | runtime | LDAP authentication |
| `python-jenkins` | runtime | Optional Jenkins CI/CD integration |
| `Flask-DebugToolbar` | dev | Debugging (forces Flask `<2.3.0` kluge) |
| RabbitMQ | infra | Message broker (Mozart host) |
| Redis | infra | Event buffering / job-status updates (Mozart host) |
| OpenSearch (Mozart) | infra | Primary data store for jobs, specs, containers, rules |
| SQLite | infra | User auth / session state (may be replaced by SSO) |

## Configuration

- **`settings/settings.cfg.tmpl`** — primary Flask config (Jinja2-rendered by `sdscli` at deploy). Defines: index names (`USER_RULES_INDEX`, `HYSDS_IOS_INDEX`, `JOB_SPECS_INDEX`, `JOB_STATUS_INDEX`, `CONTAINERS_INDEX`), GRQ/Metrics endpoints, RabbitMQ admin URLs, LDAP, Jenkins, Flower, protected queues, `ES_CLUSTER_MODE`, `GRQ_AWS_ES`. Copy to `settings.cfg` and customize (`CLAUDE.md`).
- **`celeryconfig.py`** (from `hysds`) — provides the Celery app config Mozart reads for queue names (`ON_DEMAND_JOB_QUEUE`).
- **`configs/`** — ES templates/mappings (`es_template.json`, `hysds_ios.mapping`, `user_rules_job.mapping`) and orchestrator job/event configs (`orchestrator_jobs.json`, `orchestrator_events.json`, etc.).
- Secrets (`SECRET_KEY`, `OPS_PASSWORD_HASH`, `JENKINS_API_KEY`, LDAP creds) are rendered into `settings.cfg` at deploy — never commit real values.

## Known constraints / risks

- **Flask pinned `<2.3.0`** as a kluge for a `Flask-DebugToolbar` import error (`setup.py` comment); blocks upgrading the Flask stack.
- **`gevent` upper-bounded** (`<25.4.1`) after a job-submit error (commit HC-573); loosening risks regressing job submission.
- **CORS enabled for development** and intended to be removed in production (`CLAUDE.md`); a production deploy left in this state is a hardening gap.
- **OpenSearch 3.x migration in flight** (commit HC-606) while the `elasticsearch` client is pinned to 7.x — version-compatibility risk during transition.
- **SQLite for auth/session state** is single-node and noted as a candidate for SSO replacement (`CLAUDE.md`).
- **Two parallel API versions** (v0.1 and v0.2) with near-identical endpoints must be kept in sync; logic can drift between `api_v01/` and `api_v02/`.
- Single point of failure for the control plane (basis for P1 tier): job submission and status both flow through this service.

## Open questions

- Exact set of trigger/orchestrator queue names consumed by `scripts/orchestrator.py` (config-driven via `configs/orchestrator_*.json`; not enumerated in a single static list). Track in `open-questions.md`.
- Status and target version of the OpenSearch 3.x migration (HC-606) and whether the `elasticsearch` 7.x client pin is updated as part of it.
- Whether/when the development CORS configuration is disabled in production deployments.
