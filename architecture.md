# System Architecture &amp; Flows

Cluster-wide architecture and runtime flow diagrams for HySDS. These are rendered
from the draw.io sources kept alongside the code (`*.drawio` / `*.drawio.xml`) and
exported to SVG under `site/static/img/diagrams/`. Per-repo component diagrams live
in each [repo deep-dive](README.md#repositories).

> **Regenerating:** edit the `.drawio` source in the corresponding repo, then export
> to SVG with the draw.io desktop CLI, e.g.
> `"/Applications/draw.io.app/Contents/MacOS/draw.io" --no-sandbox -x -f svg -o site/static/img/diagrams/<name>.svg <source>.drawio`

## HySDS component architecture

The full Hybrid Cloud Science Data System component architecture — PCM hosts
(Mozart, GRQ, Metrics, Factotum), the Verdi worker fleet, and the data stores they
share.

![HySDS component architecture](/img/diagrams/hysds-component-architecture.svg)

*Source: `HySDS-Component Architecture.drawio` (repo root).*

## Overall system architecture

System-level view of the `hysds` core library and the Celery-based worker framework.

![HySDS overall system architecture](/img/diagrams/hysds-overall-system-architecture.svg)

*Source: `hysds/.claude/hysds_overall_system_architecture.drawio`.*

## Job execution flow

How a submitted job moves through Mozart, the queues, and a Verdi worker to execution.

![Job execution flow](/img/diagrams/hysds-job-execution-flow.svg)

For the step-by-step internals (orchestrator, job/task workers, container factory):

![Detailed job execution flow](/img/diagrams/hysds-detailed-job-execution-flow.svg)

*Source: `hysds/.claude/hysds_job_execution_flow.drawio`, `hysds_detailed_job_execution_flow.drawio`.*

## Data-driven triggering flow

How a newly published dataset drives user-rule evaluation and triggers downstream jobs.

![Data-driven triggering flow](/img/diagrams/hysds-data-triggering-flow.svg)

Detailed view (dataset-processed queue, user-rules engine, trigger evaluation):

![Detailed data-driven triggering flow](/img/diagrams/hysds-detailed-data-triggering-flow.svg)

*Source: `hysds/.claude/hysds_data_triggering_flow.drawio`, `hysds_detailed_data_triggering_flow.drawio`.*

## Data search flow

How product/dataset queries are served from the GRQ catalog.

![Data search flow](/img/diagrams/hysds-data-search-flow.svg)

Detailed view:

![Detailed data search flow](/img/diagrams/hysds-detailed-data-search-flow.svg)

*Source: `hysds/.claude/hysds_data_search_flow.drawio`, `hysds_detailed_data_search_flow.drawio`.*
