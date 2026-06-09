# Osaka

> Object-Store Abstraction Architecture — a pluggable file-transfer library that moves HySDS product files to/from many backend storage systems, selected by URI scheme.

**Owner:** hysds-core team  
**Criticality:** P1 — Osaka is the data-transfer primitive used by the Verdi/Factotum workers for every stage-in (localizing input data) and stage-out (publishing output products) operation. The dependency inventory records `osaka → S3` as the path for *all* stage-in/stage-out. If Osaka breaks, jobs cannot localize inputs or publish products across the PCM cluster.  
**Language:** Python (>= 3.10; classifiers cover 3.10–3.12)  
**Repo:** `hysds/osaka` (https://github.com/hysds/osaka)  
**Last reviewed:** 2026-06-08

## Architecture diagram

![Osaka core architecture](/img/diagrams/osaka-core-architecture.svg)

*Source: `osaka/.claude/osaka_core_architecture.drawio` (draw.io), exported to SVG.*

## Role in HySDS

Osaka is a thin abstraction layer over heterogeneous object stores. A caller hands it an "Osaka URI" (e.g. `s3://`, `file://`, `https://`, `dav://`, `azure://`, `gs://`) and a local path; Osaka inspects the URI scheme and dispatches to the matching backend handler to `get`, `put`, `rm`, `size`, `list`, or check `exists`. In the PCM topology it sits underneath the job-execution layer: PGE wrappers and the HySDS workers call Osaka to localize inputs before a job runs and to publish/repository outputs after a job completes. It is a library plus a CLI, not a long-running service.

## Deployment model

Osaka is a **Python library and CLI tool**, not a daemon. It installs via `setup.py` (package name `osaka`, current version `1.3.2`) and exposes a console-script entry point:

- `osaka = osaka.__main__:main` — the `osaka` CLI ("Mosura-CLI") with subcommands `get`, `put`, `rm`, `size`, `list`, `exists`, and `gojira`.

It runs wherever HySDS worker code runs — primarily the **Verdi/Factotum worker hosts** — invoked in-process by the job wrapper/PGE code (via `osaka.main.get` / `osaka.main.put`) or shelled out via the CLI. There is no supervisord/systemd process owned by Osaka itself.

## Key interfaces

Osaka has no REST API, no Celery queues, and no OpenSearch indices of its own. Its "interface" is the URI-scheme-to-backend dispatch and the Python/CLI API.

### Python / CLI API

`osaka.main` provides the public functions: `put`, `get`, `transfer`, plus the operations behind the CLI subcommands. Backwards-compatible `put`/`get` wrap `transfer`. Common kwargs include `params` (backend credentials/options), `measure`/`output` (transfer metrics written to `./pge_metrics.json` by default), `lockMetadata`, `retries`, `ncoop` (disable cooperation), and `noclobber`.

### Storage backends (scheme dispatch)

`osaka.base.StorageBase.getStorageBackend(uri)` parses the URI scheme and returns the registered handler from `StorageBase.map` (handlers self-register their schemes via `getSchemes()`). Note a fallback in `base.py`: if no handler matches `http`/`https`, Osaka retries with the other of the two. Backends live under `osaka/storage/`:

| Scheme(s) | Module | Status (per README) |
|-----------|--------|---------------------|
| `file://`, `none` | `file.py` | Push/Pull, tested |
| `s3://`, `s3s://` | `s3.py` | Push/Pull, tested |
| `dav://`, `davs://` | `webdav.py` | Push/Pull, tested |
| `http://`, `https://` | `http.py` | Push/Pull, tested |
| `azure://`, `azures://` | `az.py` | Experimental (contributed by NVG) |
| `gs://` | `gs.py` | Google Cloud Storage |
| `ftp://`, `sftp://` | `ftp.py`, `sftp.py` | Not implemented / needs re-implementation |

### Locking & cooperation

`osaka.lock.Lock` writes an interlock file (`&lt;name>.osaka.locked.json`, template in `lock.py`) tagged with the host FQDN and PID. `osaka.cooperator.Cooperator` lets two concurrent Osaka instances cooperate on the same destination rather than duplicate a transfer — the second instance defers to the primary that holds the lock. Atomicity relies on each backend's `put` being atomic.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `boto3`, `awscli` (botocore) | runtime | S3 backend (`s3.py`): transfers, region detection, credential checks |
| `azure-storage-blob`, `azure-identity` | runtime | Azure Blob backend (`az.py`); `DefaultAzureCredential` |
| `google-cloud-storage` | runtime | Google Cloud Storage backend (`gs.py`) |
| `easywebdav` | runtime | WebDAV backend (`webdav.py`) |
| `requests` (>= 2.31.0) | runtime | HTTP/HTTPS backend (`http.py`) |
| `backoff` | runtime | Retry/backoff on transient transfer failures |
| `future` | runtime | Python 2/3 compatibility shims (legacy; still imported throughout) |
| `moto`, `mock` | runtime (declared in `install_requires`) | S3 mocking used by tests — note these are in `install_requires`, not test extras |
| `pytest`, `pytest-cov` | dev (`extras_require['test']`) | Test suite under `osaka/tests/` |

Dependency edges in `dependencies/inventory.md`: `osaka → S3 (all stage-in/stage-out)`, and the Verdi-worker edges that route through Osaka for input localization and output staging.

## Configuration

Osaka is configured per-call rather than via a central config file. Backend credentials and options are passed through the `params` dict on `get`/`put`/`transfer`. Key behaviors:

- **S3 region detection** (`s3.py`): builds region info via botocore (`get_region_info`), caches per-bucket regions (`region_cache`), and detects a bucket's region using a `head_bucket` approach (`get_bucket_region` / `ensure_correct_region`). Per commits HC-589, dynamic region detection was added then reverted back to the `head_bucket` approach.
- **Transfer metrics**: when `measure=True`, metrics are written to the `output` path (default `./pge_metrics.json`).
- **Lock metadata**: `lockMetadata` is embedded in the `.osaka.locked.json` interlock file alongside host FQDN and PID.

Never commit cloud credentials; they flow through `params` or the ambient AWS/Azure/GCP credential chain (e.g. `DefaultAzureCredential`).

## Known constraints / risks

- **FTP/SFTP/rsync backends are non-functional** — the README marks `ftp://`, `sftp://`, and `rsync://` as not implemented / needing re-implementation. Do not assume these schemes work.
- **`moto` and `mock` ship in `install_requires`** (not just test extras), so test/mocking libraries are pulled into every production install — a packaging smell worth cleaning up.
- **Pinned `requirements.txt` is stale relative to `setup.py`** — the checked-in `requirements.txt` pins old versions (e.g. `boto3==1.11.1`, `awscli==1.17.1`) while `setup.py` requires much newer floors (`boto3>=1.32.0`). The `setup.py` constraints are authoritative for current installs.
- **HTTP download decoding** — HC-624 fixed HTTP downloads that were writing gzip-compressed bytes instead of decoded content; the fix relies on `response.raw.decode_content = True` in `http.py`. Older Osaka versions may still corrupt gzip-encoded HTTP transfers.
- **Cooperation correctness depends on backend `put` atomicity** — the lock/cooperate scheme assumes each backend's `put` is atomic; backends without atomic puts can race.
- **Legacy Python 2/3 `future` shims** remain throughout the codebase despite the Python 3.10+ floor (Python 3.12 compatibility landed in HC-563), adding noise and a maintenance burden.

## Open questions

- Who, if anyone, owns re-implementing the FTP/SFTP backends, or are they slated for removal?
- Should `moto`/`mock` be moved out of `install_requires` into the `test` extra, and is anything in production depending on them being present?
- Is the checked-in `requirements.txt` still used by any build/deploy path, or is it dead relative to `setup.py`?
