# Dependency Inventory

Flat edge list. Maintained by the `dependency-mapper` agent.
Direction: A → B means A depends on B (A calls, reads from, or publishes to B).

*Last updated: 2026-06-08 (full re-scan of all 11 repo docs)*

## Runtime service topology (PCM hosts)

| Source | → | Target | Interface type | Notes |
|--------|---|--------|----------------|-------|
| Mozart REST API | → | Mozart RabbitMQ | amqp-queue | Job submission; publishes via `pika` (`mozart.md`) |
| Mozart REST API | → | Mozart OpenSearch | opensearch-index | job_specs, containers, user_rules-mozart, hysds_ios-mozart, job_status-current (`mozart.md`) |
| Mozart orchestrator_datasets | → | Mozart RabbitMQ | amqp-queue | Consumes `dataset_processed` |
| Mozart orchestrator_datasets | → | GRQ REST API | http-rest | Dataset queries for trigger evaluation |
| Mozart orchestrator_jobs | → | Mozart RabbitMQ | amqp-queue | Consumes `jobs_processed` |
| Mozart process_events | → | Mozart Redis | redis-key | Writes msgpack events to `logstash` key |
| Mozart Logstash | → | Mozart Redis | redis-key | Reads from `logstash` key |
| Mozart Logstash | → | Mozart OpenSearch | opensearch-index | job_status, worker_status, event_status, task_status |
| Mozart Apache proxy | → | GRQ REST API | http-rest | Proxies `/grq/` |
| Mozart Apache proxy | → | Pele API | http-rest | Proxies `/pele/` |
| Mozart Apache proxy | → | Metrics OpenSearch Dashboards | http-rest | Proxies `/metrics/` |
| Mozart sync_ec2_metric | → | Mozart RabbitMQ management | http-rest | Queue depth polling (:15672) |
| Mozart sync_ec2_metric | → | AWS CloudWatch | aws-api | Custom scaling metrics |
| Factotum workers | → | Mozart RabbitMQ | amqp-queue | Consumes system/user-rule queues |
| Factotum workers | → | GRQ REST API | http-rest | Dataset operations |
| Verdi workers | → | Mozart RabbitMQ | amqp-queue | Consumes job queues |
| Verdi workers | → | Mozart Docker Registry | docker-registry | PGE image pulls (:5050) |
| Verdi workers | → | GRQ REST API | http-rest | Dataset publishing after PGE; `job_worker` POSTs to `dataset/index` (`grq2.md`) |
| Verdi workers | → | Mozart Redis | redis-key | Job status updates (`hysds-job-status-*` keys, `hysds.md`) |
| Verdi workers | → | S3 (osaka stage-in) | s3-bucket | Input data localization (via osaka) |
| Verdi workers | → | S3 (osaka stage-out) | s3-bucket | Output staging (`maap-uat-workspace` bucket, via osaka) |
| Metrics Logstash | → | Metrics Redis | redis-key | Consumes metrics buffer |
| Metrics Logstash | → | Metrics OpenSearch | opensearch-index | logstash-*, sdswatch-*, instance stats |

## REST / data-store edges (per-repo)

| Source | → | Target | Interface type | Notes |
|--------|---|--------|----------------|-------|
| grq2 | → | GRQ OpenSearch | opensearch-index | grq alias / grq_*, geonames; writes via dataset-index API (`grq2.md`) |
| grq2 | → | Mozart OpenSearch | opensearch-index | user_rules-grq, hysds_ios-grq, job_specs physically live in Mozart's ES (`grq2.md`) |
| pele | → | GRQ OpenSearch | opensearch-index | Read-only: job_specs, hysds-ios, containers, dataset/product indices (`pele.md`) |
| pele | → | PostgreSQL | sql | Production user store (SQLite in dev); auth/JWT user records (`pele.md`) |
| mozart | → | Pele API | http-rest | Catalog queries — Pele serves job_specs/hysds-ios/containers consumed by Mozart (`pele.md`) |
| chimera | → | Pele API | http-rest | Catalog queries — Pele serves PGE metadata consumed by Chimera (`pele.md`) |
| chimera | → | GRQ2 catalog | opensearch-index | Read-only precondition evaluation via elasticsearch-dsl 7.x (`chimera.md`) |
| chimera | → | Mozart REST API | http-rest | Job submission (Pattern B, via `hysds_commons.mozart_utils`) (`chimera.md`, `hysds_commons.md`) |

## hysds_ui (browser SPA, outbound calls)

| Source | → | Target | Interface type | Notes |
|--------|---|--------|----------------|-------|
| hysds_ui (Tosca) | → | GRQ OpenSearch | opensearch-index | `grq` index queried directly from browser via ReactiveSearch (`/grq_es`) (`hysds_ui.md`) |
| hysds_ui (Figaro) | → | Mozart OpenSearch | opensearch-index | `job_status` index queried directly from browser (`/mozart_es`) (`hysds_ui.md`) |
| hysds_ui | → | GRQ REST API | http-rest | `/grq/api/v0.1`, `/grq/api/v0.2` (`hysds_ui.md`) |
| hysds_ui | → | Mozart REST API | http-rest | Job submission, user-rule CRUD (`/mozart/api/*`) (`hysds_ui.md`) |
| hysds_ui | → | Pele API | http-rest | Action-call target per grounded data-flow notes (exact routes unconfirmed) (`hysds_ui.md`) |
| hysds_ui | → | Metrics OpenSearch Dashboards | http-rest | `/metrics`, Kibana links (`hysds_ui.md`) |

## Library (import-time) edges

| Source | → | Target | Interface type | Notes |
|--------|---|--------|----------------|-------|
| mozart | → | hysds | library | Celery app + `get_mozart_es()` ES client; job utilities (`mozart.md`) |
| mozart | → | hysds_commons | library | `resolve_hysds_job` / `submit_hysds_job` (`mozart.md`) |
| chimera | → | hysds | library | Wraps PGE execution using hysds worker primitives (`chimera.md`) |
| chimera | → | hysds_commons | library | `hysds_commons.job_utils.resolve_hysds_job` builds job payload (`chimera.md`) |
| chimera | → | sciflo | library | `run_sciflo.py` invokes SciFlo engine for PGE workflow execution (`chimera.md`, `sciflo.md`) |
| chimera | → | prov_es | library | `PgeJobSubmitter` emits provenance records (`prov_es.md`) |
| sciflo | → | hysds | library | Parallel/map work units submit Celery jobs; AMQP endpoint from hysds `celeryconfig.py` (`sciflo.md`) |
| sciflo | → | hysds_commons | library | README-declared prerequisite (`sciflo.md`) |
| sciflo | → | osaka | library | README-declared prerequisite (object/file staging) (`sciflo.md`) |
| sciflo | → | prov_es | library | README-declared prerequisite (provenance) (`sciflo.md`) |
| hysds | → | osaka | library | Stage-in/stage-out data localization (`osaka>=0.0.1`, `hysds.md`) |
| hysds | → | hysds_commons | library | Shared utilities/config (`hysds_commons>=0.1`, `hysds.md`) |
| hysds | → | prov_es | library | PROV-ES provenance generation (`prov_es>=0.2.0`, `hysds.md`) |
| hysds_commons | → | hysds | library | Circular: `from hysds.celery import app`, `do_submit_job`; resolved at runtime (`hysds_commons.md`, CAND-006) |
| osaka | → | S3 | s3-bucket | All stage-in / stage-out operations via boto3 (`osaka.md`) |
| osaka | → | Azure Blob / GCS / WebDAV / HTTP | object-store | Pluggable scheme dispatch (azure://, gs://, dav://, http://) (`osaka.md`) |

## Operator / provisioning edges

| Source | → | Target | Interface type | Notes |
|--------|---|--------|----------------|-------|
| sdscli | → | All PCM hosts | ssh | Config/template deployment via fab-classic (Fabric) over SSH (`sdscli.md`) |
| sdscli | → | OpenSearch (all clusters) | opensearch-index | Ships index templates + ISM/ILM policies; init via elasticsearch client (`sdscli.md`) |
| sdscli | → | RabbitMQ / Redis (all hosts) | amqp/redis | reset/status operations via kombu / redis (`sdscli.md`) |
| sdscli | → | AWS / GCP / Azure | cloud-api | Cloud provisioning (`sdscli/cloud/*`) (`sdscli.md`) |
