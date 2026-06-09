# Candidate ADRs

Architectural decisions implied by the current implementation that have not
yet been formally recorded. Use `adr-writer promote candidate adr <id>` to
convert a candidate into a full ADR.

---

## CAND-001: Celery + RabbitMQ for all inter-component communication

**Implied by:** Every component in the PCM layer uses Celery workers consuming
from Mozart's RabbitMQ. There is no HTTP-based inter-component messaging
between PCM nodes (except for GRQ REST API calls from orchestrators).

**Decision to record:** Why Celery/RabbitMQ was chosen as the messaging substrate,
alternatives considered (HTTP, other brokers), and consequences (e.g., all
scaling tied to RabbitMQ health, no pub/sub fanout).

---

## CAND-002: Supervisord as process manager inside EC2 instances

**Implied by:** All four PCM hosts use supervisord (not systemd, not Docker Compose,
not Kubernetes) to manage application-layer processes. Infrastructure services
(OpenSearch, RabbitMQ, Redis, httpd) use systemd.

**Decision to record:** The two-tier process management approach and why supervisord
was chosen for the application layer.

---

## CAND-003: Hardcoded IPs in celeryconfig.py

**Implied by:** `celeryconfig.py` on every host uses hardcoded IP addresses for
all service endpoints. There is no service discovery layer.

**Decision to record:** Why static IPs (vs DNS, vs service discovery) and what
the operational implications are for re-IP events.

---

## CAND-004: msgpack serialization for all Celery tasks

**Implied by:** `task_serializer = "msgpack"` and `result_serializer = "msgpack"`
in `celeryconfig.py`.

**Decision to record:** Why msgpack over JSON (performance? binary payloads?),
and any interoperability constraints this creates.

---

## CAND-005: Three separate OpenSearch instances (not one cluster)

**Implied by:** Mozart, GRQ, and Metrics each have their own standalone OpenSearch
node. They are not federated into a single cluster.

**Decision to record:** Why separate instances vs a shared cluster, and what this
means for cross-node queries (currently done via REST, not cross-cluster search).

---

## CAND-006: Circular runtime dependency between `hysds` and `hysds_commons`

**Implied by:** `hysds_commons` imports `hysds.celery.app` and `hysds.do_submit_job`,
while `hysds`-family components (and `hysds` itself, via `hysds_commons>=0.1`) import
`hysds_commons`. The cycle is resolved only at runtime (`repos/hysds_commons.md`,
`repos/hysds.md`). Already noted as a coupling risk in ADR-001.

**Decision to record:** Whether the circular import is an accepted, deliberate design
(shared Celery app singleton) or a debt to be broken; the import-ordering constraints
it imposes; and why job-submission primitives live in `hysds_commons` rather than `hysds`.

---

## CAND-007: Browser-direct OpenSearch access from hysds_ui

**Implied by:** `hysds_ui` (Tosca/Figaro) issues OpenSearch queries straight from the
browser to `/grq_es` (`grq` index) and `/mozart_es` (`job_status` index) via
ReactiveSearch — there is no server-side API mediating these queries
(`repos/hysds_ui.md`). Access control and query safety depend entirely on the fronting
reverse proxy.

**Decision to record:** Why query access is exposed client-side rather than behind a
REST API, what the trust-boundary assumptions are (proxy auth/allow-listing), and the
security implications of anyone who can reach the UI reaching the raw query endpoints.

---

## CAND-008: SciFlo as Chimera's workflow execution engine

**Implied by:** Chimera's `run_sciflo.py` loads `.sf.xml` DAG workflows and hands them
to SciFlo's engine to drive the PGE three-step pattern; SciFlo's parallel work units
have no self-contained AMQP config and assume a hysds `celeryconfig.py` on the path
(`repos/chimera.md`, `repos/sciflo.md`).

**Decision to record:** Why a separate XML-DAG workflow engine (SciFlo, a legacy
mixed-vintage codebase) underpins Chimera rather than Chimera orchestrating Celery jobs
directly, and the coupling/maintenance implications of the SciFlo→hysds AMQP dependency.
