# Feature documentation

Tier 1 product and internal-model docs for Codeplug Studio. See [DESIGN.md — Documentation tiers](../../DESIGN.md#documentation-tiers) and [`.cursor/rules/documentation-boundaries.mdc`](../../.cursor/rules/documentation-boundaries.mdc).

Topics are added per epic phase — not all folders exist yet.

| Topic                              | Status  | Notes                                                   |
| ---------------------------------- | ------- | ------------------------------------------------------- |
| [data-model](data-model/README.md) | Phase 1 | Project, Library, FormatBuild, traits, `PersistableRow` |
| [app-shell](app-shell/README.md)   | Phase 2 | Navigation shell, route surfaces, project lifecycle     |
| [library](library/README.md)       | Phase 2 | Library CRUD UI + IndexedDB persistence                 |
| _(more in later phases)_           | —       | `builds/`, `import-export/`, etc.                       |

**Migration / epic logs:** [docs/poc-migration/](../poc-migration/) — execution progress for Epic #1.

**Wire format reference (tier 3):** `docs/reference/<format>/` — ported in format phases (OpenGD77, DM32, CHIRP, …).
