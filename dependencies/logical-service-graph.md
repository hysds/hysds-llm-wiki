# Logical Service Graph

Runtime dependency topology for HySDS. All edges are grounded in the
`HySDS-Current-Architecture.md` reference document and live `celeryconfig.py`
values. Component names follow [`standards/glossary.md`](../standards/glossary.md).

*Last updated: 2026-06-08 (initial bootstrap from architecture docs)*

---

## Control plane overview

```
                    ┌──────────────────────────────────────────┐
                    │              HySDS PCM Layer              │
                    │                                          │
  Users / CLI ─────►  Mozart                                  │
                    │   ├── Mozart REST API (:8888)            │
                    │   ├── RabbitMQ (:5672)  ←── all queues  │
                    │   ├── Redis (:6379)      ←── results/buf │
                    │   ├── OpenSearch (:9200) ←── job status  │
                    │   └── Docker Registry (:5050)            │
                    │                                          │
                    │   GRQ                                    │
                    │   ├── GRQ2 REST API (:8878)             │
                    │   ├── Pele API (:8877)                  │
                    │   └── OpenSearch (:9200) ←── products   │
                    │                                          │
                    │   Factotum                               │
                    │   └── Celery workers → Mozart RabbitMQ  │
                    │                                          │
                    │   Metrics                                │
                    │   ├── OpenSearch Dashboards (:5601)     │
                    │   ├── OpenSearch (:9200) ←── logs/stats │
                    │   └── Redis (:6379)      ←── metrics buf│
                    └──────────────────────────────────────────┘
                                    │
                                    ▼
                    Verdi Fleet (auto-scaling EC2 workers)
                    ├── Pull jobs from Mozart RabbitMQ queues
                    ├── Pull images from Mozart Docker Registry
                    ├── Stage-in data via osaka (S3)
                    ├── Execute PGE containers
                    ├── Stage-out results via osaka (S3)
                    └── Publish datasets to GRQ REST API
```

---

## Key data flows

### Job submission flow

```
User/Client → Mozart REST API → RabbitMQ queue
                                      │
                               Verdi worker consumes
                                      │
                        osaka stage-in (S3 → /data/work)
                                      │
                        Docker pull from Mozart registry
                                      │
                          PGE container execution
                                      │
                        osaka stage-out (/data/work → S3)
                                      │
                        GRQ REST API ← dataset publish
                                      │
                        Mozart Redis ← job status update
```

### Trigger rule evaluation flow

```
New dataset published to GRQ
          │
          ▼
GRQ → RabbitMQ (dataset_processed queue)
          │
          ▼
Mozart orchestrator_datasets worker
          │
   Evaluate user rules
          │
   ┌──────┴──────┐
   No match    Match → submit follow-on job to RabbitMQ
```

### Event indexing flow

```
Celery workers → process_events.py → Mozart Redis (key: logstash)
                                           │
                                     Logstash indexer
                                           │
                              Mozart OpenSearch (job_status, etc.)
```

---

## Component dependency matrix

| From | To | Interface | Purpose |
|------|----|-----------|---------|
| Mozart REST API | Mozart RabbitMQ | AMQP | Submit jobs to queues |
| Mozart REST API | Mozart OpenSearch | HTTP :9200 | Read/write job specs, user rules, job status |
| Mozart orchestrator | Mozart RabbitMQ | AMQP | Consume `dataset_processed`, `jobs_processed` |
| Mozart orchestrator | GRQ REST API | HTTP :8878 | Query datasets for trigger evaluation |
| Factotum workers | Mozart RabbitMQ | AMQP | Consume system and user-rule queues |
| Factotum workers | GRQ REST API | HTTP :8878 | Dataset operations |
| Verdi workers | Mozart RabbitMQ | AMQP | Consume job queues |
| Verdi workers | Mozart Docker Registry | HTTP :5050 | Pull PGE container images |
| Verdi workers | GRQ REST API | HTTP :8878 | Publish datasets after PGE |
| Verdi workers | Mozart Redis | Redis | Update job status |
| Verdi workers | S3 (osaka) | AWS S3 API | Stage-in inputs, stage-out outputs |
| Logstash (Mozart) | Mozart Redis | Redis | Consume event buffer |
| Logstash (Mozart) | Mozart OpenSearch | HTTP :9200 | Index job/worker/task events |
| Logstash (Metrics) | Metrics Redis | Redis | Consume metrics buffer |
| Logstash (Metrics) | Metrics OpenSearch | HTTP :9200 | Index logs and stats |
| sync_ec2_metric scripts | Mozart RabbitMQ management | HTTP :15672 | Poll queue depths |
| sync_ec2_metric scripts | AWS CloudWatch | AWS API | Push scaling metrics |
| Apache proxy (Mozart) | GRQ2 REST API | HTTP :8878 | Proxy `/grq/` → GRQ |
| Apache proxy (Mozart) | Pele API | HTTP :8877 | Proxy `/pele/` → Pele |
| Apache proxy (Mozart) | Metrics Dashboards | HTTP :5601 | Proxy `/metrics/` → Dashboards |
