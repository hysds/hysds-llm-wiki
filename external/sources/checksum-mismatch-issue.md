# SOURCE: Checksum Mismatch Issue (SWOT bulk-reprocessing publish race)

> Derived from HYS Confluence page **3016163330** (author: Michael Cayanan, last
> modified 2025-08-12). Captured for RISK + ADR grounding. Original:
> https://hysds-core.atlassian.net/wiki/spaces/HYS/pages/3016163330
> Ticket: HC-575. Code: hysds/dataset_ingest_bulk.py (publish path, ~L202).

## Summary

During SWOT's Bulk Reprocessing campaign, two `verdi` workers occasionally publish
the **same product to the same S3 location at nearly the same time**, producing a
**checksum (md5) mismatch**: the data file comes from worker 2 while its `.md5`
file comes from worker 1. The two products are byte-different only because their
production datetimes differ slightly. Result: one job fails with a no-clobber
exception.

## Nominal publishing behavior

1. Upload a `_publish_context.json` to S3 first — a **dataset-level lock**
   recording `task_id`, `payload_id`, `payload_hash` of the publishing worker.
2. Upload each dataset file.
3. Delete `_publish_context.json` when done.

## Off-nominal / force-publish logic (current)

If a worker finds an existing `_publish_context.json`:
- If its `payload_id` matches the context's → assume retry of an orphaned dataset → **force publish**.
- If `payload_id` differs → check job_status of the context's payload_id:
  - `job-failed` → orphaned dataset → **force publish**.
  - else → if dataset exists in GRQ → raise no-clobber; if not → orphaned → **force publish**.

## Root cause of the race

- A job is auto-retried (likely spot termination), then **immediately redelivered
  by RabbitMQ**.
- The non-redelivered job is supposed to be revoked but **isn't** → both run concurrently.
- worker 1 (redelivered) starts publishing: context JSON + data file + (mid-write) the `.md5.osaka.lock.json`.
- worker 2 (non-redelivered) force-publishes (same payload_id), which **deletes the
  entire S3 dataset first** (to clear orphaned lock files), then re-uploads.
- worker 1 writes its `.md5` after worker 2's force-delete; worker 2 then hits a
  no-clobber on the md5 → job failure + mismatched md5 vs data file.

## Proposed fix

Add an **"is another worker actively publishing?"** check before force-publishing:
- If payload_ids match → also compare `task_id`. If task_ids match, **wait for the
  other task to finish** using Celery `AsyncResult` (not OpenSearch task_status,
  to avoid worker→redis→logstash→ES lag). Terminal states: SUCCESS/FAILURE/REVOKED;
  poll up to **5 minutes**. Then check GRQ; force publish only if dataset absent.
- If payload_ids differ → query job_status of the context's payload_id; if
  `job-started`, raise an exception so the other worker owns publishing.

## Testing

SWOT smoke test: triggered **2000 L1B_HR_SLC jobs**, ASG capped at **400 workers**
to force the race; added downstream checksum verification. Clobber events dropped to
**4 occurrences**; 3 of 4 resolved via
`type=orphaned_dataset-retry_previous_failed_waited_for_other_task_to_finish`
(i.e. only had to poll task status 3 times).

## Relationship to our wiki

Touches `repos/osaka.md` (the OSAKA lock file / S3 publish path) and `repos/hysds.md`
(`dataset_ingest_bulk.py`). Distinct from RISK-002 (cgroups overflow). Candidate
RISK: concurrent-publish race in bulk dataset ingest; mitigation shipped per HC-575.
