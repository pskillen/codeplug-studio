@AGENTS.md

Read [DESIGN.md](DESIGN.md) (product constitution) before substantial work — [.claude/rules/codeplug-studio.md](.claude/rules/codeplug-studio.md) also points here for most `ts`/`tsx`/`md` edits.

## Rules and skills

- `.claude/rules/*.md` — path-scoped conventions (ported from `.cursor/rules/`; kept in sync manually, so update both when conventions change).
- `.claude/skills/*` — symlinked to `.cursor/skills/*`, so editing either location updates both tools at once.

## Multi-phase agents

Project subagents in `.claude/agents/` encode the [multi-phase-plan](.claude/skills/multi-phase-plan/SKILL.md) roles. Do not set a default `agent` in settings — pick one per session:

| Agent          | Job                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `designer`     | Brainstorm → `hl-delivery-plan.md` RFC. Iterate in place until review. No tickets, no product code.                     |
| `planner`      | After the design exists: tickets, phases, file issues, concrete `plans/`. One step, then stop. No product code.         |
| `orchestrator` | Drive a ready `plans/` series by spawning `implementor` once per phase on stacked branches. No product code, no merges. |
| `implementor`  | Execute **one** phase file: branch, atomic commits, docs, local gates, PR.                                              |

```bash
claude --agent designer
claude --agent planner
claude --agent orchestrator
claude --agent implementor
```

From a normal session, ask Claude to use the named agent. First session after adding `.claude/agents/` may need a restart so the watcher picks up the new directory.
