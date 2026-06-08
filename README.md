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
| *(none yet — run `document repo <name>` to add entries)* | | | |

---

## Decision Log

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| *(none yet)* | | | |

---

## Feature Map

| Feature | Status | Owner | Date documented |
|---------|--------|-------|-----------------|
| *(none yet)* | | | |

---

## Risk Register

| Risk | Severity | Likelihood | Owner | Status |
|------|----------|------------|-------|--------|
| *(none yet)* | | | | |

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
