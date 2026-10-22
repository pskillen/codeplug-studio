# Final handover: modded firmware flasher (epic #1358)

## What shipped

| PR | Phase | Content | Issues |
|---|---|---|---|
| #1370 | 1 | DESIGN.md "Firmware flashing", AGENTS.md principle 11, `firmware-flashing` agent rule | #1359 |
| #1371 | 2 | Core types, stock pins, `resolveStockFirmware`, `prepareFirmwareImage`, both patch formats | #1360, #1361 |
| #1372 | 3 | Updater seam, DM-32UV updater + mock, `/firmware` wizard, prod gate, catalog with both `1.0.0` patches + notes, user patch | #1362, #1363 |
| #1373 | 3 follow-up | `FIRMWARE_PROJECTS` naming ("MM9PDY modded firmware"), wizard copy, DM-32UV prod flip | refs #1363 |
| #1374 | 4 | AT-D890UV updater + mock + interlocks, wizard end states, timing in summary, recovery guide | #1364, #1365, #1366 |
| #1375 | 4 follow-up | AT-D890UV prod flip, "under a minute" estimate | refs #1364 |

Follow-ups filed, not delivered: #1367 (Android/Capacitor flashing), #1368 (DM-32UV read-back verify).

## Hardware results

- **DM-32UV:** bundled `1.0.0` flashed from `dev` (`57035f9`); write succeeded in about 2 minutes. Owner: "UI looks
  excellent".
- **AT-D890UV:** bundled `1.0.0` flashed from `dev` (`6e88b13`); 52,518 frames, transfer 24.7 s, end
  `port-closed-by-radio`, round trip median 0.00 / p99 8.00 / max 11.0 ms; flashed hashes match. The D890 timing
  spike was dropped beforehand; Web Serial turned out as fast as the Python sender.
- Stock flashing has no hardware gate (owner ruling): both firmware repos' senders had flashed stock many times.

## Deviations from the plan

- Plan was cut from 13 phases to 4 at the owner's request.
- Phases 2–4 started from `main`, not stacked branches, because the owner merged each phase before the next began.
- Twice (#1372, #1374) the owner merged at the hardware-gate head before the post-gate flip commit existed, so the
  flip (and, for the DM-32, an owner copy fix) shipped as a follow-up PR. Lesson: tell the owner explicitly "don't
  merge until the flip is in" at every hardware gate, or put the flip in a separate PR by design.
- Owner copy decision mid-phase 3: modded releases are always named "MM9PDY modded firmware <tag>"; the name is data
  in `src/core/firmware/releases/projects.ts`, never a literal in `src/app/`.
- UI makes no test-provenance claims; every flash needs a risk acknowledgement (owner ruling during planning).

## How the orchestration loop worked

- Phase 1 ran under an `orchestrator` subagent that had no Agent tool, so it spawned the implementor as a separate
  cloud session. The owner then had the main session take over as orchestrator; phases 2–4 ran as in-session
  `implementor` subagents with worktree isolation. That worked well and kept everything in one conversation.
- `gh` had an invalid token throughout; the GitHub MCP tools applied issue and PR writes directly with no form.
- Planning state lived on the orphan branch `plan/modded-firmware-flasher` so it survived container resets; vendor
  firmware never touched any branch, and the owner's patch files only reached `main` via #1372.
- Known flakes: 5 s timeouts in the untouched `at-d890uv/protocol.test.ts` (and once `linkProbe.test.ts`) under
  full-suite load on cloud containers.

## Remaining

- Merge #1375; cut a full Studio release for both radios to appear on prod.
- Delete `plan/modded-firmware-flasher` once the owner no longer needs it.
