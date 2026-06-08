# Deployment Topology

Which processes run on which PCM host. Grounded in supervisor configs and
`HySDS-Current-Architecture.md`.

*Last updated: 2026-06-08*

---

## PCM Hosts

| Host | Role | Key infrastructure services |
|------|------|------------------------------|
| **Mozart** | Job orchestration hub; single entry point | RabbitMQ, Redis, OpenSearch, Apache |
| **GRQ** | Product/dataset catalog | OpenSearch, Apache |
| **Factotum** | Pre-warmed system worker | (none — connects remotely to Mozart) |
| **Metrics** | Monitoring and dashboards | OpenSearch, OpenSearch Dashboards, Redis, Apache |

---

## Mozart — Application processes (supervisord)

| Process | Package | Purpose |
|---------|---------|---------|
| `mozart_job_management` | `mozart` | Flask REST API :8888 |
| `orchestrator_datasets` | `hysds` | Trigger evaluation on new datasets |
| `orchestrator_jobs` | `hysds` | Job completion handling |
| `process_events` | `hysds` | Celery event capture → Redis buffer |
| `process_events_tasks` | `hysds` | Async event tasks |
| `logstash_indexer` | Logstash | Redis → Mozart OpenSearch indexing |
| `docker_registry` | Docker | Container image registry :5050 |
| `watchdog_job_timeouts` | `hysds` | Job timeout enforcement |
| `watchdog_task_timeouts` | `hysds` | Task timeout enforcement |
| `watchdog_worker_timeouts` | `hysds` | Worker heartbeat monitoring |
| `sync_ec2_target_tracking_metric-*` | `hysds` | Queue depth → CloudWatch metrics (×4 ASGs) |
| `instance_stats` | `hysds` | EC2 instance stats logging |
| `watch_supervisord_services` | `hysds` | Supervisor health monitoring |
| `watch_systemd_services` | `hysds` | Systemd service health monitoring |

---

## GRQ — Application processes (supervisord)

| Process | Package | Purpose |
|---------|---------|---------|
| `grq2` | `grq2` | Dataset catalog REST API :8878 |
| `pele` | `pele` | Authenticated data access API :8877 |
| `bach-api` | unknown | API at :8875 [Unknown — see open-questions.md] |
| `instance_stats` | `hysds` | EC2 instance stats logging |
| `watch_supervisord_services` | `hysds` | Supervisor health monitoring |
| `watch_systemd_services` | `hysds` | Systemd service health monitoring |

---

## Factotum — Application processes (supervisord)

| Process | Package | Queue | Purpose |
|---------|---------|-------|---------|
| `on_demand_job` | `hysds` | `on_demand_job` | On-demand job trigger evaluation |
| `on_demand_dataset` | `hysds` | `on_demand_dataset` | On-demand dataset trigger evaluation |
| `user_rules_job` | `hysds` | `user_rules_job` | User rule evaluation on jobs |
| `user_rules_dataset` | `hysds` | `user_rules_dataset` | User rule evaluation on datasets |
| `user_rules_trigger` | `hysds` | `user_rules_trigger` | Trigger rule submission |
| `import_prov_es` | `prov_es` | `import_prov_es` | Provenance document import |
| `system-jobs-queue` | `hysds` | `system-jobs-queue` | Lightweight system jobs |
| `factotum-job_worker-small` | `hysds` | `factotum-job_worker-small` | Small containerized system jobs |
| `factotum-job_worker-large` | `hysds` | `factotum-job_worker-large` | Large containerized system jobs |
| `docker_registry` | Docker | — | Local container registry :5050 |
| `instance_stats` | `hysds` | — | EC2 instance stats |

---

## Metrics — Application processes (supervisord)

| Process | Package | Purpose |
|---------|---------|---------|
| `logstash_indexer` | Logstash | Metrics Redis → Metrics OpenSearch indexing |
| `instance_stats` | `hysds` | EC2 instance stats logging |
| `watch_supervisord_services` | `hysds` | Supervisor health monitoring |
| `watch_systemd_services` | `hysds` | Systemd service health monitoring |

---

## Verdi workers (auto-scaling fleet)

Verdi workers are ephemeral EC2 instances. They do not run any of the above
supervisord processes. Each worker:

1. Connects to Mozart RabbitMQ and waits for jobs.
2. Pulls PGE container images from Mozart or Factotum Docker Registry.
3. Executes jobs via `chimera` → PGE container.
4. Publishes results to GRQ and updates job status on Mozart Redis.

Four ASGs, one per queue tier: `sandbox`, `8gb`, `16gb`, `32gb`.
