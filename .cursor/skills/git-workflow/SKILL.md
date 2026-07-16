---
name: git-workflow
description: >-
  Git workflow for codeplug-studio — browser SPA on Cloudflare Pages. Plan with
  GitHub issues, branch by issue when tracked, use conventional commits, open
  PRs with linked tickets. Use when starting features, committing, or opening
  pull requests in this repo.
---

# codeplug-studio Git Workflow

## Overview

This repo is a **Vite + React + TypeScript SPA** (when scaffolded) with `src/core/`, `src/integrations/`, and `src/app/`, deployed to **Cloudflare Pages** via GitHub Actions. **Next** deploys on every push to `main`; **dev** on push to `dev`; **staging** on pre-release publish; **prod** on full release publish. One issue, one branch, one PR.

Workflow: plan → issue (when non-trivial) → branch → commit → PR → merge to `main` → publish releases for staging/prod deploys.

Use the **`user-github`** MCP for issues and PRs. The `gh` CLI is not available on this machine.

For larger initiatives, pair with [progress-tracking](../progress-tracking/SKILL.md) and [feature-docs](../feature-docs/SKILL.md).

**Product context:** [DESIGN.md](../../../DESIGN.md), [docs/poc-migration/epic-1-context.md](../../../docs/poc-migration/epic-1-context.md).

---

## 1. Planning and Issues

**Small fix or single-file tweak:** branch and PR without an issue is fine.

**Features and multi-commit work:** create one GitHub issue in `pskillen/codeplug-studio` with:

- Problem and intended outcome
- Which layer is affected (`src/core/`, `src/app/`, `docs/`, …)
- Link to a Cursor plan if one exists
- For non-trivial scope: links to progress files under `docs/poc-migration/` or `docs/features/`

Start from a lightweight user request? Update the same issue with the agreed plan — do not create a duplicate.

---

## 2. Branch Naming

| Situation | Format | Example |
|-----------|--------|---------|
| Issue tracked | `{num}/{author}/{short-description}` | `12/pskil/zone-grouping-ui` |
| No issue | `{type}/{short-description}` | `feat/library-crud`, `chore/repo-setup` |

Use kebab-case. Keep descriptions short.

Create branches from **`origin/main`** unless the work explicitly depends on another open branch.

---

## 3. Pre-commit Checks

When `package.json` exists, run the checks relevant to your change:

- `npm run lint` and `npm run format:check` — ESLint + Prettier
- `npm run test` — Vitest
- `npm run build` — type-check and Vite production build when touching build/config
- `npm run dev` and exercise the affected route if behaviour changed
- Confirm no secrets (Mapbox tokens, OAuth, personal CPS files) are staged
- Match existing patterns in the target module

**Phase 0 / docs-only:** no `npm run` required — manual review of markdown and cursor rules.

**Formatting:** `npm run format` writes fixes; `npm run format:check` is what CI runs. If `format:check` fails locally, run `npm run format`, review the diff, and commit the result.

---

## 4. Commits

Use [conventional commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `chore`

**Scope:** feature slug when helpful — e.g. `library`, `builds`, `repo`

**Rules:**

- Atomic commits per logical change
- Brief but descriptive
- Do **not** use the word "enhance"

**Examples:**

```
feat(library): add channel CRUD mutations
docs(design): clarify trait profile wording
chore(rules): add layer-boundaries cursor rule
```

---

## 5. Running git in Cursor agents

When the **Shell** tool runs `git`:

1. **Always set `working_directory`** to the repo root: `C:\Users\pskil\git\codeplug-studio`. Commands that only `cd` inside the command string often return empty output even on success.

2. **Good pattern**

   ```text
   working_directory: C:\Users\pskil\git\codeplug-studio
   command:            git fetch origin && git status -sb
   ```

3. **Permissions:** `required_permissions: ["git_write"]` for checkout/commit; add `"network"` for `fetch` / `push`.

4. **PRs and issues:** use `user-github` MCP — not `gh`.

5. **Commits:**

   **Plan execution or drive-by ticket** — active `.cursor/plans/` file, user said
   "execute/continue the plan", multi-slice work with commit checkpoints, or user invoked
   `@drive-by-ticket` ([drive-by-ticket](../drive-by-ticket/SKILL.md)):
   - Commit at every **commit checkpoint** before starting the next slice.
   - Run `git status -sb` — working tree must be clean before the next slice.
   - Commit little and often; committing is not cheap to skip but cheap to do.
   - Docs are slices too — own checkpoint, own commit; not deferred to PR time.
   - **Forbidden:** batching many file edits then multiple `git commit` commands in one shell block.
   - After any conversation summary: `git log -5` and `git status -sb` — do not assume prior commits.

   **Ad-hoc conversation** (single question, review, unplanned tweak):
   - Do not commit unless the user asks.

---

## 6. Pull Requests

When work is ready:

1. When toolchain exists: run `npm run format` and commit any Prettier fixes.
2. When toolchain exists: run `npm run format:check && npm run lint && npm run test && npm run build`.
3. Push the branch.
4. Open one PR in `pskillen/codeplug-studio` via `user-github` MCP
5. Link the issue (`Closes #N`) when applicable
6. Note which layer changed and how to smoke-test locally

**PR description template:**

```markdown
## Summary
- …

## Documentation
- [ ] Feature hub / deep dive updated, or N/A (explain why)
- [ ] New reusable component has sidecar `.md`, or N/A
- [ ] `docs/features/README.md` index row if new topic, or N/A

## Test plan
- [ ] `npm run format:check && npm run lint && npm run test && npm run build` (when applicable)
- [ ] `npm run dev`, exercise affected routes
- [ ] …
```

See [documentation-deliverables.mdc](../rules/documentation-deliverables.mdc) and [feature-docs](../feature-docs/SKILL.md).

---

## Quick Reference

| Step | Action |
|------|--------|
| Plan | Issue for non-trivial work; link plan + feature docs |
| Branch | `{num}/{author}/{slug}` or `{type}/{slug}` from `origin/main` |
| Pre-commit | lint, test, build when `package.json` exists; no secrets in diff |
| Commit | Conventional commits; atomic; Shell `working_directory` = repo root |
| PR | push; one PR; link issue; describe manual test steps |
| Deploy | Merge to `main` (next deploy); push to `dev` (dev deploy); pre-release → staging; full release (tag `v*`) → prod on Cloudflare Pages |
