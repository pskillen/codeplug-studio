# Modded firmware flasher: phase plan

How the tickets in [ticket-management.md](ticket-management.md) land as PRs. The design rationale is in
[hl-delivery-plan.md](hl-delivery-plan.md). Epic [#1358](https://github.com/pskillen/codeplug-studio/issues/1358).

The concrete per-phase files are in [plans/](plans/00-README.md).

---

## Delivery model

**Chosen: Orchestrator agent, with an owner stop after every phase** (owner, 2026-10-21).

- The `orchestrator` agent runs the phases in order. It spawns one `implementor` per phase on **stacked branches**:
  phase 1 starts from `origin/main`, and phase N starts from phase N-1's branch. The orchestrator **never merges**.
- **After every phase the orchestrator stops** and notifies the owner. It continues only when the owner replies.
- **Hardware is tested by the owner, never by an agent.** In a hardware-gated phase, the orchestrator (or the
  implementor) force-pushes the phase branch to `dev`, which deploys to `https://dev.codeplug.mm9pdy.net`. It then
  stops and tells the owner exactly what to test. The owner treats `dev` as a playground, so the push needs no
  permission. The owner may run `npm run dev` locally instead for the throughput spike.
- **Prod is protected by per-radio flags.** Each `FirmwareUpdaterDescriptor` carries `prodFlashDisabled`, which
  hides that radio on the prod build only. A flag is cleared in its own tiny phase, and only after the owner confirms
  that radio is **proven**. Proven means Studio has flashed both stock firmware and at least one of our patched
  releases on hardware.
- **Containers are reclaimed between phases.** Every phase file has a "Bootstrap" section that starts from a bare
  clone. It fetches the planning branch `plan/modded-firmware-flasher` (plans and owner inputs) and re-clones the
  firmware repos read-only when that phase needs them.
- **`gh` is not authenticated** in these containers. GitHub operations (PRs, comments, issue reads) go through the
  GitHub MCP tools, which apply directly here. This overrides the `gh`-only line in the `orchestrator` and
  `implementor` agent definitions for this series only.

**Why this model:** most phases are mechanical ports with strong unit tests, so a stacked run suits them. The owner
must still touch hardware five times. Stopping after every phase gives the owner one consistent checkpoint and lets
them review as the work goes. They don't have to wait for a 13-PR stack to be finished.

## Phases

One phase is one PR. H marks a hardware gate (owner test on `dev`); C marks an owner confirmation with no new
hardware test.

| # | Tickets | What | Gate after the phase | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #1359 | DESIGN.md "Firmware flashing" section, Glossary, Non-goals, revision log; AGENTS.md line; firmware-flashing agent rule (`.claude/rules/` + `.cursor/rules/`) | Review only | — |
| 2 | #1364 (part 1) | D890 round-trip spike: a read-only "Round-trip timing" pass on `/debug/d890-erase-probe` (median, p99, projection to 52,515 frames) | **H1**: owner measures on a D890 in normal mode (foreground, background tab, screen locked). The orchestrator posts the numbers to #1364. If the projection is over 3 min or p99 is near 2 s, the owner decides before phase 10 | 1 |
| 3 | #1360 | Core firmware foundation: types, `sha256Hex`, `hexToBytes`, `FirmwareError`; both radios' `firmware.ts`; stock catalog; `resolveStockFirmware` + `StockSource`; `prepareFirmwareImage` (stock target); tier-3 `firmware.md` stock sections | Review only | 2 |
| 4 | #1361 | Patch formats: dispatcher + `baofeng-dm32-firmware` and `anytone-d890-firmware` format 1 parse/apply, synthetic patch makers, refusal tests | Review only | 3 |
| 5 | #1363 | `FirmwareUpdater` seam (types, registry, guarded send, `FirmwareFlashError`), kit `'interlock'` error, Web Serial USB filters, DM-32UV updater + ported mock bootloader; descriptor `prodFlashDisabled: true` | Review only | 4 |
| 6 | #1365 (slice 1) | Wizard at `/firmware`, DM-32UV **stock only**; prod gate resolver + tests; wake lock; nav; v2 `Stepper`; feature hub | **H2**: owner flashes DM-32UV stock 048 from `dev` | 5 |
| 7 | #1362 | Release catalog: commit both `1.0.0` patches + notes byte for byte, `.prettierignore` / `.gitattributes`, index, bundled + user patch sources, `prepareFirmwareImage` patch target, catalog test, maintainer doc | Review only | 6 |
| 8 | #1365 (slice 2) | Wizard: bundled releases, RC toggle, release notes, Advanced user patch + risk statement, provenance in summary, release verify hint | **H3**: owner flashes DM-32UV `1.0.0` from `dev` and checks its verify hint | 7 |
| 9 | #1363 (closing) | Enable DM-32UV in prod: `prodFlashDisabled: false` | **C1**: the owner confirmed H2 and H3 **before** this phase starts | 8 |
| 10 | #1364 (part 2) | AT-D890UV updater + ported mock, all interlocks incl. band byte; JS-overhead timing; registered with `prodFlashDisabled: true`, `stockFlashHardwareProven: false` | Review only | 9 |
| 11 | #1365 (slice 3) | Wizard: AT-D890UV end states (`port-closed-by-radio`, `no-reply`), progress throttling, "not yet hardware-proven" stock label | **H4**: owner flashes AT-D890UV `1.0.0` from `dev` (Device Info shows `1.0.0`); duration posted to #1364 | 10 |
| 12 | #1366 | Recovery: hub recovery section, wizard failure-screen link, `modded-firmware` cross-link, recovery wording in tier-3 docs | **H5**: owner flashes AT-D890UV stock V1.05 from `dev` | 11 |
| 13 | #1366 (closing) | Enable AT-D890UV in prod: `prodFlashDisabled: false`, `stockFlashHardwareProven: true` | **C2**: the owner confirmed H4 and H5 **before** this phase starts | 12 |

The L-sized tickets are split here, not during step 7:

- #1364 becomes phases 2 and 10;
- #1365 becomes phases 6, 8 and 11;
- #1363 closes in phase 9;
- #1366 closes in phase 13.

**Which PR closes which issue:**

| Phase | PR body says |
| --- | --- |
| 1 | `Closes #1359` |
| 2 | `Part of #1364` |
| 3 | `Closes #1360` |
| 4 | `Closes #1361` |
| 5 | `Part of #1363` |
| 6 | `Part of #1365` |
| 7 | `Closes #1362` |
| 8 | `Part of #1365` |
| 9 | `Closes #1363` |
| 10 | `Part of #1364` |
| 11 | `Closes #1364`, `Closes #1365` |
| 12 | `Part of #1366` |
| 13 | `Closes #1366` |

Closing keywords only fire when a PR merges into `main`, which happens when the owner merges the stack.

## Suggested order

This series is strictly sequential, because every phase is stacked on the one before. The order is chosen so that:

- **the top technical risk is retired first.** Phase 2 measures D890 Web Serial round trips before any D890 updater
  or UI exists. It needs nothing from the epic beyond the design, so it runs right after phase 1;
- **the DM-32UV is finished end to end before the AT-D890UV starts** (phases 3 to 9). The shorter protocol proves
  the app pieces: port re-pick, wake lock, navigation block, and the recovery screen;
- **the stock-only wizard (phase 6) comes before the catalog (phase 7),** so the first hardware test needs no
  patches;
- **each prod flip is its own phase,** started only after the owner's confirmation. The owner can merge the stack up
  to phase 9 to release the DM-32UV while the AT-D890UV work continues above it.

Nothing runs in parallel. If the owner later wants parallel work (for example #1361 beside #1360), that needs a
change to this plan, not an orchestrator improvisation.

**If a hardware gate fails:** the orchestrator does not move on. It spawns an implementor on the **same phase
branch**, passing the owner's failure report. The implementor fixes it with new commits, the orchestrator pushes
to `dev` again, and it stops again. Later phases are never started on top of a failed gate.

**If H1 (throughput) comes back slow:** the owner chooses before phase 10:

- accept the time;
- add a pump-optimisation slice (a dedicated single-byte ACK reader, or less buffer churn in `webSerialPipe.ts`) to
  phase 10;
- insert a new phase.

Pipelining frames ahead of their ACK stays rejected.

## Branch strategy

Stacked (orchestrator model). Author segment `pskil`.

| # | Branch | Starts from | PR base |
| --- | --- | --- | --- |
| 1 | `1359/pskil/firmware-design` | `origin/main` | `main` |
| 2 | `1364/pskil/d890-roundtrip-spike` | phase 1 branch | phase 1 branch |
| 3 | `1360/pskil/firmware-stock-pins` | phase 2 branch | phase 2 branch |
| 4 | `1361/pskil/firmware-patch-formats` | phase 3 branch | phase 3 branch |
| 5 | `1363/pskil/firmware-updater-dm32` | phase 4 branch | phase 4 branch |
| 6 | `1365/pskil/firmware-wizard-dm32-stock` | phase 5 branch | phase 5 branch |
| 7 | `1362/pskil/firmware-release-catalog` | phase 6 branch | phase 6 branch |
| 8 | `1365/pskil/firmware-wizard-releases` | phase 7 branch | phase 7 branch |
| 9 | `1363/pskil/dm32-flash-prod-enable` | phase 8 branch | phase 8 branch |
| 10 | `1364/pskil/d890-firmware-updater` | phase 9 branch | phase 9 branch |
| 11 | `1365/pskil/firmware-wizard-d890` | phase 10 branch | phase 10 branch |
| 12 | `1366/pskil/firmware-stock-recovery` | phase 11 branch | phase 11 branch |
| 13 | `1366/pskil/d890-flash-prod-enable` | phase 12 branch | phase 12 branch |

**Dev deploys:** `git push --force origin <phase-branch>:dev`. `dev` is a playground branch that is regularly
overwritten, and its deploy uses `BUILD_ENV=dev`, so both radios are visible there whatever their prod flags say.

**Planning branch:** `plan/modded-firmware-flasher` is an orphan branch. It is never merged, and nothing from it is
cherry-picked into a product branch except the owner inputs that phase 7 copies on purpose (our patches and notes).

## Rules carried by every phase file

- **Vendor firmware never reaches `main` or any committed path:** no stock `.bin`, `.CDD`, `.CDI`, `.spi` or vendor
  zip, in source, test fixtures, docs or the planning branch. Tests build synthetic images. Our own patch files
  (phase 7) are fine.
- **Hard interlocks are code.** No setting, flag, env value, query parameter or patch field can disable one.
- **Layer rules:**
  - radio facts in `src/core/radios/<mfr>/<model>/firmware.ts`;
  - patch formats in `src/core/firmware/patch/formats/<patch-name>/`;
  - bootloader protocols in `src/integrations/radio-io/radios/<id>/firmwareUpdate/`;
  - no radio literals, USB IDs or wire bytes in `src/app/`;
  - the app imports radio-io only through `@integrations/radio-io` (the index), never a radio module directly.

  The existing debug page is the one sanctioned exception, and phase 2 extends it.
- **Docs ship with behaviour,** in the same PR.
