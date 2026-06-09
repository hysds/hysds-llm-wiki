# RISK-003: Concurrent dataset-publish race in bulk ingest (checksum mismatch)

**Severity:** Medium-High  
**Likelihood:** Low-Medium  
**Affected components:** hysds (`dataset_ingest_bulk.py` publish path, ~L202); osaka (lock files, `.md5.osaka.lock.json`, S3 force-publish logic)  
**Owner:** hysds-core team  
**Date recorded:** 2026-06-08  

## Description

During high-concurrency bulk reprocessing workflows (observed in SWOT L1B_HR_SLC campaigns), two `verdi` workers can publish the same product to the same S3 location nearly concurrently, resulting in a **checksum mismatch**: the data file is written by one worker while its `.md5` checksum file is written by another. The two files differ only in their embedded production datetimes, but the mismatch causes a no-clobber job failure and silent data-integrity concerns.

### Trigger mechanism

1. A job is auto-retried (e.g., due to spot termination) and immediately redelivered by RabbitMQ.
2. The non-redelivered original job is not revoked, so both instances run concurrently.
3. Worker 1 (redelivered) begins publishing: uploads `_publish_context.json` lock, then data files, then `.md5.osaka.lock.json`.
4. Worker 2 (non-redelivered) detects the existing `_publish_context.json`, identifies a matching `payload_id`, and invokes **force-publish**.
5. Force-publish deletes the entire S3 dataset (to clear orphaned locks) then re-uploads.
6. Worker 1 writes its `.md5` file after Worker 2's delete, but before Worker 2 completes its own `.md5` write.
7. Result: Data file from Worker 2, checksum from Worker 1 &lt;→ mismatch + no-clobber exception.

### Why it matters

- **Silent data corruption risk:** Products in the catalog may have mismatched data and checksum, violating product integrity constraints.
- **Batch job failures:** Under high worker concurrency with auto-retries, clobber exceptions cascade, requiring manual intervention.
- **Test-to-production gap:** SWOT smoke test (2000 jobs, 400-worker cap) revealed the race only under sustained concurrent load.

### Source material

Derived from HYS Confluence page [3016163330](https://hysds-core.atlassian.net/wiki/spaces/HYS/pages/3016163330) (author: Michael Cayanan, last modified 2025-08-12). Ticket: HC-575.

## Mitigation

**Status:** Mitigated (HC-575 shipped, verified in SWOT smoke test).

The fix adds an **"is another worker actively publishing this dataset?"** check before force-publishing:

1. **Matching task_id:** If `payload_ids` and `task_ids` match the existing context, poll Celery `AsyncResult` (not OpenSearch task_status, to avoid worker→redis→logstash→ES lag) for task terminal state (SUCCESS, FAILURE, or REVOKED) with a **5-minute timeout**.
2. **Matching payload_id, different task_id:** Wait for the other task to finish. Only force-publish if the dataset is absent in GRQ afterward.
3. **Different payload_id:** Query job_status of the context's `payload_id`. If status is `job-started`, raise an exception so the other worker owns the publish.

### Validation

SWOT smoke test: 2000 L1B_HR_SLC jobs with ASG capped at 400 workers to force contention. Results:
- Clobber events: **4 occurrences** (down from observed baseline ~20+).
- 3 of 4 resolved via `type=orphaned_dataset-retry_previous_failed_waited_for_other_task_to_finish` (i.e., only required task-status polling 3 times).
- Checksum verification passed for all published products.

## Status

**Mitigated** — fix merged and deployed. Monitoring in place via clobber exception tallies in SWOT production and downstream checksum verification on product ingest.

---

## Related wiki content

- [Repos: hysds.md](../repos/hysds.md) — `dataset_ingest_bulk.py` module
- [Repos: osaka.md](../repos/osaka.md) — lock-file and force-publish semantics
- HC-575 Confluence ticket &amp; discussion thread
