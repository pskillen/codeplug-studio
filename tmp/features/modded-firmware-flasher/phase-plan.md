# Modded firmware flasher: phase plan

How the tickets in [ticket-management.md](ticket-management.md) land as PRs. The design rationale is in
[hl-delivery-plan.md](hl-delivery-plan.md). Epic [#1358](https://github.com/pskillen/codeplug-studio/issues/1358).
The per-phase files are in [plans/](plans/00-README.md).

**Revised 2026-10-21 (owner):**

- consolidated from 13 phases to **4**;
- "proven" now means **a patched release flashed by Studio on hardware**;
- stock flash has no gate of its own;
- the internal-status stock label is dropped.

---

## Delivery model

**Chosen: Orchestrator agent, stopping at every gate** (owner, 2026-10-21).

- The `orchestrator` spawns one `implementor` per phase on **stacked branches**: phase 1 from `origin/main`, phase N
  from phase N-1's branch. It **never merges**.
- **Hardware is tested only by the owner.** In a gated phase, the implementor opens the PR, force-pushes the branch
  to `dev` (`https://dev.codeplug.mm9pdy.net`), stops, and returns the owner's test script. The orchestrator relays it
  and waits.
- **Prod flips sit inside the radio's own PR.** After the owner confirms the bundled `1.0.0` flash for a radio, the
  orchestrator re-spawns (or resumes) the implementor on the **same branch**. It adds **one final commit** setting
  that radio's `prodFlashDisabled: false`.
- **After every phase, and every gate, the orchestrator stops** and notifies the owner.
- **`dev` belongs to this epic** for its duration; force-pushing any flasher branch there is fine. The owner may use
  `npm run dev` locally.
- **Fresh containers.** Containers are reclaimed between phases and gates. Every phase file bootstraps from a bare
  clone: fetch `plan/modded-firmware-flasher`, re-clone the firmware repos read-only if needed, and use the GitHub
  MCP tools (`gh` is unauthenticated; this overrides the agents' `gh`-only line for this series).

**Why this model:** most of the work is a mechanical port with strong unit tests. The owner touches hardware only
twice (one `1.0.0` flash per radio), and is consulted at every gate.

## Phases

| # | Tickets | What | Gate | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #1359 | DESIGN.md "Firmware flashing" section, AGENTS.md line, firmware-flashing rule. (The D890 timing spike was dropped, owner 2026-10-21: a D890 codeplug write already does per-frame-ACK writes in 10 to 15 s; phase 4 measures the real flash.) | Review only | — |
| 2 | #1360, #1361 | Core firmware types and helpers; both radios' stock pins; `resolveStockFirmware` + `StockSource`; `prepareFirmwareImage` (stock); both patch formats with synthetic tests; tier-3 `firmware.md` stock and patch sections | Review only | 1 |
| 3 | #1363, #1362, #1365 slices 1–2 | `FirmwareUpdater` seam, interlock error, USB filters, DM-32UV updater + mock; `/firmware` wizard, prod gate resolver, wake lock, Stepper, hub; catalog with both `1.0.0` patches and notes, hygiene, user patch source, patch-target prepare; wizard releases and user patch. **Final commit:** DM-32UV `prodFlashDisabled: false` | **H-DM32**: owner flashes bundled DM-32UV `1.0.0` from `dev`, then the flip commit | 2 |
| 4 | #1364 part 2, #1365 slice 3, #1366 | AT-D890UV updater + mock (registered, prod-hidden); D890 end states and progress throttling in the wizard; recovery docs and links. **Final commit:** AT-D890UV `prodFlashDisabled: false` | **H-D890**: owner flashes bundled AT-D890UV `1.0.0` from `dev`, then the flip commit | 3 |

**Which PR closes which issue:**

| PR | Body says |
| --- | --- |
| Phase 1 | `Closes #1359` |
| Phase 2 | `Closes #1360`, `Closes #1361` |
| Phase 3 | `Closes #1363`, `Closes #1362`, `Part of #1365` |
| Phase 4 | `Closes #1364`, `Closes #1365`, `Closes #1366` |

Closing keywords fire only when the stack merges into `main`.

**Proven, and stock.** A radio's prod flag is cleared once Studio has flashed **at least one of our patched
releases** to it on hardware. Stock flashing is built and offered in the wizard as the recovery path, but has **no
hardware gate**: both firmware projects' own flashers have flashed stock many times, and Studio's stock flash is the
zero-patch case of the same frame stream. The owner may optionally flash stock during a gate.

**UI copy.** All user-facing strings are written for an end-user operator. The UI makes **no claims about test
provenance** (no tested/untested pills); it makes the risk clear and lets the operator decide. A risk acknowledgement
is required for **every** flash, bundled releases and stock included. RCs carry a factual "Pre-release" label, and
the copied release notes are shown unchanged. Internal proof status belongs in docs and issues.

## Suggested order

Strictly 1 → 2 → 3 → 4, because the phases are stacked.

- Phase 1 is docs and rules only. D890 throughput is measured on the real flash in phase 4.
- Phase 3 finishes the DM-32UV end to end, including its prod flip, before the AT-D890UV starts.
- The owner can merge the stack through phase 3 to release the DM-32UV while phase 4 is in progress.

**If a gate fails:** an implementor fixes it on the **same branch** with new commits, re-pushes `dev`, and the
orchestrator stops again. No prod flip and no later phase happen on a failed gate.

**If the D890 flash is too slow:** the phase 4 hardware gate measures the real flash time and per-frame round trips
(recorded on #1364). If the owner asks, phase 4's optional pipe-optimisation slice is done as a fix on the same
branch before the prod flip. Pipelining frames ahead of their ACK stays rejected.

## Branch strategy

| # | Branch | Starts from | PR base |
| --- | --- | --- | --- |
| 1 | `1359/pskil/firmware-design` | `origin/main` | `main` |
| 2 | `1360/pskil/firmware-core` | phase 1 branch | phase 1 branch |
| 3 | `1363/pskil/firmware-dm32` | phase 2 branch | phase 2 branch |
| 4 | `1364/pskil/firmware-d890` | phase 3 branch (including its flip commit) | phase 3 branch |

- **Dev deploys:** `git push --force origin HEAD:dev`. The `dev` deploy uses `BUILD_ENV=dev`, so both radios are
  visible there whatever their prod flags say.
- **Planning branch:** `plan/modded-firmware-flasher` is an orphan branch and is never merged. Phase 3 copies only
  the two patch files and two notes files out of its `owner-inputs/`.

## Rules carried by every phase file

- **Vendor firmware never reaches `main` or any committed path**, test fixtures included. Our own patch files are
  fine.
- **Hard interlocks are code**, and never configurable.
- **Layer rules:**
  - radio facts in core `firmware.ts`;
  - patch formats in `src/core/firmware/patch/formats/<name>/`;
  - bootloader protocols in `src/integrations/radio-io/radios/<id>/firmwareUpdate/`;
  - no radio literals in `src/app/`;
  - the app imports radio-io only via `@integrations/radio-io`. The exception is the existing debug page, which
    phase 1 extends (accepted by the owner).
- **Docs ship with behaviour.**
- **UI copy is for operators.**
