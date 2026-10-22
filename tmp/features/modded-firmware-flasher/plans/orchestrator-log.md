# Orchestrator log

## Phase 1 (2026-10-21): PR open, at review gate

- Branch `1359/pskil/firmware-design`, head `aae3891c3c628141834cf2ddc5eb90cd6592e2bd`, PR base `main`.
- PR: https://github.com/pskillen/codeplug-studio/pull/1370 (`Closes #1359`).
- Shipped: DESIGN.md "Firmware flashing" section (+ glossary, non-goal, revision log), AGENTS.md principle 11, `.claude/rules/firmware-flashing.md` and `.cursor/rules/firmware-flashing.mdc`, rule listed in codeplug-studio rule index. Two atomic commits, both with the required trailer.
- Local gates (implementor-reported): format:check pass; lint pass (0 errors, 43 existing warnings); test pass on re-run (538 files, 3618 tests); build pass. First full test run had one 5000 ms timeout in `at-d890uv/protocol.test.ts` ("uploads after seeding hydration with sparse erase-unit RMW") under load; passes alone and on re-run. Pre-existing flake, untouched code.
- Deviations from phase file: none in content; added a `---` separator after the new DESIGN.md section.
- Orchestration notes: this orchestrator had no Agent/Task tool, so the implementor was started as a separate cloud session (`session_019Z9T2bU4T9BbqsqpRRZfeG`) via create_session (source: product repo `main`, no worktree isolation). The implementor's PR body used a different footer than the owner specified; orchestrator corrected it via update_pull_request. Sessions are not worktree-isolated; branch was created by `checkout -B` as instructed.
- Gate: review. Not started phase 2; waiting on owner.

## Phase 1 merged (2026-10-22)

- Owner: "Approved, and merged." PR #1370 merged to `main` as `4358afa`; branch `1359/pskil/firmware-design` deleted.
- Owner decision: the main session takes over as orchestrator and spawns implementors as in-session subagents
  (no more separate cloud sessions).
- Consequence: phase 2 starts from `origin/main` and its PR targets `main` (phase 1 is no longer a stack base).

## Phase 2 (2026-10-22): started

- Branch `1360/pskil/firmware-core` from `origin/main` (`4358afa`), PR base `main`, `Closes #1360`, `Closes #1361`.
- PR https://github.com/pskillen/codeplug-studio/pull/1371 open, head `bef1e78`, 9 commits, 35 files (+2388), no
  vendor or patch files committed (orchestrator checked the diff).
- Gates: format/lint/build pass; tests 3688 pass + known D890 RMW timeout flake (passes alone 20/20).
- Deviations: shared `patch/schema.ts`; D890 constants hold patch name/formats/wire keys; camelCase decoded patch
  objects; `prepareFirmwareImage` also refuses radio-id mismatch; loose duplicate of a zip member silently ignored;
  `firmwareBasename` exported.
- For phase 3: add `patch-wrong-radio` check (descriptor.patchNames) in catalog/prepare; add `*.patch.json` to
  `.prettierignore` and `.gitattributes`; widen `FirmwareTarget` in prepareFirmwareImage; reuse synthetic fixtures.
- Gate: review. Waiting on owner.

## Phase 2 merged (2026-10-22)

- Owner: "Approved and merged, carry on". PR #1371 merged to `main` as `646ec75`.

## Phase 3 (2026-10-22): started

- Branch `1363/pskil/firmware-dm32` from `origin/main` (`646ec75`), PR base `main`, `Closes #1363`, `Closes #1362`,
  `Part of #1365`. Hardware gate H-DM32 then post-gate prod-flip commit.
