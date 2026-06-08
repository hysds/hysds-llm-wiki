# Dependency Inventory

Flat edge list. Maintained by the `dependency-mapper` agent.
Direction: A → B means A depends on B.

*Last updated: 2026-06-08 (initial bootstrap)*

| Source | → | Target | Interface type | Notes |
|--------|---|--------|----------------|-------|
| Mozart REST API | → | Mozart RabbitMQ | amqp-queue | Job submission |
| Mozart REST API | → | Mozart OpenSearch | opensearch-index | job_specs, containers, user_rules-mozart, hysds_ios-mozart |
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
| Verdi workers | → | GRQ REST API | http-rest | Dataset publishing after PGE |
| Verdi workers | → | Mozart Redis | redis-key | Job status updates |
| Verdi workers | → | S3 (osaka stage-in) | s3-bucket | Input data localization |
| Verdi workers | → | S3 (osaka stage-out) | s3-bucket | Output staging (`maap-uat-workspace` bucket) |
| Metrics Logstash | → | Metrics Redis | redis-key | Consumes metrics buffer |
| Metrics Logstash | → | Metrics OpenSearch | opensearch-index | logstash-*, sdswatch-*, instance stats |
| osaka | → | S3 | s3-bucket | All stage-in / stage-out operations |
| chimera | → | hysds | library | Wraps PGE execution using hysds worker primitives |
| mozart (package) | → | hysds | library | Uses hysds Celery app and utilities |
| grq2 (package) | → | GRQ OpenSearch | opensearch-index | grq_*, user_rules-grq, hysds_ios-grq |
| pele | → | GRQ OpenSearch | opensearch-index | Read-only product catalog access |
| sdscli | → | All PCM hosts | ssh | Config deployment via Fabric over SSH |
