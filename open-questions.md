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
