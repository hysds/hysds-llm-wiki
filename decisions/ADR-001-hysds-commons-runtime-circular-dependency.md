# ADR-001: hysds_commons Runtime Circular Dependency on hysds

**Status:** Accepted  
**Date:** 2026-06-08  
**Author:** Sujen Shah

## Context

`hysds_commons` (v2.3.0) is a shared library consumed by Mozart, chimera, and
other HySDS components. It provides job-submission helpers, OpenSearch/ES
client wrappers, and schema validation utilities that multiple packages depend
on. In its current form, `hysds_commons/job_utils.py` and
`hysds_commons/mozart_utils.py` both execute `from hysds.celery import app` at
module import time.

This creates a **runtime circular dependency**: `hysds_commons` imports from
`hysds` at import time, while `hysds` itself depends on `hysds_commons` for
job submission utilities. The consequence is that `hysds_commons` cannot be
installed, imported, or unit-tested independently of the full `hysds` package.
Any environment that needs only the shared helpers (e.g., a chimera test suite,
a Mozart integration test) must also carry the full `hysds` Celery application
as a transitive install.

The circular dependency was confirmed via direct code read of
`hysds_commons/job_utils.py`, `hysds_commons/mozart_utils.py`, and
`setup.py`.

## Decision

Document the circular dependency as a known architectural constraint and accept
it as the current state. No structural refactor is undertaken at this time. The
dependency is recorded here so that:

1. Future contributors do not inadvertently add more top-level imports from
   `hysds` into `hysds_commons`.
2. Any test harness targeting `hysds_commons` in isolation must mock or stub
   the `hysds.celery` import.
3. A future breaking-change release of `hysds_commons` should treat removal of
   the `hysds` import as a first-class goal (see Alternatives).

## Consequences

### Positive
- No immediate code churn required; existing deployments continue unaffected.
- The constraint is now explicit and indexed, preventing silent spread.
- Downstream teams (chimera, Mozart) have documented guidance on how to work
  around the issue in test environments.

### Negative / trade-offs
- `hysds_commons` cannot be installed or tested without pulling in the full
  `hysds` Celery application, increasing test environment weight.
- The shared library cannot serve as a truly independent utility package until
  the import is resolved.
- Any future consumer that wants only the OpenSearch helpers or schema
  validation still drags in `hysds` as a transitive dependency.
- Risk of the circular import silently expanding if `hysds_commons` grows new
  modules that follow the same pattern.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| **Lazy import** — move `from hysds.celery import app` inside the functions that need it, eliminating the top-level import cycle | Correct long-term fix, but requires audit of every call-site in `job_utils.py` and `mozart_utils.py` and coordinated testing across Mozart and chimera. Deferred to a dedicated refactor effort. |
| **Extract a `hysds_commons_core` sub-package** — split the Celery-independent helpers (OpenSearch client, schema validation) into a new package with no `hysds` dependency | Cleanest architectural outcome; rejected for now because it requires versioning coordination across all eight dependent repos simultaneously. |
| **Pin and isolate via a compatibility shim** — introduce a thin `hysds_celery` stub package that satisfies the import without the full `hysds` install | Adds a third package to maintain; not worth the overhead when a lazy-import fix is simpler. |

## Related

- Affected repos: `wiki/repos/` entries for `hysds` and `hysds_commons` (once
  authored)
- Open question: whether the lazy-import refactor should be bundled with the
  next `hysds_commons` minor release — see `open-questions.md`
