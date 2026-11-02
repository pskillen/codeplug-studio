@AGENTS.md

Read [DESIGN.md](DESIGN.md) (product constitution) before substantial work — [.claude/rules/codeplug-studio.md](.claude/rules/codeplug-studio.md) also points here for most `ts`/`tsx`/`md` edits.

## Rules and skills

- `.claude/rules/*.md` — path-scoped conventions (ported from `.cursor/rules/`; kept in sync manually, so update both when conventions change).
- Skills and agents live in the owner's shared library, [`pskillen/agent-skills`](https://github.com/pskillen/agent-skills) (private): `core@pskillen` for how we work and the role agents, `codeplug-studio@pskillen` for this repo's conventions (`codeplug-conventions`), `debounced-inputs` and `wire-name-preview`.

```bash
claude plugin marketplace add pskillen/agent-skills
claude plugin install core@pskillen && claude plugin install codeplug-studio@pskillen
```

## Multi-phase agents

The `core` plugin's agents run the multi-phase-plan roles. Pick one per session and have it load `codeplug-conventions`:

| Agent              | Job                                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `core:designer`    | Brainstorm → `hl-delivery-plan.md` RFC. Iterate in place until review. No tickets, no product code.                          |
| `core:planner`     | After the design exists: tickets, phases, file issues, concrete `plans/`. One step, then stop. No product code.              |
| `core:coordinator` | Drive a ready `plans/` series by spawning `core:implementor` once per phase on stacked branches. No product code, no merges. |
| `core:implementor` | Execute **one** phase file: branch, atomic commits, docs, local gates, PR.                                                   |
