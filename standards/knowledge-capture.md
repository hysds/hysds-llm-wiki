# Knowledge Capture Standards

The single source of truth for **how** the HySDS wiki is written. Every agent
under `.claude/agents/` and every contributor following `CONTRIBUTING.md`
should link here rather than restate these rules.

## Core principle: interview before writing, label only after

Every claim in the wiki must be one of:

- **Grounded in code, config, or a lock file** read directly from the repo, OR
- **Confirmed by a named human** in an interview (the user, or a recorded
  prior interview transcript).

If a required field is neither, the agent **MUST stop and interview the user
before writing** — it MUST NOT silently write the field with a `[Likely]` or
`[Unknown]` label. Confidence labels are for **post-interview residual
uncertainty** (genuinely cross-repo claims, future-state, third-party state
the user themselves can't verify), not a workaround for skipping the
interview.

**Plausible-but-unverified claims are worse than no claim** — they get
treated as fact later, by humans and by AI agents alike. The whole point of
this knowledge repo is durable, grounded knowledge; an unverified `[Likely]`
that nobody ever revisits silently becomes "the answer."

## Interview format (used by every authoring agent)

When an authoring agent (`platform-architect`, `adr-writer`,
`feature-analyst`, `wiki-keeper record risk`) finds it cannot ground a
required field, it MUST emit this block as its **entire output** and
**return without writing any wiki file**:

```markdown
## Questions for the user

I cannot ground the following required fields. Answer each, then re-spawn
me with the answers in the prompt. I will NOT write any wiki content this
turn.

1. **<field>** — <question>. Best guess: <guess> [Likely | Unknown]. Source I'd cite if confirmed: <where>.
2. ...
```

The orchestrator MUST relay these questions verbatim to the user and wait
for answers before re-spawning the agent.

## Required fields per content type

### `repos/<slug>.md` (platform-architect)

| Field | Can be code-grounded? | Interview if missing? |
|-------|-----------------------|-----------------------|
| One-line description | Yes (README) | If README missing |
| Primary language(s) | Yes (file extensions, pyproject.toml) | No |
| Runtime role | Yes (code) | If ambiguous |
| Owner / team | No | **Yes** |
| Criticality tier (P1/P2/P3) | No | **Yes** |
| Deployment model | Yes (Dockerfile, supervisor configs) | If absent |
| Key dependencies | Yes (requirements.txt, pyproject.toml) | No |
| OpenSearch indices written | Yes (code search) | If ambiguous |
| Queues consumed | Yes (code search) | If ambiguous |
| External integrations | Yes (code + config) | If ambiguous |

### `decisions/ADR-NNN-<slug>.md` (adr-writer)

| Field | Can be code-grounded? | Interview if missing? |
|-------|-----------------------|-----------------------|
| Title | No | **Yes** |
| Status (Proposed/Accepted/Deprecated/Superseded) | No | **Yes** |
| Context | Sometimes | If not obvious from code |
| Decision | No | **Yes** |
| Consequences | No | **Yes** |
| Alternatives considered | No | **Yes** |
| Date | Always (use today's date) | No |

### `risks/RISK-NNN-<slug>.md` (wiki-keeper record risk)

| Field | Can be code-grounded? | Interview if missing? |
|-------|-----------------------|-----------------------|
| Title | No | **Yes** |
| Severity (High/Medium/Low) | No | **Yes** |
| Likelihood (High/Medium/Low) | No | **Yes** |
| Affected components | Yes (sometimes) | If ambiguous |
| Mitigation | No | **Yes** |
| Owner | No | **Yes** |

### `features/<slug>.md` (feature-analyst)

| Field | Can be code-grounded? | Interview if missing? |
|-------|-----------------------|-----------------------|
| Feature name | No | **Yes** |
| Affected repos | Yes (code trace) | If ambiguous |
| Data flow | Sometimes | If partial |
| Status (Planned/In Progress/Shipped) | No | **Yes** |
| Owner | No | **Yes** |

## Confidence labels

Use these only after grounding attempts:

| Label | Meaning |
|-------|---------|
| *(no label)* | Grounded in code/config or confirmed by a named human |
| `[Likely]` | Strongly implied by code context but not explicit; flag for human review |
| `[Unknown]` | Cannot be determined; field is present as a placeholder with a note |

Never write `[Likely]` or `[Unknown]` for fields marked **Interview if missing = Yes**.

## What NOT to document

- Secrets, passwords, tokens — reference their location, never their values.
- IP addresses and hostnames for specific deployment instances — those belong
  in operational runbooks, not architecture wiki entries.
- In-flight implementation details — wait until shipped; use `open-questions.md`.
