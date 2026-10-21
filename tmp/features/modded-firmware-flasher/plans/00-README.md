# Modded firmware flasher: plan series index

Execution plans for epic [#1358 Modded firmware flasher](https://github.com/pskillen/codeplug-studio/issues/1358),
under [#594 Browser radio I/O](https://github.com/pskillen/codeplug-studio/issues/594).

- Design rationale: [../hl-delivery-plan.md](../hl-delivery-plan.md)
- Ticket map: [../ticket-management.md](../ticket-management.md)
- Phase sequencing and the delivery model: [../phase-plan.md](../phase-plan.md)

**13 phases, one PR each, stacked.**

- The orchestrator drives them and spawns one `implementor` per phase.
- Phase 1 branches from `origin/main`. Phase N branches from phase N-1's branch, and its PR targets that branch.
- The orchestrator never merges.
- **After every phase the orchestrator stops, notifies the owner, and waits for their reply.**
- Hardware-gated phases are force-pushed to `dev` (`https://dev.codeplug.mm9pdy.net`) before that stop.
- Only the owner touches hardware.

Each plan file is written so that a fresh agent, on a **fresh cloud container**, can execute it **without reading any
other phase file**. Every phase file starts with a Bootstrap section, which:

- fetches the orphan planning branch `plan/modded-firmware-flasher`, where these files and the owner inputs live;
- re-clones the private firmware repos read-only when needed;
- notes that `gh` is unauthenticated, so GitHub goes through the GitHub MCP tools.

**Exclusions carried from the design:**

- no Android flashing (hidden on Capacitor; follow-up [#1367](https://github.com/pskillen/codeplug-studio/issues/1367));
- no DM-32UV read-back verify (follow-up [#1368](https://github.com/pskillen/codeplug-studio/issues/1368));
- no runtime fetch of releases or stock;
- no resource-mode (ICON pack) flashing;
- **no vendor firmware committed anywhere, ever.**

## Phases

| # | File | What | Branch | Depends on | Gate after |
| --- | --- | --- | --- | --- | --- |
| 1 | [01-design-section.md](01-design-section.md) | DESIGN.md Firmware flashing section; AGENTS.md line; firmware-flashing rule | `1359/pskil/firmware-design` | — | review |
| 2 | [02-d890-roundtrip-spike.md](02-d890-roundtrip-spike.md) | Read-only D890 round-trip timing pass on `/debug/d890-erase-probe` | `1364/pskil/d890-roundtrip-spike` | 1 | **H1** owner measures |
| 3 | [03-core-stock-foundation.md](03-core-stock-foundation.md) | Core firmware types, stock pins, `resolveStockFirmware`, `prepareFirmwareImage` (stock) | `1360/pskil/firmware-stock-pins` | 2 | review |
| 4 | [04-patch-formats.md](04-patch-formats.md) | Patch parse/apply for both formats | `1361/pskil/firmware-patch-formats` | 3 | review |
| 5 | [05-updater-seam-dm32.md](05-updater-seam-dm32.md) | `FirmwareUpdater` seam, interlock error, USB filters, DM-32UV updater + mock | `1363/pskil/firmware-updater-dm32` | 4 | review |
| 6 | [06-wizard-dm32-stock.md](06-wizard-dm32-stock.md) | `/firmware` wizard (DM-32UV stock), prod gate, wake lock, Stepper, hub | `1365/pskil/firmware-wizard-dm32-stock` | 5 | **H2** DM-32UV stock flash |
| 7 | [07-release-catalog.md](07-release-catalog.md) | Bundled `1.0.0` patches + notes, catalog, user patch source, patch-target prepare | `1362/pskil/firmware-release-catalog` | 6 | review |
| 8 | [08-wizard-releases.md](08-wizard-releases.md) | Wizard: releases, RC toggle, notes, user patch | `1365/pskil/firmware-wizard-releases` | 7 | **H3** DM-32UV `1.0.0` flash |
| 9 | [09-dm32-prod-enable.md](09-dm32-prod-enable.md) | DM-32UV `prodFlashDisabled: false` | `1363/pskil/dm32-flash-prod-enable` | 8 + owner confirms H2 and H3 | review |
| 10 | [10-d890-updater.md](10-d890-updater.md) | AT-D890UV updater + mock, registered prod-hidden | `1364/pskil/d890-firmware-updater` | 9 | review |
| 11 | [11-wizard-d890.md](11-wizard-d890.md) | Wizard: AT-D890UV end states, throttling, stock label | `1365/pskil/firmware-wizard-d890` | 10 | **H4** D890 `1.0.0` flash |
| 12 | [12-stock-recovery.md](12-stock-recovery.md) | Recovery docs + failure-screen link | `1366/pskil/firmware-stock-recovery` | 11 | **H5** D890 stock flash |
| 13 | [13-d890-prod-enable.md](13-d890-prod-enable.md) | AT-D890UV `prodFlashDisabled: false`, stock label cleared | `1366/pskil/d890-flash-prod-enable` | 12 + owner confirms H4 and H5 | review |

**Order:** strictly in the order shown, because each phase is stacked on the one before. Phase 2 runs early to
retire the D890 throughput risk before any D890 code exists. The DM-32UV is finished and enabled (phases 3 to 9)
before the AT-D890UV starts. Phases 9 and 13 are one-line prod flips. They start only after the owner has confirmed
that the radio is **proven**: Studio has flashed both stock and at least one patched release on hardware.

## Git workflow (applies to every phase; each phase file restates its own branch values)

- **Repo:** `pskillen/codeplug-studio`.
- **GitHub:** `gh` is not authenticated in these containers. Use the GitHub MCP tools: `mcp__github__create_pull_request`,
  `mcp__github__add_issue_comment`, `mcp__github__issue_read`, and so on. They apply directly here. A comment ends
  with the footer `---` / `_Generated by [Claude Code](https://claude.ai/code)_`.
- **Branches:** check out the phase branch from `origin/<prior phase branch>` (phase 1: `origin/main`). The PR base
  is the prior phase branch (phase 1: `main`).
- **Commits:** atomic conventional commits at each checkpoint in the phase file (`feat`, `fix`, `docs`, `style`,
  `refactor`, `chore`; never the word "enhance").
- **Before the PR:** `npm run format` (commit any drift), then
  `npm run format:check && npm run lint && npm run test && npm run build`, all green.
- **Docs** ship in the same PR as the behaviour, per `.claude/rules/documentation-deliverables.md`.
- **Dev deploy** (hardware phases only): `git push --force origin <phase-branch>:dev`. `dev` is a playground, so no
  permission is needed.
- **Never merge.** Never commit anything from `plan/modded-firmware-flasher` except the owner inputs that phase 7
  copies on purpose. Never commit vendor firmware.

## Instructions

- [ORCHESTRATOR-INSTRUCTIONS.md](ORCHESTRATOR-INSTRUCTIONS.md): what the orchestrator reads before it starts.
- [AGENT-INSTRUCTIONS.md](AGENT-INSTRUCTIONS.md): the prompt template the orchestrator uses for each implementor
  spawn. A human can also paste it into an `implementor` session by hand.
