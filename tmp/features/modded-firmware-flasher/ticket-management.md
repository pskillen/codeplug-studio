# Tickets: modded firmware flasher

These tickets are **already filed**: epic [#1358](https://github.com/pskillen/codeplug-studio/issues/1358) (under
[#594](https://github.com/pskillen/codeplug-studio/issues/594), milestone M2: post-MVP), children #1359 to #1366, plus follow-ups #1367 and #1368. The children
were filed before the design, and their bodies were then **rewritten on 2026-10-21** to match
[hl-delivery-plan.md](hl-delivery-plan.md) and the owner decisions below, and revised again the same day for the
per-radio prod gate. This file maps the design onto those tickets.
It also records size, priority, the open-question owner for each ticket, and the dependency graph that `phase-plan.md`
will sequence. The initial delivery needs no new issues. The two follow-ups are listed at the end.

**Phases (revised 2026-10-21: consolidated to 4):** see [phase-plan.md](phase-plan.md).

| Phase | Tickets | PR closes |
| --- | --- | --- |
| 1 | #1359 | #1359 |
| 2 | #1360, #1361 | #1360, #1361 |
| 3 | #1363, #1362, #1365 slices 1–2, DM-32UV prod flip | #1363, #1362 |
| 4 | #1364, #1365 slice 3, #1366, AT-D890UV prod flip | #1364, #1365, #1366 |

Sizes are rough. **S** is one small PR, **M** is a few slices in one PR, and **L** is a multi-PR mini-series that
`phase-plan.md` must split.

**Ground truth.** On *what* ships, `hl-delivery-plan.md` wins. Where it and its "Owner decisions (2026-10-21)" table
disagree, the table wins.

| Decision | Effect on tickets |
| --- | --- |
| OQ1: accept bundling patches (option a) | #1362 bundles the published bytes as-is. There is no derived or stripped patch, and `patchSha256` is the published hash |
| OQ2 (**revised 2026-10-21**): per-radio prod gate | Each `FirmwareUpdaterDescriptor` carries its own `prodFlashDisabled` (name to settle), on the same pattern as `prodWriteDisabled` / `radioWriteEnvGate.ts`. A flagged radio is hidden on the prod build and fully available on next, dev and staging, with no Capacitor exemption. Both radios start disabled. Each is flipped once **that radio** is proven on hardware, independently of the other, as the **final commit in that radio's phase PR** (phase 3 for the DM-32UV, phase 4 for the AT-D890UV). **Proven** (owner, revised 2026-10-21) means Studio's updater has flashed **at least one of our patched releases** to that radio on hardware. Stock flash is built and offered as the recovery path, with **no** hardware gate: both firmware projects' own flashers have flashed stock many times. The flag goes in #1363 (seam), and the resolver and tests in #1365. This supersedes "no flag" and the earlier "merge the D890 unregistered" idea (see [Prod gate and delivery](#prod-gate-and-delivery)) |
| OQ4: release notes copied into Studio next to each patch | #1362 commits a notes file per release, and its index row points at it. #1365 shows the notes. Nothing links to the private repos |
| UI copy (owner, 2026-10-21) | All user-facing strings are written for an end-user operator, with no internal or test-status notes. The `stockFlashHardwareProven` descriptor field and the "not yet hardware-proven" stock label are **removed** from the plan. Proof status lives in docs and issues |
| OQ9: defer Android; hide on Capacitor | #1363 sets `capacitorSupported: false` on both descriptors, and #1365 hides the route on Capacitor with a message. Android support is a follow-up |
| Boundary breaches in existing code: ignore for now | No ticket fixes them, and none copies them. One sanctioned exception (owner-confirmed): phase 1 adds a pass to the existing `DebugD890EraseProbePage`, which already imports the radio module directly |
| Vendor firmware (owner, 2026-10-21) | Our patch files on `main` are fine. **Vendor firmware files must never reach `main` or any committed path**, test fixtures included. Every phase file that touches fixtures or stock handling states this |
| Pushing to `dev` (owner, 2026-10-21) | The orchestrator or an implementor may force-push a phase branch to `dev` (deploys `dev.codeplug.mm9pdy.net`) without asking: it is a playground. At each hardware gate the orchestrator pushes, then stops and notifies the owner |
| Release notes received (owner, 2026-10-21) | Studio copies at `owner-inputs/{dm32,d890}/1.0.0.release-notes.md`; the DM-32 notes were rewritten from the firmware repo's features guide. All #1362 inputs are in hand |

The other OQs keep the design's proposed defaults. Each is assigned to the ticket that owns it in
[Open questions: owners](#open-questions-owners).

## Delivery model (owner, 2026-10-21)

**Orchestrator agent, with a stop after every phase and every hardware gate.**

- The orchestrator drives **4 phases** on stacked branches. After each phase, and at each hardware gate inside one, it
  stops and notifies the owner, and continues only once the owner replies.
- In phases 3 and 4, after the owner confirms the bundled `1.0.0` flash, an implementor adds **one final commit** on
  the same branch that sets the radio's `prodFlashDisabled: false`.
- **The owner runs every physical hardware test.** For a hardware test, the phase's branch is pushed to `dev`, which
  deploys to `dev.codeplug.mm9pdy.net`. The owner tests there with the radio attached. The per-radio prod flags keep the
  flasher hidden on prod throughout.
- **This epic owns `dev` for its duration.** At each hardware gate the implementor force-pushes the phase branch to
  `dev`, and the orchestrator checks it, then stops and notifies the owner.
- **Planning files live on the orphan branch `plan/modded-firmware-flasher`** (never merged). Containers are reclaimed
  between phases, so every phase file bootstraps from a bare clone: fetch that branch, re-clone the firmware repos
  read-only if needed, and use the GitHub MCP tools (`gh` is unauthenticated).
- The phase table, gates and branches are in [phase-plan.md](phase-plan.md); the per-phase files are in
  [plans/](plans/00-README.md).

---

## Design section → ticket map

| hl-delivery-plan.md section | Ticket |
| --- | --- |
| Appendix A (DESIGN.md text, Glossary, Non-goals, revision log); AGENTS.md line and agent rule (OQ13) | #1359 |
| 3.1 core types, `hash.ts`, `hex.ts`, `errors.ts` | #1360 (shared with #1361: whichever lands first creates `types.ts`) |
| 3.2 pinned stock descriptors (`firmware.ts` × 2) | #1360 |
| 3.3 `resolveStockFirmware`, `StockSource` | #1360 |
| 3.6 `prepareFirmwareImage`, **stock target** + `PreparedFirmwareImage` brand | #1360 |
| 3.4 patch formats (`baofeng-dm32-firmware`, `anytone-d890-firmware`) + dispatcher | #1361 |
| 3.5 release catalog, sources, raw-bytes loading, repo hygiene, catalog test, release notes (OQ4) | #1362 |
| 3.6 `prepareFirmwareImage`, **patch target** | #1362 |
| 3.7 `FirmwareUpdater` seam, firmware registry, guarded send, `'interlock'` error, transport filters | #1363 |
| 3.8 DM-32UV updater + mock; 3.10 DM-32UV interlocks | #1363 |
| 3.9 AT-D890UV updater + mock; 3.10 AT-D890UV interlocks; throughput (spike dropped; measured on the real flash) | #1364 |
| 3.12 app orchestration (`firmwareFlash.ts`); UI changes (route, nav, wizard, wake lock, Stepper) | #1365 |
| 3.11 flash stock (recovery): picker entry | #1365 (slice 1: stock is the only target) |
| 3.11 flash stock (recovery): recovery docs and links (the data-driven "not yet proven" label in 3.11 is **dropped**, owner 2026-10-21) | #1366 |
| Consumer changes table | Split by row: transport and kit rows go to #1363; `App.tsx`, nav and Reference index go to #1365; `.prettierignore` and `.gitattributes` go to #1362; DESIGN.md and AGENTS.md go to #1359; docs rows go to their ticket (see [Documentation by ticket](#documentation-by-ticket)) |
| Test fixtures (synthetic stock, `makeSyntheticPatch`, owner example patches, local `CODEPLUG_FIRMWARE_STOCK_DIR` check) | #1361 (synthetic patches), #1362 (bundled and non-shipping real patches, local stock check) |
| 3.13 vendor-neutral note | Applies to every ticket. Each phase file restates it |

---

## Group A: design gate

### #1359 docs(design): firmware flashing section in DESIGN.md + delivery plan

**Size:** S · **Priority:** P0 (gate for everything) · **Depends on:** none

Paste Appendix A into DESIGN.md after "Import and export". Add the four Glossary rows, the Non-goals line and the
revision-log row. OQ13 is proposed, not decided: add the AGENTS.md principle line and the path-scoped rule
`.claude/rules/firmware-flashing.md`, mirrored to `.cursor/rules/firmware-flashing.mdc`, unless the owner drops them.

- [ ] DESIGN.md has the Firmware flashing section (rules 1 to 6, patch sources, placement, future direction), Glossary rows, Non-goals line and revision-log row.
- [ ] The DESIGN.md text reflects the owner decisions: bundled patches accepted, release notes in Studio, a per-radio prod gate (separate from Write's `radioWriteEnvGate`), web only (Capacitor hidden). Appendix A now says this: rule 6 refers to Write's env gate only, and rule 7 is the per-radio prod gate (updated on the planning branch).
- [ ] If OQ13 is kept: an AGENTS.md principle line, and the rule exists in both tool directories with identical content.
- [x] The design is reviewed (owner decisions, 2026-10-21). Ticked on the issue.
- Tests: none (docs only).

---

## Group B: core foundations

### #1360 feat(firmware): pin stock firmware per radio and verify user-supplied stock

**Size:** M · **Priority:** P1 (blocks #1362, #1363, #1365) · **Depends on:** #1359

Design 3.1, 3.2, 3.3, and the stock half of 3.6. This ticket creates the core firmware foundation:

- types, the SHA-256 and hex helpers, and `FirmwareError`;
- both radios' `firmware.ts`: stock pins, update-mode entry text, the verify hint, and the DM-32UV image constants;
- `resolveStockFirmware` and `createUserFileStockSource`;
- `prepareFirmwareImage` for the **stock** target only, with the `PreparedFirmwareImage` brand.

Tier-3 `firmware.md` for both radios, stock pin section only.

- [ ] Both `firmware.ts` files match the firmware repos' `tools/ci/fetch-stock.sh` and `stock-zip.sha256` values in the design (3.2).
- [ ] A zip is inflated only for member basenames. Test: a synthetic zip with a large decoy entry that is never inflated, and a duplicate-member zip is refused.
- [ ] Refusal tests, each with a specific `FirmwareErrorCode`: wrong hash (`stock-wrong-version`), missing member, duplicate member, corrupt zip, the other radio's synthetic stock (`stock-wrong-radio`), and bytes matching a supplied "result" hash (`stock-is-patched`).
- [ ] OQ5 default: a re-zipped zip with matching members is accepted, with `zipMismatchNoted: true`.
- [ ] `prepareFirmwareImage({ target: { kind: 'stock' } })` returns provenance `stock` and the descriptor's verify hint. The input buffers are untouched (test by mutating the output).
- [ ] No vendor bytes are committed. Tests pass synthetic descriptors, never the real `firmware.ts` pins.
- [ ] `docs/reference/radios/{baofeng/dm-32uv,anytone/at-d890uv}/firmware.md` (stock section) and a `README.md` map row for each.

### #1361 feat(firmware): apply D890 and DM-32 release patches in the browser

**Size:** M · **Priority:** P1 (blocks #1362) · **Depends on:** #1359. Shares `src/core/firmware/types.ts` and `hash.ts` with #1360. If #1360 has not merged, this ticket creates the minimum it needs.

Design 3.4. `FirmwarePatchFormat<P>`, `parseFirmwarePatch` and `applyFirmwarePatch`, plus one module per patch `name`
and a test-only `makeSyntheticPatch.ts` for each.

- [ ] DM-32 cases are ported from `baofeng-dm32-firmware/fw/test_make_patch.py` (synthetic images).
- [ ] D890 cases are **rewritten** onto a synthetic `.CDD`/`.CDI`/`.spi`. The source tests read real stock through `stock.stock_dir()`.
- [ ] Refusals: wrong stock, bad `original`, a gap, wrong result, malformed hex or types, an out-of-range or unequal-length hook, a wrong append offset, an unknown `name` or `format`.
- [ ] Apply never mutates its input package (test).
- [ ] `describe()` returns role-keyed `stock`/`result`. Generic code never sees `.CDD`.
- [ ] `readVersionStamp` (DM-32 `version_slot`) returns NUL-trimmed ASCII.
- Docs: none user-facing. Patch-format notes go in each radio's tier-3 `firmware.md` only if #1360 has created it; otherwise #1362's maintainer doc covers them.

### #1362 feat(firmware): bundled release catalog (finals + RCs) and user-supplied patch source

**Size:** M · **Priority:** P2 (wizard slice 2 needs it; DM-32 stock does not) · **Depends on:** #1360, #1361

Design 3.5 and the patch half of 3.6, with OQ1, OQ4, OQ7 and OQ14 applied:

- `BundledFirmwareRelease` index with copied release notes (OQ4);
- `bundledFirmwareReleaseSource`, which lazily loads `?raw` bytes and self-checks the hash (OQ7);
- `createUserPatchSource`, which identifies a file matching a bundled release;
- the `prepareFirmwareImage` patch target;
- seed DM-32UV `1.0.0` and AT-D890UV `1.0.0` finals (OQ14);
- the `.prettierignore` and `.gitattributes` hygiene;
- the catalog test, and a local-only stock check gated on `CODEPLUG_FIRMWARE_STOCK_DIR`.

- [ ] `npm run format` leaves both `*.patch.json` files byte-identical, and the catalog test passes after it.
- [ ] The catalog test covers every rule in design 3.5, plus "the notes file exists".
- [ ] `listReleases({ includeRc: false })` returns finals only, newest first. With `includeRc: true` it adds RCs (test with a synthetic RC row or fixture).
- [ ] A user file whose bytes equal a bundled patch comes back `bundled`, with the release attached. A different valid patch comes back `unreviewed`. A patch for the other radio fails with `patch-wrong-radio`.
- [ ] `prepareFirmwareImage` with a patch whose stock hashes differ from the pins fails with `patch-wrong-stock` before apply.
- [ ] The index row's notes and summary come from the Studio copy. No URL to `github.com/pskillen/*-firmware` appears in `src/`.
- [ ] The two published `.patch.json` files are committed byte for byte from the owner's inputs (below). The implementor must not fabricate or regenerate them.
- [ ] `docs/features/firmware-flashing/adding-a-release.md` (maintainer procedure). If the hub doesn't exist yet, this file can land alone; #1365 links it from the hub.

**Owner inputs (received 2026-10-21).** All of #1362's inputs are in hand: both patches and both sets of release notes. The
same status is recorded on #1362. They are on the planning branch under `owner-inputs/`.

| Input | Location (local, gitignored) | sha256 | Check against design 3.4 schema + pinned stock |
| --- | --- | --- | --- |
| DM-32UV `1.0.0` patch + `SHA256SUMS` | `owner-inputs/dm32/dm32-fw-1.0.0.patch.json` | `fb14da26d8248011d50b89fc8286c67fcbcabeb3b43ebf3d184afd7bc474bf9f` | **No mismatch.** Exactly the eight design keys; `format` 1, `name` `baofeng-dm32-firmware`, `version` `1.0.0`; `stock` equals the pin (`fda860fe…0f8f`, 860,416); `result.size` 860,416 (stock length, so the updater's length interlock passes); 29 segments, 2,389 bytes, no gaps or overlaps, valid lowercase hex; `neutral_sha256` 64-hex; `version_slot` `{offset: 856492, len: 24}` reads `1.0.0` |
| AT-D890UV `1.0.0` patch + `SHA256SUMS` | `owner-inputs/d890/d890-fw-1.0.0.patch.json` | `bd9e32812a89d91fdb548f6dddbea81f7de65c3d8c096e87ed20c82487f68b1f` | **No mismatch.** Exactly the seven design keys; `format` 1, `name` `anytone-d890-firmware`, `version` `1.0.0`; `stock` `.CDD`/`.CDI`/`.spi` equal the V1.05 pins; 35 hooks (136 bytes), equal length to their originals, inside the stock `.CDD`, no overlaps; `append.offset` 1,675,272 equals the stock `.CDD` size; result `.CDD` 1,680,476 equals stock plus the 5,204-byte append; `.CDI` 278 and `.spi` 51 unchanged in size |
| Release notes for both `1.0.0` releases | `owner-inputs/{dm32,d890}/1.0.0.release-notes.md` | — | **Received.** Studio copies; the DM-32 notes were rewritten from the firmware repo's features guide. Their "Checking it worked" lines give the verify hints: DM-32 "Scan on a channel with no scan list starts a zone scan"; D890 "Device Info > Version shows `1.0.0`" |

Implementation notes from the check (not mismatches):

- Both files are ASCII, LF-only, and byte-identical to Python `json.dump(..., indent=1)` plus a trailing newline. That
  confirms the design's assumption that UTF-8 re-encoding under `?raw` keeps the bytes, and why the
  `.prettierignore` / `.gitattributes` hygiene is needed.
- The two `SHA256SUMS` files differ in format. The D890 one names the file `./d890-fw-1.0.0.patch.json`; the DM-32 one
  has no `./`. Anything that parses `SHA256SUMS`, such as the maintainer procedure or a helper script, must accept both.
  The catalog test compares against the index row, so it is unaffected.
- The D890 append (5,204 bytes) is not a multiple of 32, so the last data frame is zero-padded. Frame count is
  `ceil(len / 32)` per `.CDI` entry, not `append.length / 32` as design 3.9 says; for one entry that's 52,515 frames.
  #1364's frame-count test should use the ceiling.
- The DM-32 `version_slot` (24 bytes) is only partly covered by a segment, which writes the 5 bytes of `1.0.0`; the
  rest is stock bytes. `readVersionStamp` must read the slot from the **result image** (as design 3.4 says), not
  from the segment data.

---

## Group C: radio I/O

### #1363 feat(radio-io): firmware updater seam + DM-32UV bootloader updater

**Size:** M/L · **Priority:** P1 (blocks #1364, #1365) · **Depends on:** #1360 (for `firmware.ts` constants and `PreparedFirmwareImage`)

Design 3.7, 3.8 and 3.10 (DM-32UV rows). It adds:

- the seam: `firmware/types.ts`, `registry.ts`, `guardedSend.ts`, `errors.ts`;
- the kit's `'interlock'` code and `RadioInterlockError`;
- `requestWebSerialPort(forceSelection, filters?)`;
- the DM-32UV `firmwareUpdate/` module (constants, plan, interlocks, updater, descriptor) and the mock ported from `tools/flash/bootloader_mock.py`;
- `capacitorSupported: false` (OQ9);
- the per-radio `prodFlashDisabled` field on `FirmwareUpdaterDescriptor` (revised OQ2), with the DM-32UV set to `true`.

- [ ] The plan for a synthetic stock-length image has 1,688 frames, and its golden frames (block 0, the first two data blocks, the last block) match an independent derivation in the style of `tools/cps/cps_fw_frames.py`.
- [ ] The tests ported from `tools/flash/test_dm32_fw_send.py` pass (the list in design 3.8), including **exactly one `pipe.write` call site** in the updater module.
- [ ] `checkImage` refuses: the wrong length, the wrong model ID, no `END` marker, and an image for the other radio. `flash()` re-runs the checks.
- [ ] A wrong ident aborts before step 7, with `radioTouched: false`. An abort after step 7 has `radioTouched: true`.
- [ ] Existing `requestWebSerialPort` callers are unchanged (their tests still pass). Filters reach `navigator.serial.requestPort`.
- [ ] OQ6 default: `flash()` continues the session `identify()` opened, with no pause.
- [ ] The descriptor has `prodFlashDisabled: true` (a test pins it until the flip PR).
- [ ] Hardware (phase 3 gate): bundled `1.0.0` flashed from `dev` and checked with **its verify hint**, not Device Info. On DM-32UV `1.0.0`, Device Info still reads `DM32.01.L01.048`. Stock flash is built but has no gate.
- [ ] **Closing step (last commit of phase 3):** after the owner confirms the gate, set the DM-32UV `prodFlashDisabled` to `false`.
- [ ] Tier-3 `dm-32uv/firmware.md`: update protocol, link facts, interlocks. The private firmware repo docs are named, not linked.

### #1364 feat(radio-io): AT-D890UV bootloader updater

**Size:** L · **Priority:** P2 · **Depends on:** #1363

Design 3.9 and 3.10 (AT-D890UV rows), with the OQ3 default (band-byte interlock on). **The separate throughput spike
was dropped** (owner, 2026-10-21): a Studio D890 codeplug write already sends 16-byte `W` frames, each waiting for its
own ACK, and its write phase takes about 10 to 15 s in an active tab. Instead, the updater measures per-frame round
trips and total duration on every real flash, and the phase 4 hardware gate records them on #1364. The wizard's
duration text is then set from that measurement.

**The updater:**

- [ ] `package.ts`, `frames.ts`, `interlocks.ts`, `updater.ts`, `descriptor.ts`, the firmware-mode `MockBootloader` port, and the firmware-mode cases from `tools/test_d890update.py` (the list in design 3.9).
- [ ] Every interlock in design 3.10 (AT-D890UV rows) has a refusal test, including the band byte and resource mode (14-byte `.spi`).
- [ ] End handling: port closed after `18` gives `port-closed-by-radio` (success); closed before `18` is an error; a timeout after `18` gives `no-reply`.
- [ ] A 52,353-frame synthetic run against the mock has its time recorded. The frame count for a patched package is `ceil(len / 32)` per `.CDI` entry; for `1.0.0` that is 52,515.
- [ ] The descriptor is **registered normally**, with its own `prodFlashDisabled: true`. It is hidden on prod until #1366 flips it, so there is no need to hold registration back.
- [ ] One `pipe.write` call site.
- [ ] Hardware (phase 4 gate): bundled `1.0.0` is flashed from `dev`, Device Info > Version shows it, and the duration is posted to #1364.
- [ ] **Closing step (last commit of phase 4):** after the owner confirms, set the AT-D890UV `prodFlashDisabled` to `false`.
- [ ] Tier-3 `at-d890uv/firmware.md`: update protocol, interlocks.

---

## Group D: app

### #1365 feat(app): firmware flasher wizard

**Size:** L (three slices, so three phases) · **Priority:** P1 (slice 1), P2 (slices 2, 3) · **Depends on:** slice 1 needs #1360 and #1363; slice 2 needs #1362; slice 3 needs #1364 part 2

Design UI changes and 3.12, with the OQ6, OQ10, OQ11 and OQ12 defaults, the revised OQ2 (per-radio prod gate) and OQ9
(hidden on Capacitor).

**Slice 1: DM-32UV, stock only.**

- [ ] **Prod gate resolver:** `src/app/services/firmwareFlashEnvGate.ts` (name to settle), modelled on `radioWriteEnvGate.ts`. `resolveFirmwareFlashGate(descriptor, buildEnv = __BUILD_ENV__): 'hidden' | 'allowed'` returns `'hidden'` when `buildEnv === 'prod'` and `prodFlashDisabled` is set; otherwise `'allowed'`. It reuses `isProdBuildEnv`, and has **no Capacitor exemption** (the Write gate has one).
- [ ] Gate tests: pure resolver cases (prod and flag gives hidden; dev, next and staging give allowed; no flag gives allowed; Capacitor is not exempt), plus a wizard test where a gated radio is not offered on prod.
- [ ] Proposed: when no radio is allowed (prod, before the first flip), the Tools strip entry is hidden and `/firmware` shows a short "not available on this site yet" message.

- [ ] Route `/firmware` outside `RequireActiveProject`; "Firmware flasher" in `toolsStripItems`, and the strip resolver maps `/firmware` to Tools.
- [ ] Radio cards come from `listFirmwareUpdaters()`. Only DM-32UV is registered at this point.
- [ ] Release step shows "Stock firmware (v1.01.048)" only; the patch UI is not rendered until slice 2.
- [ ] Stock step: the vendor link (`rel="noopener noreferrer"`), the expected names, a FileDropzone (`multiple`), and verified/failed states that carry the `FirmwareError` message.
- [ ] Prepare, preflight (with the OQ11 context-sensitive Backup link), update-mode steps rendered from `descriptor.stock.bootloaderEntry`, then one "Connect and flash" action (filtered port re-pick, identify, flash).
- [ ] `useScreenWakeLock` (new, tested) and `useUnsavedNavigationGuard` are active while flashing.
- [ ] Cancel is confirmed once `radioTouched`. The failure screens split on `radioTouched`, and `onRetry` restarts from update mode.
- [ ] The summary can be copied and downloaded as `.txt`, and is never persisted (OQ10).
- [ ] On Capacitor the route is hidden or shows the unsupported message (OQ9). Without Web Serial it shows `getRadioSerialUnsupportedMessage`.
- [ ] `src/app/` has no radio literals, USB IDs or wire bytes: everything comes from the registry and descriptors.
- [ ] Stepper (OQ12 default): reusable v2 `Stepper` with sidecar `Stepper.md` and a styleguide demo.
- [ ] (No hardware gate for the stock path; the owner may flash stock optionally during phase 3's gate.)
- [ ] Docs: the `docs/features/firmware-flashing/README.md` hub (status table, map, concepts, recovery placeholder), a `docs/features/README.md` row, a `radio-read-write/README.md` row, and the `modded-firmware/README.md` cross-link. (The `adding-a-radio-adapter.md` "Firmware updater" section moved to #1363, phase 5.)

**Slice 2: bundled releases and user patches (DM-32UV).**

- [ ] The release list shows finals with a "Show release candidates" toggle. Each row shows the summary and the Studio copy of its notes (unchanged). RCs carry a factual "Pre-release" label. **No** tested/untested pills: the UI makes no test-provenance claims (owner, 2026-10-21). A risk acknowledgement is required for every flash.
- [ ] Advanced "Use a patch file from disk": the risk statement and "I understand" gate, or "This is release X (bundled)" when the file matches.
- [ ] The summary records provenance (`user-supplied patch, sha256 …`).
- [ ] The done step shows the release's `verifyHint`.
- [ ] Hardware (phase 3 gate): DM-32UV `1.0.0` flashed from `dev`, and checked with its verify hint. This makes the DM-32UV **proven**; the prod flip is the final commit of the same PR.
- [ ] The hub's status table is updated.

**Slice 3: AT-D890UV.**

- [ ] The D890 descriptor is registered and the wizard shows it on pre-prod. It stays prod-hidden through its own `prodFlashDisabled: true` until phase 4's final commit.
- [ ] Hardware (phase 4 gate): D890 `1.0.0` flashed end to end from `dev` (#1364's hardware box; the D890's proof). Cancel and unplug mid-flash show the recovery screen.
- [ ] The hub's status table is updated.

---

## Group E: recovery

### #1366 feat(firmware): flash stock firmware as the recovery path

**Size:** S · **Priority:** P2 · **Depends on:** #1365 slice 3 (so on #1364)

Design 3.11. The picker entry has already shipped in #1365 slice 1. This ticket owns the recovery route's docs and
links. Revised 2026-10-21 (owner):

- there is **no stock hardware gate** (both firmware projects' flashers have flashed stock many times);
- there is **no** "not yet proven" label in the UI (operator copy only).

- [ ] The stock entry is offered for both radios with operator-facing copy only.
- [ ] The hub has a recovery section (re-enter update mode, flash stock or the same release, don't keep power-cycling, vendor CPS fallback for both radios). It is linked from the wizard's failure screen and `docs/features/modded-firmware/README.md`.

---

## Open questions: owners

| OQ | Status | Default carried | Owning ticket |
| --- | --- | --- | --- |
| 1 Bundling legal | **Decided**: accept | Patches bundled as published | #1362 |
| 2 Prod availability | **Decided, revised**: per-radio prod gate | `prodFlashDisabled` per updater; flipped once a patched release is flashed on hardware | #1363 (field + DM-32 flip), #1364 (D890 field + flip), #1365 (resolver) |
| 3 D890 band-byte interlock | Default | Yes, require `ident[8] === 0x00` | #1364 |
| 4 Release notes | **Decided**: copy into Studio next to each patch | Notes file per release + index row | #1362 (data), #1365 slice 2 (display) |
| 5 Zip vs member hashes | Default | Members authoritative; re-zip accepted with a note | #1360 |
| 6 Pause between ident and flash | Default | No pause; one "Connect and flash" | #1363 (contract), #1365 (UX) |
| 7 Patch byte loading | Default | `?raw` dynamic import | #1362 |
| 8 `FirmwareRadioId` values | Default | Reuse stock radio-target ids | #1360 |
| 9 Android | **Decided**: defer, hide on Capacitor | `capacitorSupported: false` | #1363 (flag), #1365 (hide) |
| 10 Flash log persistence | Default | Not persisted; copy and download only | #1365 |
| 11 Backup before flashing | Default | Context-sensitive link + guidance; no in-flasher backup | #1365 |
| 12 Step indicator | Default | Reusable v2 `Stepper` with sidecar and demo | #1365 slice 1 |
| 13 Agent rules | Proposed (no explicit default) | Add the AGENTS.md line + mirrored rule unless dropped | #1359 |
| 14 Releases to seed | Default | Finals only (`1.0.0` × 2) | #1362 |

Every numbered OQ has an owner. None of the defaults changes the model shape. If the owner overturns OQ7 (base64 `.ts`
instead of `?raw`), only #1362 changes. If the owner overturns OQ12 (page-local steps), only #1365 slice 1 changes.

## Prod gate and delivery

With the revised OQ2, each radio is **hidden on prod** until its own `prodFlashDisabled` flag is flipped. Everything else
on `main` ships to prod with the next full Studio release as usual. So:

- **Merging is decoupled from prod exposure.** Wizard slices and updaters can merge once their unit tests and (where
  the phase has one) the owner's hardware test on `dev` pass. A prod user never sees an unproven radio.
- **Both AT-D890UV pieces register normally.** The earlier "merge #1364 part 2 unregistered" idea is dropped.
- **The flips are the final commit of each radio's phase PR**, made after the owner confirms that radio's bundled
  `1.0.0` flash from `dev` (Studio flashing a patched release on hardware is the whole definition of proven):
  - DM-32UV: the last commit of phase 3, closing #1363;
  - AT-D890UV: the last commit of phase 4.

  The two flags are independent.
- **Prod before any flip:** the Tools strip entry is hidden and `/firmware` shows a short "not available on this site
  yet" message. This is proposed in #1365.

## Documentation by ticket

| Ticket | Docs it ships |
| --- | --- |
| #1359 | DESIGN.md section, Glossary, Non-goals, revision log; AGENTS.md line + rule (OQ13) |
| #1360 | `docs/reference/radios/<mfr>/<model>/firmware.md` stock section × 2, plus the `README.md` map rows |
| #1361 | Nothing user-facing (tier-3 patch notes optional) |
| #1362 | `docs/features/firmware-flashing/adding-a-release.md`; release-notes files beside each patch |
| #1363 | `dm-32uv/firmware.md` update protocol + interlocks; `adding-a-radio-adapter.md` "Firmware updater" checklist |
| #1364 | `at-d890uv/firmware.md` update protocol + interlocks; measured flash time posted on the issue |
| #1365 | Hub `docs/features/firmware-flashing/README.md` (status table per slice), `docs/features/README.md` row, `radio-read-write/README.md` row, `modded-firmware/README.md` link, `adding-a-radio-adapter.md` firmware section, `Stepper.md` sidecar |
| #1366 | Hub recovery section and cross-links |

---

## Suggested implementation order

```text
#1359  DESIGN.md gate
  │
  ├──► #1360  core foundation + stock + prepare(stock)
  │      │
  │      ├──► #1363  seam + DM-32UV updater
  │      │      │
  │      │      ├──► #1365 slice 1  DM-32UV stock wizard (+ hardware: #1363, #1366 DM-32 boxes)
  │      │      │
  │      │      └──► #1364  D890 updater + mock (measures real flash timing)
  │      │
  │      └──► #1362  catalog + user patch + prepare(patch)   ◄── #1361
  │                    │
  │                    └──► #1365 slice 2  releases + user patch (DM-32UV)
  │
  └──► #1361  patch formats (parallel with #1360; whichever lands first creates types.ts)

#1365 slice 2 + #1364 ──► #1365 slice 3  AT-D890UV in the wizard (+ hardware)
                                        │
                                        └──► #1366  recovery docs (no stock gate)
```

Can run in parallel once their prerequisite lands:

- #1360 ∥ #1361. They share `types.ts`, so in a stacked series run #1360 first.
- #1362 ∥ #1363, both after #1360; #1362 also needs #1361.
- #1365 slice 1 ∥ #1362 ∥ #1364, all after #1363 (#1362 also needs #1361).

**Hardware gates** (owner with radios, on `dev.codeplug.mm9pdy.net`):
the phase 3 DM-32UV `1.0.0` flash and the phase 4 AT-D890UV `1.0.0` flash (which also records the measured flash time). There
is no stock gate. The orchestrator stops at each gate and resumes only on the owner's reply ([Delivery model](#delivery-model-owner-2026-10-21)).

## Not included here: future and dependent work

Filed as **follow-ups** on 2026-10-21. They are sub-issues of #1358 but sit outside the dependency chain, and the epic
can close without them:

- [#1367](https://github.com/pskillen/codeplug-studio/issues/1367) **Android / Capacitor flashing** (OQ9 follow-up).
  Needs DTR/RTS control in the Capacitor plugin, device choice beyond `devices[0]`, OTG enumeration tested in update
  mode, and an OTG round-trip measurement for the D890. `capacitorSupported` is flipped per radio. There is no
  Capacitor exemption from the prod gate.
- [#1368](https://github.com/pskillen/codeplug-studio/issues/1368) **DM-32UV read-back verify after flash.** A
  read-only `0x47` app-region read (ported from the firmware repo's `dm32_backup.py --progflash app`), compared with the
  flashed image, which also shows the version stamp that Device Info doesn't.

Not planned:

- **In-flasher codeplug backup** (OQ11 alternative). Not planned.
- **Flash history** (OQ10 alternative). Not planned.
- **Proposal B (runtime fetch).** The seams exist (`FirmwareReleaseSource`, `StockSource`), and the legal blockers stand.
  Not planned.
- **Pre-existing boundary breaches** (direct radio-module imports in the app; stale "No backend" wording). Ignored on
  the owner's instruction. No ticket copies the pattern.
- **Firmware-repo hygiene** (stale "NEVER RUN ON HARDWARE" and "not run" docs in the private repos; DM-32 issue #39).
  This lives in those repos, not Studio.
