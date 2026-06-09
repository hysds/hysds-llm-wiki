# sdscli

> Command-line interface (`sds`) for provisioning, configuring, deploying, and managing the lifecycle of an entire HySDS / SDSKit cluster.

**Owner:** hysds-core team  
**Criticality:** P1 — sole cluster-provisioning and lifecycle tool; without it operators cannot deploy or update any HySDS component.  
**Language:** Python ≥3.12 (per HC-563)  
**Repo:** `hysds/sdscli` (https://github.com/hysds/sdscli)  
**Version:** 2.0.0  
**Last reviewed:** 2026-06-08

## Architecture diagram

![sdscli core architecture](/img/diagrams/sdscli-core-architecture.svg)

*Source: `sdscli/sdscli_core_architecture.drawio.xml` (draw.io), exported to SVG.*

## Role in HySDS

`sdscli` is the Infrastructure-as-Code and administrative control plane for HySDS. It is not a data-facing client; it is the operator tool that stands up and maintains a cluster's PCM hosts — **Mozart**, **GRQ**, **Metrics**, **Factotum**, **CI**, and **Verdi** workers. It interactively gathers cluster configuration (`sds configure`), generates the cluster YAML at `~/.sds/config`, and then deploys, starts, stops, updates, and reports status across every host over SSH. It sits above all other documented repos: it is what installs and configures them.

## Deployment model

`sdscli` is a CLI tool, not a long-running service. It is installed (typically into a virtualenv) on an operator/admin workstation or a bastion host and invoked as the `sds` command (`console_scripts: sds=sdscli.command_line:main`). It executes remotely against the cluster's PCM hosts via SSH using **fab-classic** (Fabric), pushing rendered **Jinja2** templates from `sdscli/adapters/hysds/files/` to each target machine. It manages remote components that themselves run under supervisord / systemd and (increasingly) inside Docker/Podman containers (see recent Verdi/Podman work, HC-522).

## Architecture

`sdscli` uses an **adapter / Strategy pattern**. `command_line.py` defines the `argparse` command tree, then `get_adapter_func(sds_type, mod_name, func_name)` dynamically imports the matching function from `sdscli/adapters/<sds_type>/<mod_name>.py`. The primary `sds_type` is `hysds`; an `sdskit` adapter also exists. Each CLI subcommand maps to a module under `adapters/hysds/`:

| Module | Responsibility |
|--------|----------------|
| `configure.py` | Interactive prompts → render cluster YAML (`~/.sds/config`) |
| `orch.py` | Orchestrated init/start/stop across components (`mozart`, `grq`, `metrics`, `factotum`, `ci`, `verdi`) |
| `start.py` / `stop.py` | Per-component start/stop over SSH |
| `start_tps.py` / `stop_tps.py` | Third-party services (TPS) lifecycle |
| `update.py` | Update components, ship code/config, Kibana/OpenSearch Dashboards updates |
| `status.py` | Cluster/component status reporting |
| `reset.py` | Reset state (incl. HTTPS-enabled RabbitMQ reset, HC-530/HC-539) |
| `cloud.py` | Cloud provisioning dispatch |
| `pkg.py` | Package import/export (container name-only images, user-rules) |
| `rules.py` | User-rules management |
| `ci.py` | CI (Jenkins) integration |
| `fabfile.py` | Fabric task definitions used for remote execution |

Cloud provider integrations live under `sdscli/cloud/` with submodules for `aws`, `azure`, and `gcp`.

## Key interfaces

### CLI

Entry point `sds`. Top-level subcommands include `configure`, `cloud`, `pkg`, `reset`, `start`, `stop`, `job`, `create_staging_area`, plus the orchestration verbs surfaced via `orch` (`sds orch init all`, `sds orch start all`, `sds orch stop all`). Typical bootstrap flow (from README):

```
sds configure
sds orch init all
sds orch start all
```

### Remote execution

SSH via fab-classic; configuration and scripts delivered as Jinja2 templates from `adapters/hysds/files/` (e.g. `supervisord.conf.tmpl`, `kibana.yml`, `opensearch_dashboards.yml`, `*.template` status mappings, watcher scripts).

### OpenSearch / data stores

`sdscli` does not own runtime indices but ships index templates and ISM/ILM policies used to initialize cluster stores, including `es_template-base.json`, `job_status.template` (now includes a `job_failed` index, HC-546), `task_status.template`, `worker_status.template`, `event_status.template`, `es_ilm_policy_mozart.json`, and `opensearch_ism_policy_mozart.json`. It connects to OpenSearch/Elasticsearch via the `elasticsearch`/`elasticsearch-dsl` clients, and to RabbitMQ/Redis via `kombu` and `redis` for reset/status operations.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| PyYAML (>=5.1) | runtime | Read/write the `~/.sds/config` cluster YAML |
| Jinja2 (>=3.0,&lt;4.0) | runtime | Render deployment templates in `adapters/hysds/files/` |
| fab-classic (>=1.19.2) | runtime | Remote command execution over SSH (Fabric) |
| prompt-toolkit (>=1.0,&lt;2.0) | runtime | Interactive `sds configure` prompts |
| Pygments, tqdm, backoff, requests | runtime | Output formatting, progress, retries, HTTP |
| boto3 / awscli (>=1.11 / >=1.17) | infra | AWS provisioning and S3 interaction |
| GCP / Azure SDKs | infra | Cloud provisioning (`sdscli/cloud/{gcp,azure}`) |
| kombu (>=4.5) | runtime | RabbitMQ interaction (reset/status) |
| redis (>=3.2) | runtime | Redis interaction (reset/status) |
| elasticsearch (>=7.0,&lt;7.14) / elasticsearch-dsl (>=7.0,&lt;=7.4) | runtime | OpenSearch/Elasticsearch index init and queries |

Dependency edge (per `dependencies/inventory.md`): **sdscli → all PCM hosts** via SSH, for config deployment over Fabric.

## Configuration

- **Input:** interactive `sds configure` prompts collect host IPs/FQDNs (`MOZART_*`, `GRQ_*`, `METRICS_*`, `CI_*`, `_PUB_IP`/`_PVT_IP`/`_FQDN`), credentials (`MOZART_RABBIT_USER`/`MOZART_RABBIT_PASSWORD`, `*_REDIS_PASSWORD`, `OPS_USER`/`OPS_PASSWORD_HASH`, `AWS_ACCESS_KEY`/`AWS_SECRET_KEY`, `GIT_OAUTH_TOKEN`, `JENKINS_API_KEY`), and bucket/registry settings (`CODE_BUCKET`, `DATASET_BUCKET`, `CONTAINER_REGISTRY`).
- **Output:** `~/.sds/config` (YAML), rendered from the `CFG_TMPL` template in `configure.py`. This file is the single source of truth subsequent `sds` commands read. It contains secrets — never commit or paste its contents.

## Known constraints / risks

- **Pinned/aging client libraries.** `elasticsearch&lt;7.14` and `prompt-toolkit&lt;2.0` are hard upper bounds; OpenSearch server compatibility is constrained accordingly. `setuptools &lt;80.0.0` (HC-568) for the Python 3.12 build.
- **Secrets in plaintext config.** `~/.sds/config` holds RabbitMQ/Redis passwords, cloud keys, and OAuth tokens in plaintext. Operator-host hygiene matters.
- **SSH/Fabric blast radius.** A single `sds orch` invocation acts on every PCM host; a bad config or template change propagates cluster-wide.
- **In-flight migrations.** Recent work moves Verdi off the default OPS user and onto Podman (HC-522), enables HTTPS for RabbitMQ reset and Data-in-Transit (HC-530/HC-539), and migrates Kibana → OpenSearch Dashboards (HC-490). Templates and behavior are actively changing across these flags.

## Open questions

- Are the AWS/GCP/Azure cloud adapters all at functional parity, or is AWS the only fully exercised provider? (`sdscli/cloud/` has all three, but real-world use appears AWS-centric.) — should be logged in `open-questions.md`.
- Is the `sdskit` adapter still maintained alongside `hysds`, or effectively legacy?

HANDOFF: wiki-keeper update README index for sdscli
