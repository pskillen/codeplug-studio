# Firmware flashing

Studio can flash firmware to a supported radio over Web Serial, from the **Firmware flasher** under Tools
(`/firmware`). It is for operators who want to put a community firmware release on their radio, or put the vendor's
stock firmware back, without the vendor's programming software.

Firmware belongs to the physical radio, not to a project, library or build. The flasher needs no open project, never
touches the codeplug, and stores nothing. Product rules: [DESIGN.md — Firmware flashing](../../../DESIGN.md#firmware-flashing).

**Tracking:** epic [#1358](https://github.com/pskillen/codeplug-studio/issues/1358).

## Implementation status

| Area                        | Status                             | Notes                                                                                                                                                                                                                                                                                                                      |
| --------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DM-32UV flash               | Shipped: prod                      | Stock and published releases: wizard, updater and interlocks. Enabled on the prod site after a hardware flash of `1.0.0` from Studio ([#1363](https://github.com/pskillen/codeplug-studio/issues/1363))                                                                                                                    |
| Published releases          | Shipped (DM-32UV, AT-D890UV)       | Listed and fetched at run time from the firmware project's public release index ([releases.md](releases.md)), checked before use; release list, RC toggle, notes and a retry when the list can't be fetched in the wizard. Replaced the bundled catalog ([#1362](https://github.com/pskillen/codeplug-studio/issues/1362)) |
| User-supplied patch         | Shipped: prod (DM-32UV, AT-D890UV) | Advanced option with a risk statement ([#1365](https://github.com/pskillen/codeplug-studio/issues/1365))                                                                                                                                                                                                                   |
| AT-D890UV                   | Shipped: prod                      | Stock and published releases: wizard, updater and interlocks. Enabled on the prod site after a hardware flash of `1.0.0` from Studio ([#1364](https://github.com/pskillen/codeplug-studio/issues/1364))                                                                                                                    |
| Recovery docs               | Shipped                            | [Recovery](#recovery): stock flash as the way back, vendor CPS as the fallback ([#1366](https://github.com/pskillen/codeplug-studio/issues/1366))                                                                                                                                                                          |
| Browsers without Web Serial | Shipped                            | Phones, tablets, Firefox and Safari get a read-only list of the published releases for each offered radio (RC toggle, notes, retry) with a banner saying flashing needs Chrome or Edge on a desktop computer. No wizard, no port (`ReleaseBrowser.tsx`)                                                                    |
| Android                     | Deferred                           | Hidden in the Capacitor app ([#1367](https://github.com/pskillen/codeplug-studio/issues/1367))                                                                                                                                                                                                                             |

## Documentation map

| Doc                                                                                                                    | Topic                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [DESIGN.md — Firmware flashing](../../../DESIGN.md#firmware-flashing)                                                  | Product rules: no vendor firmware, pinning, interlocks, gates                          |
| [releases.md](releases.md)                                                                                             | Where releases come from: the public release index, its format, and what Studio checks |
| [DM-32UV firmware.md](../../reference/radios/baofeng/dm-32uv/firmware.md)                                              | Stock pin, update mode, patch format, bootloader protocol                              |
| [AT-D890UV firmware.md](../../reference/radios/anytone/at-d890uv/firmware.md)                                          | Stock pin, update mode, patch format, bootloader protocol                              |
| [Adding a radio adapter — Firmware updater](../radio-read-write/adding-a-radio-adapter.md#8-firmware-updater-optional) | Checklist for a new radio's updater                                                    |
| [Stepper.md](../../../src/app/components/v2/Stepper.md)                                                                | Wizard step indicator                                                                  |

## Concepts

- **Flash is not Write.** Codeplug Write sends a codeplug through a build; the flasher replaces the radio's program
  firmware through its bootloader. They share the Web Serial transport and nothing else: no build, egress or Write
  gate.
- **One pipeline.** Verify the user's stock firmware against the pinned hashes → (apply a release patch → verify the
  result hash) → the updater's hard interlocks → the bootloader's ident → flash. Stock is the zero-patch case.
- **Provenance.** Every prepared image records where it came from: `stock`, a `published` release, or an `unreviewed`
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
| AT-D890UV    | `src/integrations/radio-io/radios/at-d890uv/firmwareUpdate/`                               |
| App          | `src/app/routes/firmware/`, `src/app/services/firmwareFlash.ts`, `firmwareFlashEnvGate.ts` |

## Browsers without Web Serial

Flashing needs Web Serial, which phones, tablets, Firefox and Safari don't have. On those browsers `/firmware` shows no
wizard: a banner says flashing needs Chrome or Edge on a desktop computer, then each offered radio's published releases
are listed read-only, newest first, with **Show release candidates**, the **Release notes** disclosure and the same
**Try again** when the list can't be downloaded. Nothing there opens a port or loads a patch. The Tools strip still
shows the flasher entry, so the releases can be read from a phone. The Android app is unchanged (the flasher is
hidden there).

## Wizard steps

1. **Radio** — the radios this site offers, with the pinned stock version and how long a flash takes.
2. **Firmware** — what to flash:
   - **Published releases** for the radio, from the firmware project's public release index
     ([releases.md](releases.md)), newest first, each named by its firmware project and version ("MM9PDY
     modded firmware 1.0.0"), with its date, a summary and a **Release notes**
     disclosure that shows the published notes unchanged. If the list can't be downloaded, a warning says so with
     **Try again**; stock and a patch file from disk still work. Finals only by default; **Show release
     candidates** adds RCs, labelled **Pre-release**.
   - **Stock firmware** ("Stock firmware (v1.01.048)"), always listed: it is also the recovery path.
   - **Advanced: use a patch file from disk.** A `.patch.json` identical to a published release is treated as that
     release ("This is the MM9PDY modded firmware 1.0.0 (published)"). Any other patch shows its project name and
     version, a short sha256 and a risk
     statement, and needs **I understand** ticked before the wizard continues. That is in addition to the risk
     acknowledgement every flash needs. A patch for another radio is refused with its own message.
3. **Stock firmware** — the vendor's download link (a plain link: Studio never fetches it), the expected zip and
   file names, and a drop zone for the zip or the extracted files. Studio checks every file against the pinned hashes.
4. **Prepare** — builds the exact image (applying the patch and checking its result hash) and runs the updater's
   interlocks. Shows what will be flashed ("MM9PDY modded firmware 1.0.0 (published)", "MM9PDY modded firmware 1.1.0
   (unreviewed user-supplied patch)" or "stock firmware v1.01.048"), the
   version stamp and the result hashes. A failure, such as a patch made for different stock, stops here; nothing is
   sent.
5. **Before you flash** — names what is being flashed ("You are flashing the MM9PDY modded firmware 1.0.0 to the
   Baofeng DM-32UV"), then a risk acknowledgement, required for every flash, plus battery, cable and "other programs
   closed" checks. A **Back up first** panel links to the Backup tab of any build for this radio in the open project.
6. **Enter update mode** — the radio's own steps, indicator and warnings, from its descriptor.
7. **Flash** — names the firmware and radio again, and repeats the radio's update-mode warnings right above
   **Connect and flash**, which opens a port picker narrowed to the radio's USB device. Progress shows the phases
   the radio's updater reports: Handshake → Erase → Transfer → Finish for the DM-32UV; Handshake → Transfer →
   Finish for the AT-D890UV, which erases as part of the transfer. While the first block waits for the radio, the
   transfer step reads "Waiting for the radio (it may be erasing)…". Progress is redrawn at most every ~100 ms (a
   phase change, or the radio becoming touched, shows at once), so a 52,000-frame transfer stays responsive. While
   it runs, the screen is kept awake and leaving the page asks first. Cancelling after the radio has been touched
   asks for confirmation.
8. **Done or failed** — on success, what is now on the radio ("The MM9PDY modded firmware 1.0.0 is on the radio"),
   its verify hint and a plain-text summary (copy or download as `.txt`). The message depends on how the session
   ended (see [What to expect](#what-to-expect)). A failure before the radio was touched says nothing was written.
   A failure after it shows the recovery steps.

## What to expect

| Radio     | Duration                                 | How the radio signals the end                                                                                        | How to check (release `1.1.0`)                                                 |
| --------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| DM-32UV   | About 2 minutes (including a 13 s erase) | Studio sends the end byte; any reply, or none, is fine (`eot-sent`)                                                  | Settings > Device Info > Versions shows `mm9pdy-1.1.0` under `DM32.01.L01.048` |
| AT-D890UV | Under a minute (about 25 s transfer)     | The radio restarts at once and its USB port disappears (`port-closed-by-radio`), or it replies `06` (`acknowledged`) | After the radio restarts, Device Info > Mod Ver shows `mm9pdy-1.1.0`           |

The durations are the descriptors' `expectedDuration`, shown on the radio cards; the checks are the releases' verify
hints.

**When the radio doesn't confirm the end (`no-reply`).** Every block was acknowledged, but nothing came back after
the end byte, and the port stayed open. This is **not** a failure: the wizard shows the success screen with a
warning, "Every block was accepted, but the radio didn't confirm the end. Power-cycle it, then check: …". Power-cycle
the radio and use the verify hint. If the check fails, follow [Recovery](#recovery).

**Flash summary.** It records the end state (`End: …`), the elapsed time as `mm:ss`, and, for updaters that measure
it (the AT-D890UV), each data frame's round trip from write to acknowledgement: `Frame round trip: median …, p99 …,
max … ms`. A failed flash records the timing up to the failure.

## Provenance

| Provenance   | Source                                                  | Flash summary line                                                                  |
| ------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `stock`      | The user's verified stock, unchanged                    | `Firmware: stock firmware <version>`                                                |
| `published`  | A published release, or a dropped file identical to one | `Firmware: <project> <tag> (published, patch sha256 <hash>)`                        |
| `unreviewed` | Any other patch file from disk                          | `Firmware: <project> <version> (user-supplied patch, sha256 <hash>, version <ver>)` |

`<project>` is the firmware project's display name, looked up by the patch `name` in
`src/core/firmware/releases/projects.ts` (`FIRMWARE_PROJECTS`). The DM-32UV and AT-D890UV patch projects are both
"MM9PDY modded firmware". A patch name with no row there shows as "Firmware patch". Stock is never given a project
name.

The summary also records the version stamp read from the patched image, when the patch format has one.

### DM-32UV `1.0.0`: checking it worked

The DM-32UV `1.0.0` doesn't show the mod's version: Device Info still reads `DM32.01.L01.048` after a `1.0.0` flash. The
release's verify hint asks the operator to press Scan on a channel with no scan list, which should start a zone scan.
From `1.1.0` the mod shows `mm9pdy-<tag>` under Settings > Device Info > Versions, and that is the verify hint.

## Recovery

Flashing stock firmware is the zero-patch case of the same pipeline, and it is the documented way back on every
supported radio. The wizard always lists **Stock firmware** on the Firmware step, for every radio. Stock flashing
has no hardware gate of its own: it sends the same kind of frame stream as a release.

The wizard's own screens carry these steps too, so they work offline.

### If a flash fails before the radio was touched

The wizard says **Nothing was written**. The bootloader ident and the checks before it erase nothing. Power the
radio off and on, then try again: **Enter update mode again** goes back to the update-mode step.

### If a flash fails after the radio was touched

The wizard shows **Recover the radio**. The radio's program firmware is incomplete, but its bootloader is intact:
Studio never writes the bootloader or the activation area.

1. **Don't keep power-cycling the radio.** It can't start the incomplete firmware.
2. **Re-enter update mode** with the radio's own steps: [DM-32UV](../../reference/radios/baofeng/dm-32uv/firmware.md#update-mode-entry),
   [AT-D890UV](../../reference/radios/anytone/at-d890uv/firmware.md#update-mode-entry).
3. **Flash again:** the same release, or **stock** from the wizard's **Stock firmware** entry (the **Flash stock
   instead** button goes straight to the firmware choice).
4. Either way you need the vendor's stock download. A release is built from it, and stock is it.

### Going back to stock on purpose

Choose **Stock firmware** on the Firmware step and flash as usual. The radio then runs the vendor's pinned version.

### Fallback: the vendor's programming software

If Studio can't flash the radio, the vendor's own CPS (customer programming software) can: the Baofeng DM-32UV CPS
or the AnyTone AT-D890UV CPS, using its firmware update with the vendor's firmware files. The vendor downloads
Studio pins are:

- DM-32UV: https://baofeng.s3.amazonaws.com/Baofeng_DM-32UV_Firmware_v1.01.048.zip
- AT-D890UV: https://anytoneusa.com/Files/D890UV%20V1.05%20DMR%20official%20release%20260521.zip

### What Studio checks before any byte is sent

- **Stock hashes:** every stock file matches the pinned SHA-256 and size for the radio.
- **Result hashes:** a patched image matches the result hashes recorded in the release patch.
- **Interlocks:** the radio's updater refuses an unsafe image or frame in code (address windows away from the
  bootloader and the activation page, image length and header, vector table), and checks the bootloader's ident,
  including that the radio is in update mode, before the first data frame.

Rules: [DESIGN.md — Firmware flashing](../../../DESIGN.md#firmware-flashing). Per-radio interlocks: the "Hard
interlocks" sections of the two radios' `firmware.md`.

## Privacy

Stock firmware and patch files stay in the browser tab's memory and are dropped when you leave the page. Nothing is
written to browser storage or uploaded. The flash summary is only kept if you copy or download it.

## Manual verify

1. `npm run dev`, open `/firmware`. The DM-32UV card shows the pinned stock version.
2. Drop a non-firmware file on the stock step: a refusal message appears and Continue stays disabled.
3. `BUILD_ENV=prod npm run dev`: `/firmware` offers only the radios whose prod gate is cleared (both the DM-32UV and the AT-D890UV), and
   the Tools strip has a Firmware flasher entry. With no radio offered, `/firmware` shows "not available on this
   site yet" and the strip has no entry.
