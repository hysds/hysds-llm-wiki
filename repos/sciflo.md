# sciflo

> SciFlo workflow framework and engine — the XML-defined DAG workflow runtime that powers Chimera's PGE job execution in HySDS.

**Owner:** hysds-core team (maintainer: Gerald Manipon; original author: Brian Wilson)  
**Criticality:** P1 — Chimera depends on it directly as its execution engine; if SciFlo breaks, PGE job orchestration via `run_sciflo.py` stops.  
**Language:** Python (&gt;=3.12)  
**Repo:** `hysds/sciflo` — https://github.com/hysds/sciflo  
**Last reviewed:** 2026-06-08

## Role in HySDS

SciFlo is a scientific workflow framework that executes workflows defined as XML
directed acyclic graphs (DAGs) in `.sf.xml` files. Each node in the graph is a
"work unit" — a Python function, inline Python, executable, REST call, nested
SciFlo, or a parallel/map job submitted to HySDS via Celery. SciFlo resolves the
data dependencies between work units, schedules them, and threads results from
one node into the inputs of the next.

In the PCM topology SciFlo sits **underneath Chimera**. Chimera's `run_sciflo.py`
loads a `.sf.xml` workflow (from `chimera/wf_xml/`) and hands it to SciFlo's
engine to drive the three-step PGE pattern (preprocess → execute PGE →
post-process). SciFlo is the generic DAG runtime; Chimera is the HySDS-specific
PGE skeleton built on top of it. SciFlo's `ParMapWorkUnit` / `ParWorkUnit` types
bridge into the HySDS world by submitting Celery jobs and propagating the HySDS
`_context.json` (priority, username, container image, container mappings).

## Deployment model

SciFlo is consumed as a **runtime library and CLI tool**, not a long-running
service in the typical deployment:

- **`sflExec.py`** — the main SciFlo workflow executor CLI
  (`sflExec.py [-c config.xml] [-o output_dir] [-d] [-v] [-f] [-a input1=val1,...] workflow.sf.xml`).
  This is what Chimera's `run_sciflo.py` ultimately drives.
- **`sciflod`** — a SciFlo daemon script (packaged as a console/scripts entry).
- **Cache / state servers** — Twisted Application Configuration (`.tac`) files in
  `tac/` define TCP servers for persistent dictionary / cache / event state
  (`PersistentDictServer.tac`, `WorkUnitCacheServer.tac`, `EventStoreServer.tac`).
  Managed via `startCacheServer.sh` / `stopCacheServer.sh` /
  `cleanAndStartCacheServer.sh`.

It is installed into the PCM environment alongside `hysds`, `hysds-commons`,
`osaka`, and `prov-es` (its declared prerequisites).

## Key interfaces

### CLI

`sflExec.py` is the primary entry point. Console-script entry points from
`setup.py`:

| Script | Source | Purpose |
|--------|--------|---------|
| `sflExec.py` | `scripts/sflExec.py` | Main SciFlo workflow executor |
| `sciflod` | `scripts/sciflod` | SciFlo daemon |
| `filelist.py` | `sciflo.utils.filelist:main` | File listing utility |
| `subsetAeronet.py` | `sciflo.data.aeronet.subset:main` | AERONET data subsetting |
| `hdfMetadata.py` | `sciflo.data.hdf:main` | HDF metadata extraction |

### Celery queues

SciFlo does not own a fixed queue name. The `ParMapWorkUnit` /
`ParWorkUnit` work-unit types submit parallel jobs to HySDS via Celery. The
queue name is encoded **per work-unit binding** in the call string
(`call.split('|')` yields `call`, `job_queue`, `async` flag in
`sciflo/grid/workUnit.py`). The AMQP endpoint itself is **not** configured in
SciFlo — a code comment is explicit: *"amqp endpoint is specified by
`celeryconfig.py` in hysds."* Job payloads inherit `priority`, `username`,
`container_image_name`, `container_image_url`, and `container_mappings` from the
HySDS `_context.json` when present.

### OpenSearch indices

None. SciFlo does **not** read or write OpenSearch/Elasticsearch indices
directly — grep for index creation/usage returns only unrelated `.index()`
list-method calls. State is held in its own persistent-dictionary TCP servers
and (optionally) Berkeley DB / RDBMS, not in the HySDS catalogs.

### State / cache servers (Twisted TCP)

`sciflo/event/pdict.py` defines `NamedDicts`, a registry of named persistent
dictionaries served over TCP:

| Named dict | Port | Backing store |
|------------|------|---------------|
| `WorkUnitCache` | from config `cachePort` | `WorkUnitCache` db file |
| EventStore | `8002` | `/tmp/EventStore/eventStore.db` |
| Test | `8009` | in-memory (`/tmp/Test.log`) |

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| twisted | runtime | `&gt;=18.9.0` — async networking; powers the `.tac` state/cache servers |
| pillow | runtime | `&gt;=5.4.1` — image processing |
| formencode | runtime | `&gt;=1.3.1` — validation |
| sqlobject | runtime | `&gt;=3.7.1` — ORM / RDBMS abstraction |
| service_identity | runtime | `&gt;=18.1.0` — TLS identity verification for Twisted |
| python-magic | runtime | `&gt;=0.4.15` — file type detection |
| celery | runtime | Parallel/map work-unit submission into HySDS (imported in `sciflo/grid/workUnit.py`, `funcs.py`) |
| hysds | infra | HySDS framework; provides `celeryconfig.py` (AMQP endpoint), job primitives |
| hysds-commons | infra | Shared HySDS utilities (README prerequisite) |
| osaka | infra | Object/file staging (README prerequisite) |
| prov-es | infra | PROV-ES provenance support (README prerequisite) |
| bsddb3 | optional | `&gt;=6.2.9` — Berkeley DB support; `pip install sciflo[berkeledb]`; conditionally imported, degrades gracefully |
| dbxml | optional | XML database support; `pip install sciflo[xmldb]` |
| lxml | runtime | XML/etree processing in the grid engine |

**Consumers:** `chimera` depends on SciFlo as its execution engine (see
`repos/chimera.md`).

## Configuration

- **Workflows** are XML `.sf.xml` files (the DAG definition). Nested SciFlos,
  REST calls, xquery/xpath, templates, and command-line work units are all
  supported work-unit types (`sciflo/grid/workUnitTypeMapping.py`).
- **`-c/--configFile`** passes an XML config file to `sflExec.py`.
- **`cachePort`** is read via `ScifloConfigParser` to bind the `WorkUnitCache`
  server port.
- **HySDS context** is read from `_context.json` in the work directory when
  present; the AMQP/Celery endpoint comes from **`celeryconfig.py` in hysds**,
  not from SciFlo config.
- **LDAP authentication** is supported via `ldapAuth.py` / `ldapSearch.py`
  helper scripts.
- A SciFlo working directory is created in a temp dir if `$HOME` creation fails
  (HC-522).

Never include secret values (LDAP binds, etc.) in committed config.

## Known constraints / risks

- **Tight coupling to HySDS for distributed execution.** SciFlo's parallel work
  units have no self-contained AMQP config; they assume a HySDS
  `celeryconfig.py` is on the path. Running SciFlo's parallel features outside a
  HySDS environment will fail.
- **Legacy / mixed-vintage codebase.** Original author Brian Wilson; the engine
  carries Berkeley DB, dbxml, MySQL start/stop scripts, and a CGI diagnostic
  (`sciflodiagnostic.cgi`) — much of this predates the current HySDS stack.
  Optional deps degrade gracefully but the surface area is large.
- **Recent Python 3.12 / multi-arch work is fresh** (HC-563, HC-567); the
  Python 3.12 compatibility pass and multi-architecture container builds are
  recent commits, so edge cases may still surface.
- **Disk-space handling:** non-zero exit code is now returned when disk fills up
  (HC-421) — callers/wrappers should check exit codes.
- **State servers bind hardcoded ports** (8002, 8009) for EventStore/Test;
  port collisions are possible on shared hosts.

## Open questions

- Which PCM host(s) run the SciFlo cache/state `.tac` servers in the canonical
  deployment, and are they actually used in the Chimera-driven PGE path or only
  in standalone SciFlo execution? (Add to `open-questions.md`.)
- Is `sciflod` used in any current HySDS deployment, or is invocation entirely
  via `sflExec.py` through Chimera's `run_sciflo.py`? (Add to
  `open-questions.md`.)
