# ADR-002: Podman REST API Socket as Container Engine for Verdi Workers

**Status:** Accepted  
**Date:** 2026-06-08  
**Author:** Gerald Manipon (original analysis, 2024-04-17); retro-ADR recorded by wiki

## Context

HySDS `verdi` job-worker containers use the host container engine to spawn PGE/SAS
containers (the NISAR PCM pattern: `verdi` &rarr; `nisar_pcm` &rarr; `l0a_pge`).
This nested-container model requires:

- Bind-mount access to a shared job work directory under `/data/work` (CRUD at every
  nesting level, including across ancestor and descendant containers).
- The host engine socket mounted into each container so a child can spawn its own
  children.
- UID:GID propagation so files written at any level are owned by the same host user
  (`-u UID:GID`).

Docker satisfies all of this through a single root daemon and
`/var/run/docker.sock`. However, **RHEL 8** (and its derivatives: RockyLinux,
AlmaLinux, OracleLinux) **removed Docker** from their distributions. Because
HySDS targets RHEL8-family hosts (e.g. NISAR on Oracle Linux 8), a supported
alternative container engine is required.

Source: HYS Confluence page 2008350721 (Gerald Manipon, 2024-04-17) and
`external/sources/podman-integration-analysis.md` in this repo.

## Decision

Adopt **Podman via the Podman 2.x REST API socket (Design #2)** as the container
engine on RHEL8-family verdi workers.

**Mechanism:**

- Enable the `podman.socket` systemd service. The socket exposes a Docker-API-compatible
  REST endpoint. Containers reference it with `--remote --url unix:&lt;sock&gt;`.
- Use `--userns=keep-id:uid=...,gid=...` plus `--passwd-entry` to propagate the host
  UID:GID into nested containers and to fix the `$HOME` mapping (works around the
  now-resolved podman issue #13185 where `--userns=keep-id` overwrote `--workdir`
  as HOME).

**Deployment sub-options (both valid):**

| Sub-option | Socket path | Image storage | Notes |
|------------|-------------|---------------|-------|
| Root socket | `/run/podman/podman.sock` (chmod 777) | `/var/lib/containers` | Global image cache; simpler multi-user exec |
| Per-user socket | `$XDG_RUNTIME_DIR/podman/podman.sock` (loginctl linger) | `$HOME/.local/share/containers` | Stronger isolation; one user cannot exec into another's container |

The choice between sub-options is a deployment/ops decision and is left to the
platform operator. The open question of whether `verdi` itself should also run under
the root socket is tracked separately (see open-questions.md).

Verified on Oracle Linux 8: 3-level nesting (`verdi` &rarr; `pge-base:9999` &rarr;
`pge-base`) correctly CRUDs the shared `/data/work` directory at every level.

Implementation is tracked as **HC-522**. Ops runbook: HYS Confluence page 2368995330
("Adding Support for Podman").

## Consequences

### Positive

- HySDS verdi workers become deployable on RHEL8-family hosts where Docker is absent.
- The Podman REST API socket is Docker-API-compatible; existing tooling using the
  Docker socket protocol requires minimal changes.
- Nested-container UID:GID propagation and shared `/data/work` bind mounts are
  confirmed working.
- Root-socket deployment gives a global image cache, eliminating redundant image
  pulls across users.

### Negative / trade-offs

- Per-user image storage (`$HOME/.local/share/containers`) is the Podman default;
  a global cache requires explicit `/etc/containers/storage.conf` configuration.
- With per-user sockets, a user cannot easily `exec` into a container owned by
  another user — complicates operator debugging.
- `--userns=keep-id` + `--passwd-entry` flag usage is non-obvious; future developers
  must understand why these flags are required (documented in ops runbook).
- Root-socket deployment (`chmod 777` on the socket) grants any local user the ability
  to manage all containers — acceptable for single-tenant verdi VMs, but a wider
  attack surface on multi-tenant hosts.
- Does not resolve the open question of whether `verdi` itself should run under the
  root socket vs. its own user socket.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| **Design #1 — PINP (Podman-in-Podman)** | Each child container re-downloads the full image every invocation (no shared cache). Requires reconciling subuid/subgid across parent, child, and host for every nesting level. Viability for 3-level nesting was uncertain; deviates significantly from the Docker design. Rejected in favor of the socket approach. |
| **Stay on Docker** | Not available on RHEL 8 and derivatives. Not viable for NISAR/Oracle Linux 8 target environments. |
| **`alias docker=podman` (drop-in replacement)** | Option semantics differ between Docker and Podman CLI for the nested-container case (socket mounting, UID namespaces). Does not satisfy the nested-container requirements without the REST API socket. |

## Related

- `repos/sdscli.md` — In-flight migrations section; HC-522 Podman migration tracked there.
- `repos/hysds.md` — Container factory / verdi worker; this decision directly affects
  how verdi spawns PGE containers.
- HYS Confluence page 2008350721 — Original design analysis (Gerald Manipon, 2024-04-17).
- HYS Confluence page 2368995330 — "Adding Support for Podman" ops runbook.
- HYS Confluence page 1972895745 — Companion deep-dive (Dustin Lo).
- `external/sources/podman-integration-analysis.md` — Local source file for this ADR.
