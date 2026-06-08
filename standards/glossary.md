# HySDS Glossary

Terms and acronyms used throughout the HySDS wiki.

## Core System

| Term | Definition |
|------|------------|
| **HySDS** | Hybrid Science Data System — large-scale distributed job orchestration framework developed at JPL/NASA |
| **PCM** | Processing Control and Data Management — the four-node control plane (Mozart, GRQ, Factotum, Metrics) |
| **PGE** | Product Generation Executable — a containerized algorithm that processes science data |
| **SDS** | Science Data System — the broader category of systems HySDS belongs to |
| **Venue** | A named deployment instance of HySDS (e.g., `maap-uat-v5`) |

## PCM Components

| Term | Definition |
|------|------------|
| **Mozart** | Central job orchestration hub; hosts the Mozart REST API, RabbitMQ, Redis, and the job status OpenSearch index |
| **GRQ** | Geospatial Record Query — the product/dataset catalog node; hosts GRQ2 REST API and the product OpenSearch index |
| **Factotum** | Pre-warmed "hot worker" node for system-level Celery jobs (trigger evaluation, housekeeping) |
| **Metrics** | Monitoring node; hosts OpenSearch Dashboards and the metrics/logs OpenSearch index |
| **Verdi** | Auto-scaling EC2 worker fleet that executes user PGE jobs; instances are ephemeral |

## Software Components

| Term | Definition |
|------|------------|
| **hysds** | Core Python package; implements the Celery application, orchestrator workers, and Verdi job runner |
| **mozart** | Flask REST API for job lifecycle management, job specs, containers, user rules |
| **grq2** | Flask REST API for dataset CRUD and faceted search against the product catalog |
| **pele** | Authenticated data access REST API layered over GRQ's product catalog |
| **chimera** | SDS workflow engine; wraps PGE execution with pre/post processing hooks |
| **osaka** | Data localization library — stage-in (S3→local) and stage-out (local→S3) |
| **sdscli** | CLI for rendering Jinja2 config templates and deploying HySDS components over SSH (via Fabric) |
| **otello** | Job submission client library |
| **hysds_commons** | Shared utilities used by multiple HySDS packages |
| **sciflo** | Scientific workflow engine (legacy; co-located on GRQ) |
| **prov_es** | Provenance tracking — records job inputs/outputs as W3C PROV documents |
| **container-builder** | Tool for building and registering PGE container images |
| **hysds_ui** | React-based web UI for job submission and monitoring (served at `/hysds_ui/`) |
| **bach-api** / **bach-ui** | Secondary UI and API (purpose: TBD) |
| **spyddder-man** | Data crawler/extractor |

## Infrastructure

| Term | Definition |
|------|------------|
| **ASG** | AWS Auto Scaling Group — manages the Verdi worker fleet |
| **RabbitMQ** | AMQP message broker (hosted on Mozart) that routes all Celery tasks |
| **OpenSearch** | Elasticsearch-compatible search engine; three instances: Mozart (jobs), GRQ (products), Metrics (logs) |
| **Logstash** | Log/event pipeline that reads from Redis and indexes into OpenSearch |
| **supervisord** | Process manager used on all PCM nodes to manage application-layer processes |
| **sdscli** | Deployment CLI; renders Jinja2 templates and coordinates remote config pushes |
| **celeryconfig.py** | Central configuration file present on every node; defines all service endpoints |

## Data / Workflow

| Term | Definition |
|------|------------|
| **Job spec** | JSON document registered in Mozart that describes a runnable job type (container, params, queues) |
| **HySDS I/O (hysds_ios)** | Schema describing a job's input/output signature; stored in both Mozart and GRQ OpenSearch |
| **User rule** | Trigger rule that fires a job automatically when a new dataset matches a condition; stored in Mozart or GRQ |
| **Dataset** | A science data product published to the GRQ catalog after a PGE completes |
| **Orchestrator** | Celery worker on Mozart that evaluates trigger rules and creates follow-on jobs |
| **Queue depth metric** | CloudWatch custom metric pushed by `sync_ec2_target_tracking_metric` scripts to drive ASG scaling |
| **Osaka stage-in/out** | Download inputs from S3 before job; upload outputs to S3 after job |
| **triaged_job** | A failed or timed-out job whose work directory is preserved in S3 for debugging |
