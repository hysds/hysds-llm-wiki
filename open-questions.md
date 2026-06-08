# Open Questions

Unresolved items about HySDS architecture, ownership, and behavior.
Add entries with `wiki-keeper log open question <topic>`.

---

## Bach API / Bach UI purpose (added 2026-06-08)

The `bach-api` (port 8875 on GRQ) and `bach-ui` (served at `/bach-ui/` on Mozart)
appear in the proxy config and supervisor configs. Their specific purpose and
ownership are not documented in any README in `hysds-core/`.

**Related:** `dependencies/logical-service-graph.md`

---

## Otello role and relationship to Mozart (added 2026-06-08)

`hysds-core/otello` is present in the repo but not covered by the current
architecture docs. It appears to be a job submission client, but its relationship
to the Mozart REST API (wrapper? replacement? parallel?) is unclear.

**Related:** `repos/mozart.md` (once written)

---

## Python 3.9 vs 3.12 upgrade status (added 2026-06-08)

The live PCM deployment runs Python 3.9 in virtualenvs, but a `Python 3.12 upgrade prompts`
directory exists in the hysds parent directory. It's unknown whether this is an
active migration, an experiment, or abandoned work.

**Related:** `risks/` (may warrant a risk entry if 3.9 is EOL concern)

---

## Spyddder-man purpose and active use (added 2026-06-08)

`spyddder-man` is listed as an installed package but its role in the current
deployment is unclear. Whether it actively crawls/ingests data or is dormant
is unknown.

**Related:** `repos/` (no entry yet)

---

## GRQ2 worker concurrency (added 2026-06-08)

The GRQ2 README specifies `-w2` (2 gunicorn workers) but it is unknown whether
this is the canonical production setting or if worker count varies by deployment.
The intended configuration and rationale for the worker count are not documented.

**Related:** `repos/grq2.md`

---

## GRQ2 queue consumer ownership (added 2026-06-08)

GRQ2's celeryconfig.py defines four queues: `grq_update`, `grq_ingest`,
`grq_delete`, and `dataset_processed`. It is unknown which process or service
consumes these queues in the running system. Whether GRQ2 itself is the consumer,
or whether a separate Celery worker or Verdi instance consumes them, is not
documented.

**Related:** `repos/grq2.md`
