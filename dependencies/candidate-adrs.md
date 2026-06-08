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
