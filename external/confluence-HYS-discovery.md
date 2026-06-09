# HYS Confluence Space — Discovery Notes

> Read-only discovery of the **HySDS-Core** Confluence space (key `HYS`, space id
> `163841`, homepage `163842`), captured 2026-06-08 via the Atlassian MCP.
> Site: https://hysds-core.atlassian.net/wiki/spaces/HYS
> cloudId: `1c279d62-9dda-44dd-90b1-ba189a01ea8b`

This is the **human-authored** wiki. Our `repos/`, `decisions/`, `dependencies/`
content is the **code-derived** wiki. Goal: keep them coherent, mine the human
wiki for knowledge that code can't yield, and (optionally) auto-refresh stale
human pages.

## Shape of the space

- Created 2018; bulk-migrated from the old GitHub wiki in **Aug 2020** (most legacy
  pages authored by Kate Sammons during that migration).
- ~200+ pages. Heavy use of a **confidence-level banner** convention on each page:
  - `:gauge_high:` High — SME-reviewed and signed off
  - `:gauge_medium:` Moderate — multiple contributors
  - `:gauge_low:` / TBD — "not been reviewed for accuracy, timeliness, or completeness"
  - Most legacy pages are **TBD/low** — an explicit, machine-detectable staleness signal.
- Labels in use: `review_for_redundancy`, `content_updated_2019`, `unfinished`,
  `in_progress`, `testing`, `create_content`, `grq`, etc.

## Content classification

| Category | Examples (page id) | Notes |
|----------|--------------------|-------|
| **Onboarding / intro** | Welcome to the HySDS Wiki (163842, v58, 2024), Beginner's Guide to HySDS (628523009), Acronyms (943947781) | Welcome page is actively maintained (v58) |
| **Architecture / design (big docs)** | Software Design Document SDD (199786902, 93 KB), SWOT SDD (175276123, 111 KB), Components (199786662), Developer Documentation (199819868) | The two SDDs are the largest knowledge artifacts in the space |
| **Decision / rationale — the "gold"** | Analysis of Podman Integration into HySDS core (2008350721, 2024), Adding Support for Podman (2368995330, 2024), Authentication & Authorization A&A (1360232449 — "thought process and planning"), Decision Blueprint (199885706), Community Roadmap (199787606) | Not derivable from source; tradeoff analyses + planning context |
| **Incident / postmortem** | Checksum Mismatch Issue (3016163330, **Aug 2025** — SWOT bulk-reprocessing dual-publish race), Customizing Rollover of old jobs in Mozart (2050686977, 2023) | Recent, high-value operational knowledge |
| **Operational runbooks / how-to** | Add New Queue for Workers on Factotum (1208090629), Create Auto-Scaling Fleet Queue (506232943), Deploy PGE's onto Cluster (455114757), Create/Edit/Delete Trigger Rules (442728660), Cluster Setup (199820699) | Operator procedures, SSH/config-level |
| **Kibana / dashboards** | Change/Clone/Create/Delete Visualization & Dashboard (1713701010, 1713766519, 1713766468, 1713766492) | All TBD confidence, 2021 |
| **Cloud guides** | Amazon Web Services Guide (346456069, High conf), AWS (200376342), Azure (200376463), CloudWatch custom metrics (200441915) | AWS = High; Azure = TBD/stub (matches our sdscli open question on cloud parity) |
| **Scaling test campaigns (historical)** | Death Valley Torture Tests 2016 (199885540), HySDS v2 1M dumby-landsat 2016 (199852624), 2018 bulk reprocessing 50Gbps trinity (199787394), Optimizing System Resources for Death Valley conditions (199787420, 58 KB) | Real scaling/throughput numbers; partly historical but the tuning doc is gold |
| **Meeting notes** | 2019-04-08 / 04-19 / 05-16 (199852773, 199885685, 199820358) | Stale; archival |

## Overlap with our code-wiki repos

| Code-wiki repo | HYS human pages covering it |
|----------------|------------------------------|
| chimera | Chimera (545914885), Chimera Config File (564396573), Chimera Constants File (678166997), Adaptation Files (564396533), Add Chimera Configuration File (675742611), Developer's Guide (675873331) — adaptation-focused |
| grq2 | Dataset Catalog GRQ (200507537) — stub, "more info coming soon" |
| mozart | Customizing Rollover (2050686977), Mozart Watchdog Notifications (199787667) |
| sciflo | Referenced under Chimera / Components; no standalone deep page seen |
| osaka | Checksum Mismatch Issue (publishing), Developer Documentation listing |
| prov_es | Listed in Developer Documentation only |
| pele | Components listing only |
| sdscli | Implied across Cluster Setup / `~/.sds/config` runbooks |
| hysds_ui | Figaro Actions (199788125), Kibana dashboard guides |
| hysds_commons | Create STAC Documents for HySDS Datasets (2025717765) — stac_utils |
| hysds | SDD, Components, Developer Documentation |

## Key takeaways

1. **Complementary, not duplicative.** The human wiki is operator/onboarding/rationale
   heavy; our code wiki is structural/dependency/decision heavy. Little literal overlap.
2. **The "gold" to pull into our wiki**: Podman analysis, A&A planning, Checksum Mismatch
   postmortem, Death Valley tuning + scaling numbers, the two SDDs, Community Roadmap.
   These become inputs for `feature-analyst`, `adr-writer` (retro-ADRs), and `risks/`.
3. **Staleness is machine-detectable** via the confidence banner + `lastModified` +
   `review_for_redundancy` label — a good filter for "auto-regenerate human docs."
4. **Confirms two of our open questions**: AWS-vs-Azure/GCP cloud parity (Azure page is a
   stub), and the broad adaptation/config surface of Chimera.

## Crawl limitation

`getPagesInConfluenceSpace` returns full page bodies (atlas_doc_format) and overflows /
times out at limit>=25. `searchConfluenceUsingCql` is the lighter path (summary + metadata)
but its cursor wasn't advancing via this MCP's `next` flag. A full title dump should page
the v2 pages API with a body-format=none equivalent or fetch specific page bodies by id.
