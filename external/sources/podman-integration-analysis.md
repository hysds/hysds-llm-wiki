# SOURCE: Analysis of Podman Integration into HySDS core

> Verbatim-derived summary of HYS Confluence page **2008350721** (author: Gerald
> Manipon, last modified 2024-04-17). Captured for ADR grounding. Original:
> https://hysds-core.atlassian.net/wiki/spaces/HYS/pages/2008350721

## Problem / driver

HySDS uses **Docker** as the default container engine for the `verdi` job-worker
container and the job/PGE containers it spawns. **RHEL 8** (and RockyLinux,
AlmaLinux, OracleLinux) **removed Docker**, replacing it with **Podman**. HySDS
needs an alternative container engine to remain deployable on RHEL8-family hosts.

## Core requirement (HySDS nested-container use case, from NISAR)

The `verdi` container talks to the host engine to spawn a `nisar_pcm` container,
which in turn spawns a SAS/PGE container (e.g. `l0a_pge`) — all sharing the job
work directory under `/data/work`. So the engine must support:

- a container can CRUD files/dirs on the host (`-v` bind mount)
- a container (parent) can run another container (child) — via mounting the
  engine socket into the container
- a container can CRUD files created by ancestor AND descendant containers
- UID:GID of the host user is propagated into every container (`-u UID:GID`)

Docker satisfies this because all ops go through a single root daemon and the
`/var/run/docker.sock` is mounted into each container.

## The Podman complication

Podman is **daemonless and rootless by default**, using **Linux user namespaces**
(subuid/subgid) to isolate processes per user. `alias docker=podman` breaks down
for the nested-container case: option semantics differ, and images are stored
per-user (`$HOME/.local/share/containers`) instead of globally (`/var/lib/docker`).

## Two designs considered

**Design #1 — PINP (Podman-in-Podman).** Each podman container downloads the image
it runs (every time, even for the same image), and you must reconcile each
container's subuid/subgid against its parent and child plus host mounts. Deviates
significantly from the Docker design; viability uncertain; more investigation needed.

**Design #2 — Podman REST API socket (RECOMMENDED).** Enable the `podman.socket`
systemd service (Podman 2.x API, Docker-API-compatible) so a podman daemon-like
socket runs at boot. Containers talk to it via `--remote --url unix:<sock>`. Two
sub-options: run the socket as **root** (`systemctl enable --now podman`, then
`chmod 777` the sock so all users can use it) — images land in `/var/lib/containers`;
or **per-user** (`loginctl enable-linger`, `systemctl --user enable podman.socket`)
— images stay in `$HOME/.local/share/containers`. Verified on Oracle Linux 8 VM:
3-level nested containers (verdi → pge-base 9999 → pge-base) all CRUD the shared
`/data/work` job dir correctly using `--userns=keep-id:uid=...,gid=...` plus
`--passwd-entry` to fix $HOME.

## Outstanding issues noted

- podman issue #13185 (`--userns=keep-id` overwriting `--workdir` as HOME) —
  resolved; now handled with `--passwd-entry`.
- Open question: should `verdi` itself also run under the root socket?
- Per-user image storage means one user can't easily `exec` into another's
  container; global image cache needs `/etc/containers/storage.conf` changes.

## Relationship to our wiki

This is the rationale behind the Podman work tracked as HC-522 (referenced in
`repos/sdscli.md` "In-flight migrations") and the "Adding Support for Podman"
ops guide (HYS page 2368995330). Companion deep-dive: Dustin Lo's writeup
(HYS page 1972895745).
