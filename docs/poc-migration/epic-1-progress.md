# Epic 1 — progress

**Tracking:** [codeplug-studio#1](https://github.com/pskillen/codeplug-studio/issues/1) (Epic) · Phase 0: [#2](https://github.com/pskillen/codeplug-studio/issues/2) · Phase 1: [#4](https://github.com/pskillen/codeplug-studio/issues/4)
**Plan:** Phase 1 Scaffold Core (Cursor plan)
**Branch:** `4/pskil/scaffold-core`

---

## Overall status

**Phase 0:** Complete (merged `9d70463`)
**Phase 1 scaffold:** Complete — PR in review
**Phase 1 data model:** Complete — stacked PR in review

---

## Slice 0: Commit existing draft work

**Status:** Complete
**Commit:** `037f60f` — `docs: add DESIGN.md and migration context`

**Delivered**

- [DESIGN.md](../../DESIGN.md) with epic-1-context cross-link
- [epic-1-context.md](epic-1-context.md)
- [storage.md](storage.md)
- [README.md](../../README.md) links to DESIGN.md and epic-1-context

---

## Slice 1: AGENTS.md + progress files

**Status:** Complete
**Commit:** `a33b3fa` — `docs: add AGENTS.md and phase-0 progress tracking`

**Delivered**

- [AGENTS.md](../../AGENTS.md)
- [epic-1-progress.md](epic-1-progress.md)
- [epic-1-gaps.md](epic-1-gaps.md)

---

## Slice 2: Cursor rules

**Status:** Complete
**Commit:** `4dcfee0` — `chore: add cursor rules for Studio architecture`

**Delivered**

- `.cursor/rules/codeplug-studio.mdc`
- `.cursor/rules/vendor-boundaries.mdc`
- `.cursor/rules/export-from-model.mdc`
- `.cursor/rules/documentation-boundaries.mdc`
- `.cursor/rules/format-agnostic-docs.mdc`
- `.cursor/rules/layer-boundaries.mdc`
- `.cursor/rules/library-and-builds.mdc`

---

## Slice 3: Cursor skills

**Status:** Complete
**Commit:** `e0b6cf3` — `chore: adapt cursor skills for codeplug-studio`

**Delivered**

- `.cursor/skills/git-workflow/SKILL.md`
- `.cursor/skills/make-a-plan/SKILL.md`
- `.cursor/skills/feature-docs/SKILL.md`
- `.cursor/skills/progress-tracking/SKILL.md`

---

## Slice 4: Doc indexes and repo hygiene

**Status:** Complete
**Commit:** `2cc9d64` — `chore: add doc indexes and repo hygiene files`

**Delivered**

- `docs/features/README.md`
- `docs/build/README.md`
- `docs/poc-migration/README.md`
- `.gitignore`, `.editorconfig`

---

## Slice 5: Close out and PR

**Status:** Complete
**Commit:** merged via PR #3 (`9d70463`)

---

## Phase 0 acceptance criteria (#2)

- [x] `DESIGN.md` committed and linked from `README.md`
- [x] `AGENTS.md` committed; no round-trip fidelity section
- [x] All seven rules in `.cursor/rules/` present; `no-wire-stash-roundtrip` not ported
- [x] Four skills adapted under `.cursor/skills/`
- [x] `docs/features/README.md` exists
- [x] `.gitignore` covers `node_modules`, `dist`, `.env*`, `sample-exports/`
- [x] Reviewer/agent can read `DESIGN.md` + `AGENTS.md` without codeplug-tool source

---

## Phase 1 — scaffold (SPA shell)

**Tracking:** [#4](https://github.com/pskillen/codeplug-studio/issues/4)
**Plan:** Phase 1 Scaffold Core (Cursor plan) — scaffold slice only; core models in stacked PR
**Branch:** `4/pskil/scaffold-core` (from `main` after Phase 0 merge)

**Status:** Complete — PR in review

### Slice 0: Branch and progress kickoff

**Commit:** `5fbba0b` — `docs: kick off phase 1 tracking for #4`

### Slice 1: Toolchain scaffold

**Commit:** `8e81480` — `chore: add Vite React TypeScript scaffold`

### Slice 2: Layer folders + ESLint boundaries

**Commit:** `9429810` — `chore: add src layer layout and ESLint boundaries`

### Slice 3: App shell + build footer

**Commit:** `2eb6469` — `feat(app): add placeholder shell and build footer`

### Slice 4: CI, Pages deploy, version-number skill

**Commit:** `54e8139` — `chore: add CI Pages workflows and version-number skill`

### Slice 5: VS Code launch config

**Commit:** `fb5ed06` — `build(local): add vscode launch config files`

### Slice 6: Close out

**Commit:** (this PR) — `docs: complete scaffold section in epic-1-progress`

---

## Phase 1 scaffold acceptance criteria (#4)

- [x] `npm run build` succeeds; `base` is `/codeplug-studio/`
- [x] `npm run lint` enforces core → no React
- [x] CI workflow on PR; Pages workflow on release
- [x] Placeholder app renders with build footer
- [x] Layer folders (`src/core`, `src/integrations`, `src/app`) with ESLint boundaries
- [x] Core models + persistence — stacked PR `4/pskil/data-model`

---

## Phase 1 — core data model (stacked on scaffold)

**Tracking:** [#4](https://github.com/pskillen/codeplug-studio/issues/4)
**Branch:** `4/pskil/data-model` → base `main` (scaffold merged via PR #5)

**Status:** Complete — PR #6 in review

### Slice 1: Core models + schema version

**Commit:** `89f4d26` — `feat(core): add Project Library FormatBuild models`

### Slice 2: Domain helpers + unit tests

**Commit:** `4f2f071` — `test(core): add model and factory unit tests`

### Slice 3: ProjectPersistence port (in-memory)

**Commit:** `fd79b29` — `feat(integrations): add in-memory ProjectPersistence port`

### Slice 4: Feature docs + DESIGN persistence

**Commit:** `ef840ff` — `docs: add data-model hub and update DESIGN persistence`

### Slice 5: Close out

**Commit:** (this PR) — `docs: complete data-model section in epic-1-progress`

---

## Phase 1 data model acceptance criteria (#4)

- [x] `npm run test` — core model + in-memory persistence tests pass
- [x] `src/core/models/` includes Project, Library entities, FormatBuild, traits registry stub
- [x] `ProjectPersistence` port in `integrations/` with revision-aware in-memory implementation
- [x] `STUDIO_SCHEMA_VERSION = 1` defined
- [x] Data-model doc + types ready for Phase 2 CRUD

---

## Next

- Merge data-model PR ([#6](https://github.com/pskillen/codeplug-studio/pull/6)) — closes #4
- Enable GitHub Pages (Actions source) before first release
- Phase 2: library CRUD UI, map, IndexedDB persistence
