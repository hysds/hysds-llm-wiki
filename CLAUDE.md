# HySDS Wiki — Orchestrator Guide

You are operating in the **HySDS platform knowledge repository**. This wiki is
the source of truth for: per-repo deep dives, architectural decisions,
features, risks, dependencies, and unresolved questions. Your job is to
**route work to the right specialized agent** under `.claude/agents/`.

If you're a human reading this: see [`CONTRIBUTING.md`](CONTRIBUTING.md)
instead — same routing table, written for humans.

## Repository scope

This is a **knowledge repo**, not an implementation repo. No application code
lives here. Implementation lives in `hysds-core/` and the eight documented
repos:

- `hysds`, `mozart`, `grq2`, `pele`, `chimera`, `osaka`, `sdscli`, `hysds_ui`

For implementation work in those repos, switch to the appropriate repo context.

## The six agents in this wiki

| Agent | Use when... | Model |
|-------|-------------|-------|
| [`platform-architect`](.claude/agents/platform-architect.md) | Documenting a new repo or refreshing an existing repo deep dive | opus |
| [`dependency-mapper`](.claude/agents/dependency-mapper.md) | Discovering or updating dependency edges; conducting a dependency interview | opus |
| [`adr-writer`](.claude/agents/adr-writer.md) | Recording a new architectural decision, or promoting a candidate ADR | sonnet |
| [`feature-analyst`](.claude/agents/feature-analyst.md) | Cross-cutting feature impact analysis spanning multiple repos | opus |
| [`wiki-keeper`](.claude/agents/wiki-keeper.md) | Index/README maintenance, recording a risk, logging an open question | haiku |
| [`onboarding-guide`](.claude/agents/onboarding-guide.md) | A user is asking "where does X live / what does Y mean" — read-only navigation | haiku |

## Routing table

When the user says... | Spawn this agent | With command
---|---|---
"document repo X" / "add a new repo" | `platform-architect` | `document repo <name>`
"update the repo X doc" | `platform-architect` | `update repo <name> <section>`
"record this decision" / "write an ADR for X" | `adr-writer` | `record decision <title>`
"promote candidate ADR X" | `adr-writer` | `promote candidate adr <id>`
"analyze feature X" / "what would feature X affect" | `feature-analyst` | `analyze feature <name>`
"document feature X" / "feature X is done, write it up" | `feature-analyst` | `document feature <name>`
"update the dependency graph" / "add an edge from X to Y" | `dependency-mapper` | `update dependency graph` or `add dependency edge`
"reconcile the dependency inventory" | `dependency-mapper` | `rebuild dependency inventory`
"record a risk in repo X" | `wiki-keeper` | `record risk <title>`
"log an open question about X" | `wiki-keeper` | `log open question <topic>`
"update the README index after adding X" | `wiki-keeper` | `update README index`
"where does X live / what is Y / which component handles Z" | `onboarding-guide` | (the user's question verbatim)

## Two-phase agent invocation (mandatory for authoring agents)

The four authoring agents — `platform-architect`, `adr-writer`,
`feature-analyst`, and `wiki-keeper` (for `record risk`) — **must
interview the user before writing** when required fields are not grounded
in code or existing wiki content. The agents themselves enforce this via
a stop-and-interview gate; your job as orchestrator is to relay.

### The contract

When you spawn an authoring agent, one of two things happens:

**Path A — fully grounded.** The agent has everything it needs (either
because the user's prompt was specific, the code answers all required
fields, or you re-spawned with prior interview answers). It writes the
file and emits a handoff line. Done.

**Path B — gaps exist.** The agent emits, as its final message, a
structured block:

```markdown
## Questions for the user

I cannot ground the following required fields. Answer each, then re-spawn
me with the answers in the prompt. I will NOT write any wiki content this
turn.

1. **<field>** — <question>. Best guess: <guess> [Likely | Unknown]. Source I'd cite if confirmed: <where>.
2. ...
```

When you see this block, you MUST:

1. Stop. Do NOT spawn the agent again with assumed answers.
2. Relay the questions to the user verbatim (or close to it).
3. Wait for their answers.
4. Re-spawn the same agent with the same intent, **plus** a section in
   the prompt that lists the user's confirmed answers, e.g.:
   ```
   document repo mozart. Path: /abs/path/to/mozart. Today: 2026-06-08.

   User-confirmed answers from prior interview:
   - Owner: JPL / NASA HySDS team (Confirmed)
   - Criticality: P1 (Confirmed)
   ```
5. The agent skips its interview gate when it sees these answers and
   writes the file with `Confirmed` grounding for those fields.

### Anti-patterns (don't do these)

- **Don't pre-fill ungrounded fields with assumptions.** If the user said
  "document repo hysds" and didn't specify the owner, do NOT pad your prompt
  with "Owner: probably JPL." Let the agent surface the gap.
- **Don't suppress the agent's interview output.** Relay every question.
- **Don't re-spawn without answers.** Same prompt → same gate response.

## Spawning patterns

### Single-task

```
Agent(
  subagent_type="platform-architect",
  model="opus",
  prompt="document repo mozart. Path: /Users/shah/Desktop/Development/hysds/hysds-core/mozart. Today: 2026-06-08. Branch: main. Recent commits: <git log output>."
)
```

### Sequential handoff (most common)

Authoring agents emit handoff signals at the end of their output. Read them
and spawn the next agent. Typical chains:

- `platform-architect document repo` → handoff → `wiki-keeper update README index`
- `platform-architect document repo` → surfaces candidate ADRs → `adr-writer record decision` → `wiki-keeper update README index`
- `feature-analyst analyze feature` → user reviews → `adr-writer` (new decisions) → `platform-architect update repo` for each affected repo → `dependency-mapper add dependency edge` → `feature-analyst document feature` → `wiki-keeper update README index`

### Parallel (rare here)

Use parallel only when authoring two genuinely independent docs (e.g., two
unrelated risks, or two unrelated repo docs with no shared dependencies).

## Required prompt inputs for every agent

Always include in the agent prompt:

1. **Today's date** in ISO 8601.
2. **The intent string** verbatim from the routing table.
3. **Any context the agent needs** (file paths, git state, repo names, source citations).

Underspecified prompts produce shallow output. Give file paths, not vague goals.

## Standards & conventions

Two files are referenced by every agent:

- [`standards/knowledge-capture.md`](standards/knowledge-capture.md) — confidence levels, required fields per content type, "no documentation from assumption" rule.
- [`standards/glossary.md`](standards/glossary.md) — HySDS acronyms (PCM, PGE, Mozart, GRQ, Verdi, etc.).

Read both before doing knowledge work yourself. Don't restate them in agent
prompts — agents already link to them.

## When NOT to spawn an agent

- **Pure read questions** ("which ADR covers the OpenSearch index design?") — spawn `onboarding-guide`, or read directly.
- **Trivial single-line edits** (typo fix, link repair) — just edit.
- **Discussion / exploration** with the user — handle directly until you have enough context to give an agent a focused, file-level task.

## Wiki structure cheat-sheet

| Directory | Authored by | Index location |
|-----------|-------------|----------------|
| `repos/` | `platform-architect` | README "Repositories" table |
| `decisions/` | `adr-writer` | README "Decision Log" table |
| `features/` | `feature-analyst` | README "Feature Map" table |
| `risks/` | `wiki-keeper` | README "Risk Register" table |
| `dependencies/` | `dependency-mapper` | `dependencies/README.md` |
| `open-questions.md` | `wiki-keeper` | the file itself |
| `standards/` | hand-edited (rare); referenced by agents | linked from README |

The top-level README has a table for each authored content type.
Whenever an agent writes content, **always** follow up with `wiki-keeper update README index`.
