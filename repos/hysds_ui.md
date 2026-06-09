# hysds_ui

> React single-page web application that is the primary user-facing GUI for a HySDS cluster — dataset/product discovery (Tosca), job monitoring (Figaro), on-demand job submission, and user-rule management.

**Owner:** hysds-core team (Confirmed)
**Criticality:** P1 — primary user-facing web interface for the entire HySDS cluster; without it operators and scientists have no GUI for job monitoring, data discovery, or on-demand job submission (Confirmed)
**Language:** JavaScript (React 16.9 / JSX)
**Repo:** `hysds/hysds_ui`
**Last reviewed:** 2026-06-08

## Architecture diagram

![hysds_ui core architecture](/img/diagrams/hysds_ui-core-architecture.svg)

*Source: `hysds_ui/hysds_ui_core_architecture.drawio.xml` (draw.io), exported to SVG.*

## Role in HySDS

`hysds_ui` is the client-side, browser-based GUI for the HySDS PCM. It is a
React single-page application (SPA) that gives operators and scientists a
graphical front-end over the data and job catalogs that other PCM components
maintain. It owns no server-side application logic and persists no data of its
own — it is a presentation layer that issues OpenSearch queries and REST calls
directly from the browser to existing backend services (grq2/GRQ, mozart, pele).

The app exposes two main product views:

- **Tosca** — the dataset/product catalog, backed by the GRQ OpenSearch index (`grq`).
- **Figaro** — the job-status catalog, backed by the Mozart OpenSearch index (`job_status`).

Each view additionally provides on-demand job submission, a user-rule editor,
and a user-rule list (see Key interfaces).

## Deployment model

Two-stage Docker build (`Dockerfile`):

1. **Build stage** (`node:13`): runs `npm install` then `npm run build`
   (`webpack --mode production`), emitting static assets to `dist/`.
2. **Serve stage** (`nginx:1.13.12-alpine`): copies `dist/` to
   `/usr/share/nginx/html` and `nginx.conf` to the default conf, exposing
   port 80.

In production the compiled SPA is served as static files by Nginx. `nginx.conf`
uses `try_files $uri /index.html` so client-side routing (React Router) resolves
deep links to the SPA. The app is served under the `ROOT_PATH` `/hysds_ui/` by
default. Note: backend service paths (`/grq`, `/mozart`, `/grq_es`,
`/mozart_es`, `/metrics`) are configured as relative paths and are expected to
be reverse-proxied to the backend services by a fronting proxy (the Mozart
Apache proxy proxies `/grq/`, `/pele/`, and `/metrics/` per the dependency
inventory); `nginx.conf` in this repo does not itself define those proxy passes.

For local development, `npm start` runs `webpack-dev-server` (`--mode
development`) and `npm run prod` runs the dev server in production mode. A
`run-with-legacy-openssl.sh` helper exists to accommodate the older Webpack 4 /
Node toolchain on modern Node (OpenSSL legacy provider).

## Key interfaces

`hysds_ui` is a pure client; all interfaces below are **outbound** calls made
from the browser. Endpoints are defined in `src/config/index.js` (generated
from `src/config/index.template.js`). Production defaults use relative paths
resolved by the fronting proxy.

### OpenSearch (queried directly from the browser via ReactiveSearch)

| Config key | Default (prod) | Index | Backed by |
|------------|----------------|-------|-----------|
| `GRQ_ES_URL` / `GRQ_ES_INDICES` | `/grq_es` / `grq` | `grq` | grq2 (GRQ OpenSearch product catalog) |
| `MOZART_ES_URL` / `MOZART_ES_INDICES` | `/mozart_es` / `job_status` | `job_status` | mozart (job-status OpenSearch) |

ReactiveSearch components (e.g. `SidebarFilters`, `DataTable`,
`ToscaResultsList`, `FigaroResultsList`, `ReactiveMap`) build and send
OpenSearch queries directly from the browser to these endpoints. Tosca queries
the `grq` index; Figaro queries the `job_status` index.

### REST APIs (action calls)

| Config key | Default (prod) | Service | Used for |
|------------|----------------|---------|----------|
| `GRQ_REST_API_V1` / `_V2` | `/grq/api/v0.1`, `/grq/api/v0.2` | grq2 | GRQ REST operations |
| `MOZART_REST_API_V1` / `_V2` | `/mozart/api/v0.1`, `/mozart/api/v0.2` | mozart | Job submission, user-rule CRUD |
| `MOZART_BASE_URL` | `""` | mozart | Viewing Verdi job worker logs |
| `METRICS_URL` / `KIBANA_URL` | `/metrics`, `/metrics/app/kibana` | Metrics OpenSearch Dashboards | Metrics/Kibana links |

Action flows (on-demand job submission, user-rule create/update/delete) issue
HTTP requests to the Mozart REST API (and pele, per the grounded data-flow
notes). The local-development config (`index.local-development.template.js`)
points these at `http://localhost:8888` (Mozart REST), `http://localhost:9200`
(GRQ ES), and `http://localhost:9998` (Mozart ES).

### Pages

`src/pages/`: `Tosca`, `Figaro`, `ToscaOnDemand`, `FigaroOnDemand`,
`ToscaRuleEditor`, `FigaroRuleEditor`, `ToscaUserRules`, `FigaroUserRules`,
`MetadataViewer`, `NotFound`, and `Routes` (React Router client-side routing).

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| react / react-dom 16.9.0 | runtime | UI component framework |
| @appbaseio/reactivesearch 3.2.4 | runtime (dev-listed) | OpenSearch-backed search/filter/result components |
| react-router-dom 5.1.0 | runtime (dev-listed) | Client-side routing |
| redux / react-redux | runtime | Global state (theme dark/light, etc.) via `src/redux/` |
| leaflet 1.4.0 / leaflet-draw 1.0.4 | runtime (dev-listed) | Geospatial map + draw (`ReactiveMap`) |
| react-table 6.10.3 | runtime (dev-listed) | Tabular result display (`DataTable`) |
| react-select 2.4.4 | runtime (dev-listed) | Dropdown/select inputs |
| react-json-view 1.19.1 | runtime | Metadata / JSON viewers (`ToscaDataViewer`, `FigaroDataViewer`) |
| react-helmet 5.2.1 | runtime | Document head management |
| @fortawesome/* | runtime | Icons |
| webpack 4.41.0 + babel | dev | Build / bundling |
| webpack-dev-server | dev | Local dev server |
| Nginx 1.13.12-alpine | infra | Production static file server |
| Node 13 | infra (build) | Build-stage image |
| grq2 / GRQ OpenSearch (`grq` index) | infra (backend) | Tosca data source + GRQ REST |
| mozart OpenSearch (`job_status`) + REST | infra (backend) | Figaro data source, job submit, rule CRUD |
| pele | infra (backend) | Action-call target (per grounded data-flow notes) |

Note: `package.json` lists several runtime libraries (ReactiveSearch, React
Router, Leaflet, react-table, react-select, prop-types) under `devDependencies`
rather than `dependencies` — they are bundled by Webpack at build time, so the
distinction has no runtime effect for this statically-served SPA.

## Configuration

Config lives in `src/config/`, generated from `*.template.js` templates (the
real `index.js`, `tosca.js`, `figaro.js` are gitignored and created per
deployment):

- **`index.js`** (from `index.template.js`) — all backend endpoints (GRQ/Mozart
  OpenSearch URLs + indices, GRQ/Mozart REST API bases, metrics/Kibana URLs),
  plus:
  - `VENUE` — deployment name shown in the top banner (templated as `{{ VENUE }}`).
  - `CONFIRMATION_THRESHOLD` — default `1000`; bulk actions prompt for
    confirmation only when the result count exceeds this (added in HC-101).
  - `ROOT_PATH` — app mount path, default `/hysds_ui/` (set to `/` for local dev).
  - `RABBIT_MQ_PORT` — default `15673`.
  - `LOCAL_DEV` — toggles local-development behavior.
- **`tosca.js`** (from `tosca.template.js`) and **`figaro.js`** (from
  `figaro.template.js`) — per-view customization: sidebar filters (`FILTERS`),
  the `QUERY_LOGIC` map, OpenSearch fields returned, and table columns. Per the
  README, any new sidebar filter's `componentId` must be added to **both**
  `FILTERS` and `QUERY_LOGIC`.

Key components: `HeaderBar`, `SidebarFilters`, `DataTable`, `ReactiveMap`,
`ToscaResultsList`, `FigaroResultsList`, `ToscaDataViewer`, `FigaroDataViewer`,
`JobCountsBanner`, `UserRulesTable`, `QueryEditor`, `ConfirmationModal`,
`IdQueryHandler` (under `src/components/`).

Never commit real config values — the deployment-specific `index.js`/`tosca.js`/
`figaro.js` are intentionally gitignored.

## Known constraints / risks

- **Browser talks to OpenSearch directly.** ReactiveSearch issues OpenSearch
  queries straight from the client to `grq_es` / `mozart_es`. Access control and
  query safety depend entirely on the fronting reverse proxy; the SPA cannot
  enforce them. Anyone who can reach the UI can reach the query endpoints it is
  configured with.
- **Closed-index handling.** Recent fixes (HC-600 `ignore_unavailable=true`,
  HC-610 correct data count when indices are closed) indicate result counts and
  queries previously broke against closed OpenSearch indices — relevant when
  consuming time-partitioned / rolled-over indices.
- **Bulk-action safety.** HC-101 added the `CONFIRMATION_THRESHOLD` gate so bulk
  operations only prompt above a configurable count (default 1000); tuning this
  too high removes a guardrail against accidental large operations.
- **Aging build toolchain.** Webpack 4 + Node 13 build stage requires the
  `run-with-legacy-openssl.sh` workaround on modern Node (OpenSSL legacy
  provider). Upgrading the toolchain is a known latent maintenance cost.
- **Config is deployment-coupled and gitignored.** A misconfigured `index.js`
  (wrong ES URL, wrong index alias, wrong `ROOT_PATH`) silently breaks views;
  there is no server-side validation.

## Open questions

- Does the production deployment proxy `/grq_es` and `/mozart_es` with any
  query allow-listing / auth, or is raw OpenSearch query access exposed to the
  browser? (Should be logged in `open-questions.md`.)
- Confirm the exact pele endpoints invoked by action flows — grounded notes
  state action calls go to "mozart REST API and pele," but specific pele routes
  were not located in this pass.
- Where is `VENUE` substituted (build-time templating vs. deploy-time) for
  production images?
