# RISK-001: Dual ES/OpenSearch transition in hysds

**Severity:** Medium  
**Likelihood:** Medium  
**Affected components:** hysds (job_worker, event_processors, user_rules modules), Mozart, GRQ2  
**Owner:** hysds-core team  
**Date recorded:** 2026-06-08

## Description

The `hysds` package currently maintains support for both Elasticsearch 7.x and OpenSearch simultaneously during the HC-484/HC-606 migration. The `requirements.txt` pins both `elasticsearch>=7.0.0,<7.14.0` and `opensearch-py>=2.4.0`.

When cluster deployments are mixed (some hosts on ES, others on OpenSearch before full migration), version-skew bugs can emerge if one half of the cluster upgrades before the other. Index creation, alias management, and query syntax differ between the two backends; code paths must be validated against the deployed engine.

Example vectors:
- ES-specific query syntax or index settings used on an OpenSearch deployment.
- OpenSearch client throwing an exception on ES-style bulk-index requests.
- Alias resolution failing if Jazz indexes exist in ES but not yet in OpenSearch.

## Mitigation

- Code review of all ES/OpenSearch client paths in `es_util.py`, `event_processors.py`, `user_rules_job.py`, and `user_rules_dataset.py` to ensure vendor-neutral API usage.
- Staged migration with synchronized deployments: upgrade Mozart → GRQ → Verdi workers in lockstep, not piecemeal.
- Runtime ES client selection logic (if not already in place) to detect deployed backend and call vendor-specific paths only when necessary.
- Integration tests running against both ES 7.14 and OpenSearch 2.x.

## Status

Open
