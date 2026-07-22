# Approval policy — codeplug-studio (default)

Constitution references: [AGENTS.md](AGENTS.md), [DESIGN.md](DESIGN.md),
[layer-boundaries](.cursor/rules/layer-boundaries.mdc),
[vendor-boundaries](.cursor/rules/vendor-boundaries.mdc),
[library-and-builds](.cursor/rules/library-and-builds.mdc),
[documentation-boundaries](.cursor/rules/documentation-boundaries.mdc),
[format-agnostic-docs](.cursor/rules/format-agnostic-docs.mdc).

## Auto-approve when ALL are true

- PR risk is within the dashboard maximum-risk threshold
- No hard human-review trigger below applies to this PR

## Do not consider GitHub CI checks

**Ignore GitHub Actions CI status** when deciding whether to approve. Do not wait for checks to finish, and do not withhold approval because checks are pending, running, or failed.

- **Merge protection** on `main` already blocks merge when required CI fails.
- The Approval Agent often runs while CI is still **pending**; treating CI as a gate would block most auto-approvals.

CI still runs on every PR via [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (`format:check`, `lint`, `test`, `build`, `e2e`). That is separate from this approval decision.

## Do NOT auto-approve — request human review

### Deploy, secrets, and governance

- Any changed file matches a stricter nested `APPROVAL_POLICY.md`
- PR adds, modifies, or removes secrets, tokens, API keys, OAuth client IDs, or `.env` files (`.env.example` template-only edits are OK)
- PR changes deploy topology: Cloudflare Pages workflows, production/staging/dev deploy triggers, or Pages Function origin gates
- PR changes `APPROVAL_POLICY.md`, `ROUTING.md`, or other approval/routing policy files
- PR changes always-applied boundary rules under `.cursor/rules/` (layer, vendor, documentation, format-agnostic, library-and-builds)

### Layer boundaries ([layer-boundaries](.cursor/rules/layer-boundaries.mdc))

- PR adds React, Mantine, DOM APIs, or `localStorage` usage under `src/core/`
- PR adds IndexedDB or persistence schema logic under `src/core/` (belongs in `src/integrations/`)
- PR adds `core` → `app` or `core` → `integrations` imports (dependency must be `app → core`, `integrations → core` only)
- PR adds React components or domain business rules under `src/integrations/`
- PR under `src/app/` parses CPS CSV columns, compares wire sentinels (e.g. `"Master"`, `"P2"`), or calls format adapter internals directly instead of application services

### Vendor boundaries ([vendor-boundaries](.cursor/rules/vendor-boundaries.mdc), [export-from-model](.cursor/rules/export-from-model.mdc))

- PR adds `OPENGD77_*`, `CHIRP_*`, `DM32_*`, or other format/profile cap constants outside `src/core/import-export/formats/` or `docs/reference/formats/<format>/`
- PR resolves library relationships by human-readable wire `name` strings in mutations, validation, persistence, or CRUD (internal FKs must be UUID `id`)
- PR adds wire stash or stash-and-replay export paths: `wireBag`, `importedColumns`, `*Wire` cell replay, or provenance bags read on export instead of typed model fields
- PR adds format-specific cardinality limits to library CRUD or validation (defer caps to export adapters)

### Library and builds ([library-and-builds](.cursor/rules/library-and-builds.mdc))

- PR models format-specific organisation (zones, scan lists, flat memory order) on **library** entities instead of persisted **build** `layout` / trait state
- PR duplicates library entities per format build instead of selection + layout
- PR adds a single shared “codeplug” edit surface with per-format export buttons (legacy codeplug-tool pattern)
- PR changes export to bypass `assemble(build, library)` as the source of truth

### Documentation boundaries ([documentation-boundaries](.cursor/rules/documentation-boundaries.mdc), [format-agnostic-docs](.cursor/rules/format-agnostic-docs.mdc))

- PR adds CPS wire-mapping tables (column ↔ internal field) to `docs/features/` or `docs/reference/*.md` at the reference root — wire tables belong only under `docs/reference/formats/<format>/`
- PR adds new wire-mapping files at `docs/reference/` root (e.g. `power-levels.md`, `tones.md`)
- PR frames OpenGD77 (or any single format) as **the** internal library model in tier-1 or tier-2 docs — generic docs must stay format-agnostic and link out per format
- PR documents import/export mapping for the **internal** model using only the OpenGD77 reference when the change applies to all formats

### Integrations and auth

- PR touches `src/integrations/` auth, session, or token storage without accompanying tests

## Documentation expectations (not blocking alone)

Per [documentation-deliverables](.cursor/rules/documentation-deliverables.mdc) and [git-workflow](.cursor/skills/git-workflow/SKILL.md):

- Feature behaviour changes should update tier-1 docs under `docs/features/` in the same PR
- New reusable components under `src/app/components/` should include a sidecar `.md`
- PR description should include a Documentation checklist (hub/sidecar/index row or N/A)
- Docs-only PRs are safe to auto-approve when scope is clearly documentation and no hard trigger above applies
