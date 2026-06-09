# prov_es

> PROV-ES (Provenance for Earth Science) Python library — a thin wrapper over the W3C PROV reference implementation that builds Earth-Science-flavored provenance documents.

**Owner:** hysds-core team  
**Criticality:** P1 — shared provenance library used by chimera (`PgeJobSubmitter` writes provenance records) and HySDS worker components; a break here propagates into every PGE run's provenance metadata.  
**Language:** Python (>=3.12)  
**Repo:** `hysds/prov_es` — https://github.com/hysds/prov_es  
**Last reviewed:** 2026-06-08

## Role in HySDS

`prov_es` provides `ProvEsDocument`, a subclass of `prov.model.ProvDocument`
that adds convenience constructors for Earth Science provenance concepts —
collections, datasets, granules, products, files, platforms, instruments,
sensors, software, algorithms, documents, runtime contexts, and process
steps. It encodes the PROV-ES profile: a set of namespaces (`hysds`, `eos`,
`gcis`, `info`, `bibo`, `dcterms`) layered on top of the W3C PROV-DM data
model.

In the PCM topology this is a **library**, not a service. Worker-side
components (notably chimera's `PgeJobSubmitter`) import it to emit provenance
records describing what software ran, with what inputs, producing what
outputs, at what time. Those records become part of the dataset metadata
flowing into GRQ/OpenSearch.

## Deployment model

Installed as a Python package (`pip install prov_es`, also conda-installable
per HC-431). There is **no standalone service, no Dockerfile, no entry
point** — it is imported in-process by whatever component needs to build a
provenance document. It runs wherever its consumers run (Verdi worker hosts,
chimera).

## Key interfaces

This is a pure library; there is no REST API, no Celery queue, and no
OpenSearch index owned by this repo.

### Public API (`prov_es.model.ProvEsDocument`)

`ProvEsDocument` extends `ProvDocument` and exposes typed builder methods.
Each returns a PROV entity/agent/activity and accepts an optional `bundle`
to target a PROV bundle instead of the root document.

| Method | PROV kind | `prov:type` |
|--------|-----------|-------------|
| `collection(...)` | entity | `eos:collection` |
| `dataset(...)` | entity | `eos:dataset` (default) |
| `granule(...)` | entity | `eos:granule` |
| `product(...)` | entity | `eos:product` |
| `file(...)` | entity | `eos:file` |
| `platform(...)` | entity | `eos:platform` |
| `instrument(...)` | entity | `eos:instrument` |
| `sensor(...)` | entity | `eos:sensor` |
| `software(...)` | entity | `eos:software` |
| `algorithm(...)` | entity | `eos:algorithm` |
| `document(...)` | entity | `bibo:Document` |
| `runtimeContext(...)` | entity | `eos:runtimeContext` |
| `softwareAgent(...)` | agent | `prov:SoftwareAgent` |
| `governingOrganization(...)` | agent | `prov:Organization` |
| `processStep(...)` | activity | `eos:processStep` (default) |

Notable behaviors:
- `processStep(...)` also emits `used` / `wasGeneratedBy` / `wasAssociatedWith`
  relations. `used` edges are only emitted when `start_time` is provided;
  `wasGeneratedBy` edges only when `end_time` is provided.
- Relation identifiers are generated deterministically via
  `get_uuid(s)` → `uuid.uuid5(uuid.NAMESPACE_OID, str(s))`, so the same
  inputs produce stable relation IDs.
- `governingOrganization(...)` deduplicates organization agents within a
  document via the `prov_es_orgs` dict.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `prov==1.3.1` | runtime | W3C PROV reference implementation; `ProvEsDocument` subclasses its `ProvDocument`. Pinned exactly. |
| `future>=0.17.1` | runtime (declared) | Python 2/3 compat shim. **Declared in `setup.py` but not imported anywhere in source** — see Known constraints. |

Serialization (PROV-JSON, etc.) is provided by the upstream `prov` library.

## Configuration

No config files. The PROV-ES namespaces are hard-coded in
`prov_es/constants.py`:

| Prefix | URI |
|--------|-----|
| `hysds` | `http://hysds.domain.com/hysds/0.1#` |
| `eos` | `http://nasa.gov/eos.owl#` |
| `gcis` | `http://data.globalchange.gov/gcis.owl#` |
| `info` | `http://info-uri.info/` |
| `bibo` | `http://purl.org/ontology/bibo/` |
| `dcterms` | `http://purl.org/dc/terms/` |

`ProvEsDocument.__init__` injects these namespaces by default and merges any
caller-supplied `namespaces` (dict or list) on top.

## Known constraints / risks

- **`future` dependency mismatch.** `README.md` and `CHANGELOG.md` claim the
  `future` package was removed for the Python 3.12+ version, but `setup.py`
  (and the generated `prov_es.egg-info/requires.txt`) still list
  `future&gt;=0.17.1`. No module under `prov_es/` imports `future`. The
  declared dependency is therefore stale and should be dropped to match the
  documented intent.
- **Hard pin on `prov==1.3.1`.** The upstream PROV implementation is pinned
  to an exact version. Any consumer that also depends on a different `prov`
  version will conflict; upgrading `prov` requires re-validating PROV-JSON
  output.
- **Namespace URIs are placeholders.** The `hysds` namespace resolves to
  `http://hysds.domain.com/...`, a non-real domain. These URIs are
  identifiers, not dereferenceable endpoints; do not treat them as live.
- **Tiny surface, wide blast radius.** Only three source files
  (`__init__.py`, `constants.py`, `model.py`), but as a P1 shared library a
  signature change to any builder method ripples into chimera and worker
  provenance emission.

## Open questions

- Has the `future` dependency removal been completed in packaging, or is the
  `setup.py` entry an oversight to be cleaned up? (Track in `open-questions.md`.)
- Confirm the exhaustive list of downstream consumers beyond chimera's
  `PgeJobSubmitter` and HySDS workers (dependency-mapper to verify edges in
  `dependencies/inventory.md`, which currently has no `prov_es` entry).
