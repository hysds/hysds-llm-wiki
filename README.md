# HySDS Wiki

Knowledge repository for the **Hybrid Science Data System (HySDS)** — a
large-scale distributed job orchestration framework developed at JPL/NASA.

This wiki covers the eight core application repos, architectural decisions,
cross-cutting features, operational risks, and the dependency topology of the
PCM (Processing Control and Data Management) layer.

**Implementation lives in `hysds-core/`. This repo is knowledge only.**

---

## Repositories

| Repo | Role | Criticality | Last reviewed |
|------|------|-------------|---------------|
| [Chimera](repos/chimera.md) | Rule-based event-driven workflow engine — evaluates preconditions against GRQ2 catalog, constructs PGE job payloads via hysds_commons, and submits jobs to Mozart | P1 | 2026-06-08 |
| [GRQ2](repos/grq2.md) | GeoRegionQuery — Flask/OpenSearch data-catalog and dataset-metadata API | P1 | 2026-06-08 |
| [HySDS](repos/hysds.md) | Core HySDS library — Celery workers (job_worker, task_worker), orchestrator, user-rules engine, container factory | P1 | 2026-06-08 |
| [HySDS Commons](repos/hysds_commons.md) | Shared Python library providing job-submission helpers, OpenSearch/ES client wrappers, and schema validation used by mozart, chimera, and other components | P1 | 2026-06-08 |
| [HySDS UI](repos/hysds_ui.md) | React SPA — primary web interface for dataset discovery (Tosca/GRQ), job monitoring (Figaro/Mozart), on-demand job submission, and user-rules management | P1 | 2026-06-08 |
| [Mozart](repos/mozart.md) | Central job-orchestration hub: REST API, RabbitMQ, Redis, OpenSearch job-status index | P1 | 2026-06-08 |
| [Osaka](repos/osaka.md) | Object-Store Abstraction Architecture — pluggable file-transfer library for moving HySDS product files to/from heterogeneous backend storage systems | P1 | 2026-06-08 |
| [SDS CLI](repos/sdscli.md) | SDS Command-Line Interface — Infrastructure-as-Code tool for provisioning, configuring, deploying, and managing the full HySDS cluster lifecycle | P1 | 2026-06-08 |

---

## Decision Log

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](decisions/ADR-001-hysds-commons-runtime-circular-dependency.md) | hysds_commons runtime circular dependency on hysds | Accepted | 2026-06-08 |

---

## Feature Map

| Feature | Status | Owner | Date documented |
|---------|--------|-------|-----------------|
| *(none yet)* | | | |

---

## Risk Register

| Risk | Severity | Likelihood | Owner | Status |
|------|----------|------------|-------|--------|
| [RISK-001: Dual ES/OpenSearch transition in hysds](risks/RISK-001-dual-es-opensearch-transition.md) | Medium | Medium | hysds-core team | Open |
| [RISK-002: ARM64 cgroups v2 job-status overflow (HC-630)](risks/RISK-002-arm64-cgroups-v2-overflow.md) | High | Medium | hysds-core team | Mitigated |

---

## Quick navigation

- [Glossary](standards/glossary.md) — HySDS acronyms and terms
- [Knowledge capture standards](standards/knowledge-capture.md) — how this wiki is written
- [Dependency overview](dependencies/README.md) — service graph and topology
- [Open questions](open-questions.md) — unresolved items
- [Contributing](CONTRIBUTING.md) — how to add/update content

---

## PCM topology at a glance

```
Users / CLI
    │
    ▼
Mozart ──── GRQ ──── Factotum
  │    ↕      │
  │  RabbitMQ │
  │           │
Metrics    Verdi fleet (auto-scaling)
```

| Node | Primary role |
|------|-------------|
| **Mozart** | Job orchestration hub; REST API, RabbitMQ, Redis, job status OpenSearch |
| **GRQ** | Product/dataset catalog; GRQ2 REST API, product OpenSearch |
| **Factotum** | Pre-warmed worker; system jobs, trigger evaluation |
| **Metrics** | Monitoring; OpenSearch Dashboards, metrics/log OpenSearch |
| **Verdi** | Auto-scaling EC2 workers; execute user PGE jobs |
