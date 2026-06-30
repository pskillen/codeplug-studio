# Epic 1 — progress

**Tracking:** [codeplug-studio#1](https://github.com/pskillen/codeplug-studio/issues/1) (Epic) · Phase 0: [#2](https://github.com/pskillen/codeplug-studio/issues/2) · Phase 1: [#4](https://github.com/pskillen/codeplug-studio/issues/4)
**Plan:** Phase 1 Scaffold Core (Cursor plan)
**Branch:** `4/pskil/scaffold-core`

---

## Overall status

**Phase 0:** Complete (merged `9d70463`)
**Phase 1:** Complete — PR in review

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

## Phase 1 — scaffold + core skeleton

**Tracking:** [#4](https://github.com/pskillen/codeplug-studio/issues/4)
**Plan:** Phase 1 Scaffold Core (Cursor plan)
**Branch:** `4/pskil/scaffold-core` (from `main` after Phase 0 merge)

**Status:** Complete — PR in review

### Slice 0: Branch and progress kickoff

**Commit:** `5fbba0b` — `docs: kick off phase 1 tracking for #4`

### Slice 1: Toolchain scaffold

**Commit:** `8e81480` — `chore: add Vite React TypeScript scaffold`

### Slice 2: Layer folders + ESLint boundaries

**Commit:** `9429810` — `chore: add src layer layout and ESLint boundaries`

### Slice 3: Core models + schema version

**Commit:** `0aec94e` — `feat(core): add Project Library FormatBuild models`

### Slice 4: Domain helpers + unit tests

**Commit:** `51740a5` — `test(core): add model and factory unit tests`

### Slice 5: ProjectPersistence port (in-memory)

**Commit:** `f7cd7e5` — `feat(integrations): add in-memory ProjectPersistence port`

### Slice 6: App shell + build footer

**Commit:** `06edc8a` — `feat(app): add placeholder shell and build footer`

### Slice 7: CI, Pages deploy, version-number skill

**Commit:** `425ad06` — `chore: add CI Pages workflows and version-number skill`

### Slice 8: Feature docs + DESIGN touch-up

**Commit:** `2d12e1b` — `docs: add data-model hub and update DESIGN persistence`

### Slice 9: Close out

**Commit:** (this PR) — `docs: complete phase 1 section in epic-1-progress`

---

## Phase 1 acceptance criteria (#4)

- [x] `npm run build` succeeds; `base` is `/codeplug-studio/`
- [x] `npm run test` — core model + in-memory persistence tests pass
- [x] `npm run lint` enforces core → no React
- [x] `src/core/models/` includes Project, Library entities, FormatBuild, traits registry stub
- [x] `ProjectPersistence` port in `integrations/` with revision-aware in-memory implementation
- [x] `STUDIO_SCHEMA_VERSION = 1` defined
- [x] CI workflow on PR; Pages workflow on release
- [x] Placeholder app renders with build footer
- [x] No CSV/YAML import/export, no IndexedDB, no Mantine, no library CRUD UI
- [x] Data-model doc + types ready for Phase 2 CRUD

---

## Next

- Merge Phase 1 PR ([#4](https://github.com/pskillen/codeplug-studio/issues/4))
- Enable GitHub Pages (Actions source) before first release
- Phase 2: library CRUD UI, map, IndexedDB persistence
