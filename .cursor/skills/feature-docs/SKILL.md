---
name: feature-docs
description: >-
  How codeplug-studio documents features under docs/features/. Use when
  implementing or changing any user-facing feature, route, integration workflow,
  or shared component — not only when explicitly asked to write docs. Also for
  progress/outstanding logs and reverse-engineering behaviour for a ticket.
---

# codeplug-studio feature documentation

Canonical feature docs live under **`docs/features/<topic>/`**. User-facing overview stays in [`README.md`](../../../README.md) and [DESIGN.md](../../../DESIGN.md); feature docs target contributors and agents.

Deploy and release: [docs/build/README.md](../../../docs/build/README.md).

Read [progress-tracking](../progress-tracking/SKILL.md) when an initiative needs execution handoff files.

**Tier 1 focus:** library, format builds, build capability traits, import/export behaviour — not CPS wire tables (those are tier 3 under `docs/reference/<format>/`).

**Obligation:** [documentation-deliverables.mdc](../rules/documentation-deliverables.mdc) — docs ship in the same PR as behaviour.

---

## Component sidecars (`src/app/components/`)

Reusable UI primitives and widgets get a **sidecar** `<ComponentName>.md` next to the component — not a duplicate hub under `docs/features/`.

| Layer | Where | Contents |
| --- | --- | --- |
| **Sidecar** | `src/app/components/<Name>/<Name>.md` | Props, usage, behaviour for contributors |
| **Feature hub** | `docs/features/<topic>/README.md` | Product workflow, status table, links to sidecars |

See [component-sidecars.mdc](../rules/component-sidecars.mdc) and [make-a-plan §5](../skills/make-a-plan/SKILL.md).

---

## Folder layout

| Pattern | When to use | Examples |
| --- | --- | --- |
| **`<topic>/README.md`** | Every feature area — hub page | `library/README.md`, `report/README.md` |
| **Single-file topics** | One concern without a folder | `maidenhead.md` |
| **Sibling deep dives** | One concern per file; README is the map | `trait-layout.md`, `merge-heuristics.md` |
| **Combined feature folders** | Import + export share one hub when tightly coupled | `import-export/README.md` with format subtrees |
| **`*-progress.md` / `*-outstanding.md`** | Multi-step plans or tickets spanning PRs | `phase-0-progress.md` |

**Slug:** kebab-case matching the product concept (`library`, `builds`), not necessarily a component filename.

**Do not** put the full plan backlog in `*-outstanding.md` — only debt discovered during execution.

Epic / migration logs may live under `docs/poc-migration/` instead of `docs/features/`.

---

## README hub template

Every feature README should open with **what problem the feature solves** (1–2 paragraphs), then:

1. **Implementation status** — table: area | status | notes (shipped / in progress / deferred).
2. **Documentation map** — table linking sibling docs.
3. **Concepts** — library vs build, traits, UUID FKs, mode applicability.
4. **Optional diagram** — mermaid when data flow is non-obvious (CPS → library → build → export).
5. **Cross-links** — tracking GitHub issue, live GitHub Pages URL when deployed.

Stay within the feature boundary: library docs cover inventory semantics, not general amateur-radio advice.

---

## Deep-dive page template

Use for trait layout, merge behaviour, UI interaction, etc.

| Section | Contents |
| --- | --- |
| **Purpose** | What this slice covers vs the hub README |
| **Code anchors** | `src/core/`, `src/app/features/` — modules and services by name |
| **Inputs** | CPS files, library entities, build trait state |
| **Behaviour** | Filters, defaults, edge cases |
| **Browser storage** | IndexedDB/localStorage keys — never commit values |
| **Manual verify** | Steps with `sample-exports/` CPS files |
| **Known gaps** | Deferred features, documented export loss |
| **Related** | Other feature docs, DESIGN.md sections, issues |

Prefer **tables** for entity fields and UI controls. Use small **JSON or YAML snippets** when shape matters.

**Wire column tables** belong in `docs/reference/<format>/`, not here — link out per [documentation-boundaries.mdc](../../rules/documentation-boundaries.mdc).

---

## Progress and outstanding pair

Create both at **plan kickoff** if missing. Update per [progress-tracking](../progress-tracking/SKILL.md).

| File | Role |
| --- | --- |
| `*-progress.md` | Shipped slices, PR links, branch, verify steps, **Next** |
| `*-outstanding.md` | Checkboxes for discovered debt — not future plan phases |

Link both from the tracking GitHub issue and the Cursor plan **Progress tracking** section.

---

## Style conventions

- **British English** in prose is fine; code identifiers stay as in repo.
- Link GitHub issues/PRs with full URLs: `[codeplug-studio#1](https://github.com/pskillen/codeplug-studio/issues/1)`.
- Use relative links between docs: `[trait-layout.md](trait-layout.md)`.
- Cite **concrete defaults** where behaviour depends on them.
- When behaviour changes, update the **feature doc** and any affected code comments.
- **Reverse-engineering ticket:** document *current* behaviour first before implementing changes.
- **Timeless vs point in time**
  - Feature docs describe how the product works today.
  - Progress and outstanding files are point-in-time execution logs.

---

## Index maintenance

When adding a new feature folder:

1. Add a row to [docs/features/README.md](../../../docs/features/README.md).
2. Optionally add a one-line link from [`AGENTS.md`](../../../AGENTS.md) repository layout table when a new top-level area ships.

---

## Anti-patterns

- Duplicating the entire README or DESIGN.md into feature docs.
- One giant README with no map (split when > ~150 lines or multiple audiences).
- Outstanding file copied from the Cursor plan todo list.
- Documenting aspirational behaviour as shipped — use **Implementation status** and **Known gaps**.
- Embedding OpenGD77 wire tables in tier 1 feature docs.
- Describing library organisation using one format's CSV layout.
