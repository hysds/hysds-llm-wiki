# Contributing to the HySDS Wiki

This wiki is maintained by a set of Claude Code agents defined in `.claude/agents/`.
Here's how to use them.

## Routing table (human version)

| You want to... | Say to Claude... |
|----------------|-----------------|
| Document a new repo | "document repo `<name>`" |
| Refresh a repo doc section | "update the repo `<name>` doc, `<section>` section" |
| Record an architectural decision | "record this decision: `<title>`" or "write an ADR for `<title>`" |
| Promote a candidate ADR | "promote candidate ADR `<id>`" |
| Analyze a feature's impact | "analyze feature `<name>`" |
| Document a shipped feature | "document feature `<name>` — it's shipped" |
| Update the dependency graph | "update the dependency graph for `<name>`" |
| Record a risk | "record a risk: `<title>`" |
| Log an open question | "log an open question about `<topic>`" |
| Ask where something lives | "where does `<X>` live?" / "what is `<Y>`?" |

## How authoring works

Authoring agents (**platform-architect**, **adr-writer**, **feature-analyst**,
**wiki-keeper** for risks) follow a two-phase pattern:

1. **Discovery phase** — the agent reads code and existing wiki content.
2. **Interview phase** — if required fields can't be grounded in code, the
   agent asks you questions before writing anything.

You'll see a block like:

```
## Questions for the user
1. **Owner** — Who owns this repo? Best guess: JPL/NASA HySDS team [Likely].
2. **Criticality** — Is this P1 (system down if broken), P2, or P3?
```

Answer each question, then Claude will re-run the agent with your answers
and produce the wiki entry.

**Never skip the interview.** The wiki's value comes from grounded, verified
facts. An unverified `[Likely]` that nobody revisits silently becomes "the
answer."

## File conventions

- Repo docs: `repos/<slug>.md` (slug = GitHub repo name, lowercase)
- ADRs: `decisions/ADR-NNN-<kebab-title>.md` (sequential numbers)
- Features: `features/<kebab-name>.md`
- Risks: `risks/RISK-NNN-<kebab-title>.md` (sequential numbers)
- All acronyms must be in `standards/glossary.md`

## What not to put here

- Secrets, passwords, tokens (reference their location, not their values)
- IP addresses of specific deployment instances (use component names)
- In-flight implementation details (use `open-questions.md` instead)
- Duplicate content from code README files (link to them instead)
