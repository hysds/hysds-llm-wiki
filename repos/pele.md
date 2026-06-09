# Pele

> REST API for HySDS datasets — central authentication authority (JWT issuer) and PGE/product catalog query service.

**Owner:** hysds-core team  
**Criticality:** P1 — dual role: (1) central auth authority issuing JWTs consumed by all secured HySDS API endpoints; (2) PGE catalog (`job_specs`, `hysds-ios`, `containers` indices) queried by Mozart and Chimera.  
**Language:** Python (>=3.12, per HC-563)  
**Repo:** `hysds-core/pele`  
**Last reviewed:** 2026-06-08

## Architecture diagram

![Pele core architecture](/img/diagrams/pele-core-architecture.svg)

*Source: `pele/pele_core_architecture.drawio.xml` (draw.io), exported to SVG.*

## Role in HySDS

Pele is the Flask-based REST API that serves two distinct functions in the PCM
topology. First, it is the **central authentication authority**: users register,
verify by email, and log in to receive a JWT that all other secured HySDS API
endpoints accept via the `X-API-KEY` header. Second, it is the **PGE / product
catalog query layer**, exposing read APIs over the GRQ OpenSearch indices
(`job_specs`, `hysds-ios`, `containers`, and dataset/product indices) that
Mozart and Chimera consult when resolving job specs and IO templates.

Because both roles are load-bearing for the broader platform — break the JWT
issuer and secured endpoints stop authenticating; break the catalog API and job
orchestration loses its PGE metadata source — Pele is tier P1.

## Deployment model

Pele runs as a **Flask application served by gunicorn** with `gevent`/`eventlet`
async workers, managed under `supervisor` (all three are direct install
requirements in `setup.py`). The app is constructed via the Flask factory
pattern (`create_app`); the WSGI entry point is `app.py` at the repo root.

In a standard PCM deployment Pele sits behind the **Mozart Apache proxy**, which
proxies the `/pele/` path to the Pele API (see
[`dependencies/inventory.md`](../dependencies/inventory.md)).

## Key interfaces

### REST API

Built with `flask-restx` (Swagger/OpenAPI surface). Two controller groups under
`pele/controllers/api_v01/`:

- **Auth API** — `default.py`:
  - `POST /register` — user registration (line 16)
  - `GET /verify` — email verification (line 65)
  - `POST /login` — returns a JWT on success (line 100)
- **PGE / dataset catalog API** — `datasets.py`: queries `job_specs` /
  `hysds-ios` indices in Elasticsearch/OpenSearch via the `QueryES` class in
  `pele/lib/query.py`.

**Auth flow:** user registers → email verification → login returns a JWT
(PyJWT 1.7.1) → clients pass the JWT in the `X-API-KEY` header → the
`@token_required` decorator validates it on protected routes.

**Rate limiting:** `Flask-Limiter` guards the API. The `rich` module was added
as a dependency (HC-596) for Flask-Limiter 4.1.0 compatibility.

### OpenSearch / Elasticsearch indices

Pele is a **reader** of the GRQ-side catalog and product indices; it does not own
them. It queries:

- `job_specs` — PGE job specifications (read by Mozart/Chimera via Pele)
- `hysds-ios` — HySDS IO templates
- `containers` — container/image metadata
- dataset/product indices — for the dataset catalog API

OpenSearch support was added in HC-484; HC-600 added closed-index handling
parameters (`ignore_unavailable` / `allow_no_indices`) to ES/OpenSearch queries.

### User store

A relational user store via **Flask-SQLAlchemy** (SQLite in dev, PostgreSQL in
prod) with **Flask-Migrate** for schema migrations. Passwords are hashed with
**bcrypt** (Flask-Bcrypt). LDAP authentication is also supported via the
`simpleldap` dependency.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| Flask (`&lt;2.3.0`) | runtime | Web framework; pinned `&lt;2.3.0` to work around a Flask-DebugToolbar import error |
| flask-restx (`>=0.5.1`) | runtime | REST resources + Swagger surface |
| gunicorn + gevent + eventlet | runtime | WSGI server with async workers |
| supervisor | runtime/infra | Process management |
| PyJWT (`==1.7.1`) | runtime | JWT issuance/validation for auth |
| Flask-Bcrypt | runtime | Password hashing |
| Flask-SQLAlchemy (`>=3.0.0`) + Flask-Migrate | runtime | User store + migrations (SQLite dev / PostgreSQL prod) |
| Flask-Limiter (`>=1.4`) + rich | runtime | Rate limiting (rich req'd for Flask-Limiter 4.1.0, HC-596) |
| Flask-Caching | runtime | Response/data caching |
| Flask-Cors | runtime | CORS handling |
| Flask-Mail | runtime | Verification emails |
| simpleldap | runtime | LDAP authentication support |
| elasticsearch (`>=7.0.0,&lt;7.14.0`) | runtime | ES client for catalog queries |
| elasticsearch-dsl (`>=7.0.0,&lt;7.4.0`) | runtime | Query DSL helper |
| opensearch-py (`>=2.3.0,&lt;3.0.0`) | runtime | OpenSearch client (HC-484) |
| shapely / pyshp | runtime | Geospatial query support |
| werkzeug (`&lt;3.0.0`) | runtime | Pinned to avoid `url_quote` import breakage |
| GRQ OpenSearch | infra | Backing catalog/product index store (read-only) |
| PostgreSQL | infra | Production user store |

## Configuration

- `pele/settings.py` — `ProductionConfig` / `DevelopmentConfig` classes.
- `settings.cfg` — deployment override (DB URI, secret key, `ES_INDEX`, etc.).
  Never commit secret values; reference their location only.

Key settings: database URI, JWT secret key, and the Elasticsearch/OpenSearch
index name(s) the catalog API targets.

## Known constraints / risks

- **Version pins as workarounds.** `Flask&lt;2.3.0` (Flask-DebugToolbar import
  error) and `werkzeug&lt;3.0.0` (`url_quote` import breakage) are deliberate
  kluges noted in `setup.py`. Upgrading Flask requires resolving both, and
  `Flask-Migrate` may need a coordinated bump in `sdscli` (per inline TODO).
- **Dual-version search clients.** Pele carries both `elasticsearch` (7.x) and
  `opensearch-py` (2.3–3.0) clients in parallel during the OpenSearch migration
  (HC-484); the active client depends on configuration.
- **PyJWT pinned to 1.7.1.** The auth subsystem depends on the pre-2.0 PyJWT
  API; a major upgrade would change `encode`/`decode` return types and signing
  behavior.
- **Single auth authority (P1).** Pele is the JWT issuer for the platform; an
  outage degrades authentication across all secured HySDS API endpoints.

## Open questions

- Which exact OpenSearch index naming scheme (`ES_INDEX`) is canonical across
  deployments for the `hysds-ios` / `job_specs` catalog? (Add to
  `open-questions.md` if unresolved.)
- Is the parallel ES 7.x / OpenSearch client support transitional, and is there
  a target date to drop the `elasticsearch` 7.x client?
