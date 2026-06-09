# Chimera

> Rule-based, event-driven PGE workflow engine for HySDS, built on the SciFlo framework.

**Owner:** hysds-core team (Confirmed)  
**Criticality:** P1 — Chimera is the rule-based event-driven workflow engine; without it, automated job submission in response to new data does not happen. (Confirmed)  
**Language:** Python (>=3.12)  
**Repo:** `hysds-core/chimera`  
**Last reviewed:** 2026-06-08

## Architecture diagram

![Chimera core architecture](/img/diagrams/chimera-core-architecture.svg)

*Source: `chimera/chimera_core_architecture.drawio.xml` (draw.io), exported to SVG.*

## Role in HySDS

Chimera is a generalized workflow skeleton that lets any HySDS project run a Product Generation Executable (PGE) through three composable steps: **input preprocessing**, **PGE execution**, and **post-processing**. It sits between incoming data events and Mozart job submission, evaluating preconditions (e.g., data availability in the GRQ catalog) before constructing and submitting a HySDS job. It is implemented using the SciFlo workflow infrastructure integrated with the HySDS framework and is designed to be adapted per-project via configuration and subclassing rather than code forks.

## Deployment model

Chimera is **not a standalone long-running service**. It runs as a triggered process: an external caller (cron, a HySDS trigger rule, or another component) invokes `run_sciflo.py`, the main entry point, which executes a SciFlo workflow (`.sf.xml` definitions in `chimera/wf_xml/`). It is consumed as a runtime library against `hysds`/`hysds_commons` primitives and is installed into the PCM environment where PGE jobs are orchestrated. A `run_pge_docker.py` helper and Docker-based development scripts support the Python 3.12 workflow.

## Key interfaces

### Workflow entry point
- `chimera/run_sciflo.py` — primary entry point; executes a SciFlo `.sf.xml` workflow.
- Workflow definitions: `chimera/wf_xml/` (e.g., `sample.sf.xml`, plus `examples/`).

### Job submission (to Mozart)
`chimera/pge_job_submitter.py` (`PgeJobSubmitter`) constructs the job payload using `hysds_commons.job_utils.resolve_hysds_job`, then submits it. Job type and queue are resolved per PGE from the Chimera config via the `JOB_TYPES` and `JOB_QUEUES` maps keyed on `pge_name`; the job type is formed as `&lt;job_name>:&lt;release_version>`.

### Precondition / catalog evaluation
`chimera/precondition_evaluator.py` + `precondition_functions.py` evaluate preconditions (data availability) before proceeding, querying the GRQ2 catalog. `chimera/input_preprocessor.py` handles input pre-processing.

### Post-processing
`chimera/postprocess_evaluator.py` + `postprocess_functions.py` and `chimera/post_processor.py` run the post-processing step.

### OpenSearch / Elasticsearch indices
Chimera consumes the GRQ2 catalog for precondition checks via `elasticsearch` / `elasticsearch-dsl` (7.x). No Chimera-owned index creation was found in the package; index access is read-oriented against existing catalog indices.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `hysds` / `hysds_commons` | runtime (library) | Wraps PGE execution using HySDS worker primitives; `resolve_hysds_job` builds the job payload |
| `elasticsearch>=7.10,&lt;8` | runtime | Query GRQ2 catalog for precondition evaluation |
| `elasticsearch-dsl>=7.4,&lt;8` | runtime | DSL queries against catalog indices |
| `requests>=2.28` | runtime | HTTP calls (e.g., Mozart job submission) |
| `simplejson>=3.18` | runtime | JSON serialization |
| `PyYAML>=6.0` | runtime | Parse Chimera and PGE config YAML files |
| SciFlo | infra | Workflow execution engine (HySDS-integrated) |

See `dependencies/inventory.md`: `chimera → hysds` (library) edge is recorded.

## Configuration

Chimera uses an adapter/strategy pattern wired entirely through configuration:

- `chimera/configs/chimera_config.yaml` — declares the pluggable classes via `module_path` / `class_name` for the `preprocessor` (subclass of `PreConditionFunctions`) and `job_submitter` (subclass of `PgeJobSubmitter`). Also holds `JOB_TYPES` and `JOB_QUEUES` maps.
- `settings.yaml` (`CHIMERA` section) — environment/runtime settings.
- `chimera/configs/pge_configs/` — per-PGE config YAML (`pge_config_template.yaml`, plus `examples/`); each declares `pge_name`, preconditions, postprocess, runconfig, and localization details.
- Key constants centralized in `chimera/commons/constants.py` (`ChimeraConstants`), including `PGE_SIMULATION_MODE` (`PGE_SIM_MODE`), `JOB_TYPES`, `JOB_QUEUES`, `PRECONDITIONS`, `POSTPROCESS`, and `RELEASE_VERSION`.

Never commit secret values to these files.

## Known constraints / risks

- **Subclass contract is enforced by convention, not the type system.** The `preprocessor` and `job_submitter` classes named in `chimera_config.yaml` must subclass `PreConditionFunctions` / `PgeJobSubmitter` respectively. Misconfiguration surfaces only at runtime when the SciFlo workflow loads the class.
- **Tight coupling to HySDS job payload format.** `PgeJobSubmitter` depends on `hysds_commons.job_utils.resolve_hysds_job`; breaking changes to that payload contract or to Mozart's submit API directly affect Chimera.
- **Release version resolution has two sources.** Job type version comes from `context[RELEASE_VERSION]` if present, otherwise from `container_specification.version`; an unset/mismatched version yields a wrong `job_type` (`name:version`) and a failed or misrouted submission.
- **Recent Python 3.12 migration.** The repo recently completed a Python 3.12 upgrade (formatting/modernization, dependency bumps, new unit tests for constants and config utilities). Elasticsearch client is pinned to 7.x (`&lt;8.0.0`), which constrains compatibility with newer OpenSearch/Elasticsearch clusters.

## Open questions

- Which PCM host(s) and trigger mechanism (cron vs. HySDS trigger rule vs. external caller) invoke `run_sciflo.py` in the canonical deployment? (Add to `open-questions.md`.)
- Does any deployment have Chimera writing to OpenSearch indices, or is catalog access strictly read-only across all projects?
- What is the intended migration path off the Elasticsearch 7.x client pin given the broader HySDS move toward OpenSearch?
