# Firmware flashing

Studio can flash firmware to a supported radio over Web Serial, from the **Firmware flasher** under Tools
(`/firmware`). It is for operators who want to put a community firmware release on their radio, or put the vendor's
stock firmware back, without the vendor's programming software.

Firmware belongs to the physical radio, not to a project, library or build. The flasher needs no open project, never
touches the codeplug, and stores nothing. Product rules: [DESIGN.md — Firmware flashing](../../../DESIGN.md#firmware-flashing).

**Tracking:** epic [#1358](https://github.com/pskillen/codeplug-studio/issues/1358).

## Implementation status

| Area                | Status                       | Notes                                                                                                                                                               |
| ------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DM-32UV stock flash | Shipped (pre-prod)           | Wizard, updater and interlocks. Hidden on the prod site until the DM-32UV's prod gate is cleared ([#1363](https://github.com/pskillen/codeplug-studio/issues/1363)) |
| Bundled releases    | Catalog shipped; wizard next | DM-32UV and AT-D890UV `1.0.0` in `src/core/firmware/releases/`, verified by the catalog test ([#1362](https://github.com/pskillen/codeplug-studio/issues/1362))     |
| User patch          | Planned                      | Advanced option with a risk statement ([#1365](https://github.com/pskillen/codeplug-studio/issues/1365))                                                            |
| AT-D890UV           | Planned                      | [#1364](https://github.com/pskillen/codeplug-studio/issues/1364)                                                                                                    |
| Recovery docs       | Planned                      | [#1366](https://github.com/pskillen/codeplug-studio/issues/1366)                                                                                                    |
| Android             | Deferred                     | Hidden in the Capacitor app ([#1367](https://github.com/pskillen/codeplug-studio/issues/1367))                                                                      |

## Documentation map

| Doc                                                                                                                    | Topic                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [DESIGN.md — Firmware flashing](../../../DESIGN.md#firmware-flashing)                                                  | Product rules: no vendor firmware, pinning, interlocks, gates |
| [adding-a-release.md](adding-a-release.md)                                                                             | Maintainer procedure for bundling a release                   |
| [DM-32UV firmware.md](../../reference/radios/baofeng/dm-32uv/firmware.md)                                              | Stock pin, update mode, patch format, bootloader protocol     |
| [AT-D890UV firmware.md](../../reference/radios/anytone/at-d890uv/firmware.md)                                          | Stock pin, update mode, patch format                          |
| [Adding a radio adapter — Firmware updater](../radio-read-write/adding-a-radio-adapter.md#8-firmware-updater-optional) | Checklist for a new radio's updater                           |
| [Stepper.md](../../../src/app/components/v2/Stepper.md)                                                                | Wizard step indicator                                         |

## Concepts

- **Flash is not Write.** Codeplug Write sends a codeplug through a build; the flasher replaces the radio's program
  firmware through its bootloader. They share the Web Serial transport and nothing else: no build, egress or Write
  gate.
- **One pipeline.** Verify the user's stock firmware against the pinned hashes → (apply a release patch → verify the
  result hash) → the updater's hard interlocks → the bootloader's ident → flash. Stock is the zero-patch case.
- **Provenance.** Every prepared image records where it came from: `stock`, a `bundled` release, or an `unreviewed`
  user-supplied patch. The flash summary carries it.
- **Hard interlocks.** Each radio's updater refuses unsafe images and frames in code (length, model ID, header, and a
  guard that only allows the next precomputed frame). No setting can switch one off.
- **Per-radio prod gate.** Each `FirmwareUpdaterDescriptor` has `prodFlashDisabled`. A gated radio is hidden on the
  prod site and available on next, dev and staging. When no radio is offered, the Tools strip has no flasher entry
  and `/firmware` says the flasher is not available on this site yet. The gate has no Capacitor exemption: the
  flasher is hidden in the Android app for now.

```mermaid
flowchart LR
  U[User's stock zip / files] --> V[verify stock]
  V --> P[prepare image]
  P --> I[interlocks]
  I --> B[bootloader ident]
  B --> F[flash frames]
```

## Code anchors

| Layer        | Path                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------ |
| Core         | `src/core/firmware/`, `src/core/services/firmware/prepareFirmwareImage.ts`                 |
| Radio facts  | `src/core/radios/<mfr>/<model>/firmware.ts`                                                |
| Updater seam | `src/integrations/radio-io/firmware/` (types, registry, guarded send, errors)              |
| DM-32UV      | `src/integrations/radio-io/radios/dm32uv/firmwareUpdate/`                                  |
| App          | `src/app/routes/firmware/`, `src/app/services/firmwareFlash.ts`, `firmwareFlashEnvGate.ts` |

## Wizard steps

1. **Radio** — the radios this site offers, with the pinned stock version and how long a flash takes.
2. **Firmware** — what to flash. Stock firmware is always listed: it is also the recovery path.
3. **Stock firmware** — the vendor's download link (a plain link: Studio never fetches it), the expected zip and
   file names, and a drop zone for the zip or the extracted files. Studio checks every file against the pinned hashes.
4. **Prepare** — builds the exact image and runs the updater's interlocks. A failure stops here; nothing is sent.
5. **Before you flash** — a risk acknowledgement, required for every flash, plus battery, cable and "other programs
   closed" checks. A **Back up first** panel links to the Backup tab of any build for this radio in the open project.
6. **Enter update mode** — the radio's own steps, indicator and warnings, from its descriptor.
7. **Flash** — **Connect and flash** opens a port picker narrowed to the radio's cable. Progress shows Handshake →
   Erase → Transfer → Finish. While it runs, the screen is kept awake and leaving the page asks first. Cancelling
   after the radio has been touched asks for confirmation.
8. **Done or failed** — on success, the radio's verify hint and a plain-text summary (copy or download as `.txt`).
   A failure before the radio was touched says nothing was written. A failure after it shows the recovery steps.

## Recovery

If a flash stops part-way, don't keep power-cycling the radio. Re-enter update mode and flash again, or flash stock
firmware from the same page. The vendor's programming software is the fallback. Detailed per-radio recovery is
tracked in [#1366](https://github.com/pskillen/codeplug-studio/issues/1366).

## Privacy

Stock firmware and patch files stay in the browser tab's memory and are dropped when you leave the page. Nothing is
written to browser storage or uploaded. The flash summary is only kept if you copy or download it.

## Manual verify

1. `npm run dev`, open `/firmware`. The DM-32UV card shows the pinned stock version.
2. Drop a non-firmware file on the stock step: a refusal message appears and Continue stays disabled.
3. `BUILD_ENV=prod npm run dev`: `/firmware` shows "not available on this site yet" and the Tools strip has no
   Firmware flasher entry.
