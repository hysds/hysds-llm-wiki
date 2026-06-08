# Dependencies

This directory documents how HySDS components depend on each other.

## Files

| File | Purpose |
|------|---------|
| [`logical-service-graph.md`](logical-service-graph.md) | Human-readable narrative of the runtime service topology |
| [`deployment-topology.md`](deployment-topology.md) | Which services run on which PCM host |
| [`inventory.md`](inventory.md) | Flat list of all known dependency edges |
| [`candidate-adrs.md`](candidate-adrs.md) | Dependency decisions that imply ADRs not yet written |

## How to read this

- **Logical service graph** — start here for "what talks to what."
- **Deployment topology** — start here for "what runs where."
- **Inventory** — the machine-readable edge list; updated by `dependency-mapper` agent.
- **Candidate ADRs** — a backlog; use `adr-writer promote candidate adr <id>` to convert.

## Dependency conventions

- Direction `A → B` means A depends on B (A calls, reads from, or publishes to B).
- Component names come from [`standards/glossary.md`](../standards/glossary.md).
- IPs and hostnames are NOT used here — use component names.
