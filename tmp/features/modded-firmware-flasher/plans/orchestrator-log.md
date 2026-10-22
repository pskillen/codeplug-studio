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
- PR https://github.com/pskillen/codeplug-studio/pull/1372 open (base `main`), head `57035f9`, 18 commits (slices
  1–19), 84 files. `dev` force-pushed to `57035f9` (verified). Committed patch files hash to the published sha256s
  (orchestrator verified); no vendor files.
- Gates: format/lint/build pass; 3807 tests pass; 2 timeouts in untouched `at-d890uv/protocol.test.ts` (known RMW
  flake + "patches only P1 and P2…", slow on this container; pass with --testTimeout=60000). Manual `npm run dev`
  walkthrough not done.
- Deviations: see PR (wrong-radio check in user patch source + prepare; own Web Serial message; EOT
  `port-closed-by-radio`; guard copies plan; preflight disables connect; `buildToolsStripItems`; recovery link
  placeholder for phase 4).
- Gate H-DM32: owner script sent. Waiting on owner. Slice 20 (prod flip) NOT added.
- **H-DM32: OK (2026-10-22).** Owner: "Amazing! write success in about 2 mins. UI looks excellent." Posted on #1363
  and #1365.
- Owner copy nit (decision, applies to phase 4 too): UI must make clear it writes the **"MM9PDY modded firmware"**;
  "1.0.0" or "the firmware" alone aren't specific enough. Owner: "Fix the copy, ship it! … Then on to the next one".
- Next: template B on `1363/pskil/firmware-dm32` — copy commit, then slice 20 prod flip as the last commit.
- Owner merged #1372 at `57035f9` (merge `76e7333`) before the copy fix and flip existed; branch deleted.
- Follow-up PR https://github.com/pskillen/codeplug-studio/pull/1373 (base `main`), branch
  `1363/pskil/firmware-dm32-prod`, head `1c25eae` = prod flip (last). Commits: `3a8a301` project names in catalog
  (`src/core/firmware/releases/projects.ts`, `FIRMWARE_PROJECTS`), `22b1d37` wizard copy, `1c25eae` DM-32 prod flip.
  `dev` at `1c25eae`. Gates green apart from the known D890 protocol timeouts. Patch hashes unchanged.
- Deviation: hub "Bundled releases" / "User-supplied patch" rows now "Shipped: prod (DM-32UV)".

## Phase 4 (2026-10-22): started

- Owner: "merge has happened, carry on". Branch `1364/pskil/firmware-d890` from `origin/1363/pskil/firmware-dm32-prod`
  (`1c25eae`) so it inherits the MM9PDY naming; PR base `1363/pskil/firmware-dm32-prod` (retarget to `main` once
  #1373 merges). `Closes #1364`, `Closes #1365`, `Closes #1366`.
- Owner merged #1373 into `main`. Phase 4 PR retargeted to `main` before opening.
- PR https://github.com/pskillen/codeplug-studio/pull/1374 (base `main`), head `6e88b13`, 9 commits (slices 1–4,
  6–10; optional slice 5 skipped). `dev` at `6e88b13`. Gates green apart from 3 timing flakes in untouched D890 test
  files. No vendor files. Mock 52,515-frame synthetic session ≈ 392 ms JS overhead.
- Deviations: fixtures under `firmwareUpdate/__fixtures__/`; Handshake→Transfer→Finish (no Erase); `timing` added
  to result, error and failed outcome; mock `closeAtFrame`; `githubDocUrl()` helper.
- Gate H-D890: owner script sent (Prepare wording corrected to the MM9PDY title). Waiting on owner. Flip (slice 11)
  NOT added.
- **H-D890: OK (2026-10-22).** Owner: "success! it only took 1-2 mins, not long at all." Summary: 52,518 frames
  (52,515 data), Elapsed 00:25 (24.7 s), End `port-closed-by-radio`, round trip median 0.00 / p99 8.00 / max 11.0 ms,
  flashed hashes match. Posted on #1364, #1365, #1366. No pipe optimisation needed (slice 5 stays skipped).
- Next: template B on `1364/pskil/firmware-d890` — slice 11 prod flip, `expectedDuration` "under a minute".
- Owner merged #1374 at `6e88b13` (merge `19f07bf`) before the flip existed.
- Follow-up PR https://github.com/pskillen/codeplug-studio/pull/1375 (base `main`), branch
  `1364/pskil/firmware-d890-prod`, single commit `dd24849` (D890 `prodFlashDisabled: false`, `expectedDuration:
  'under a minute'`, tests, docs). `dev` at `dd24849`. Gates green apart from the known D890 protocol flakes.
- Waiting on owner to merge #1375. Then both radios reach prod at the next full Studio release.
