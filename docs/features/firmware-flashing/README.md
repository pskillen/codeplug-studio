# Firmware flashing

Studio can flash firmware to a supported radio over Web Serial (or, with developer mode on, for the DM-32UV, the
AT-D890UV, the RT95 front panel and the UV-5R Mini, over USB serial in the [Android app](#android-app)), from the
**Firmware flasher** under Tools (`/firmware`). It is for operators who want to put a community firmware release on
their radio, or put the vendor's stock firmware back, without the vendor's programming software.

Firmware belongs to the physical radio, not to a project, library or build. The flasher needs no open project, never
touches the codeplug, and stores nothing. Product rules: [DESIGN.md — Firmware flashing](../../../DESIGN.md#firmware-flashing).

**Tracking:** epic [#1358](https://github.com/pskillen/codeplug-studio/issues/1358).

## Implementation status

| Area                        | Status                                                      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DM-32UV flash               | Shipped: prod                                               | Stock and published releases: wizard, updater and interlocks. Enabled on the prod site after a hardware flash of `1.0.0` from Studio ([#1363](https://github.com/pskillen/codeplug-studio/issues/1363))                                                                                                                                                                                                                                                   |
| Published releases          | Shipped (DM-32UV, AT-D890UV, RT95 front panel)              | Listed and fetched at run time from the firmware project's public release index ([releases.md](releases.md)), checked before use; release list, RC toggle, notes and a retry when the list can't be fetched in the wizard. Replaced the bundled catalog ([#1362](https://github.com/pskillen/codeplug-studio/issues/1362))                                                                                                                                |
| User-supplied patch         | Shipped: prod (DM-32UV, AT-D890UV, RT95 front panel)        | Advanced option with a risk statement ([#1365](https://github.com/pskillen/codeplug-studio/issues/1365))                                                                                                                                                                                                                                                                                                                                                  |
| AT-D890UV                   | Shipped: prod                                               | Stock and published releases: wizard, updater and interlocks. Enabled on the prod site after a hardware flash of `1.0.0` from Studio ([#1364](https://github.com/pskillen/codeplug-studio/issues/1364))                                                                                                                                                                                                                                                   |
| RT95 front panel (LCD)      | Shipped: prod                                               | Stock and published releases for the head; the main board is a separate card, stock MAIN or a MAIN patch file (published `retevis-rt95-main` releases or a file from disk), on next/dev/staging (hidden on prod); normal-mode ident and attestations before flashing. Enabled on the prod site after the owner flashed stock V1.41, test builds and the MM9PDY zones build from Studio ([#1460](https://github.com/pskillen/codeplug-studio/issues/1460)) |
| UV-5R Mini                  | Shipped: pre-prod only (next, dev, staging)                 | The radio drives the update: its app, then its loader, ask for slices of the image and Studio serves them; a power-cut update is continued by flashing again. Patch file from disk only until a release is published; no plain stock flash, Back to stock takes the to-stock patch. Hidden on prod until Studio has flashed a patched release to a Mini on hardware ([#1587](https://github.com/pskillen/codeplug-studio/issues/1587))                    |
| Recovery docs               | Shipped                                                     | [Recovery](#recovery): stock flash as the way back, vendor CPS as the fallback ([#1366](https://github.com/pskillen/codeplug-studio/issues/1366))                                                                                                                                                                                                                                                                                                         |
| Browsers without Web Serial | Shipped                                                     | Phones, tablets, Firefox and Safari get a read-only list of the published releases for each offered radio (RC toggle, notes, retry) with a banner saying flashing needs Chrome or Edge on a desktop computer. No wizard, no port (`ReleaseBrowser.tsx`)                                                                                                                                                                                                   |
| Android                     | Every radio but the RT95 main board, with developer mode on | The Capacitor app offers the DM-32UV, the AT-D890UV, the RT95 front panel and the UV-5R Mini while [developer mode](../developer-mode/README.md) is on, in any build; the RT95 main board is hidden there ([Android app](#android-app)). The DM-32UV, AT-D890UV and RT95 front panel updaters are run through the app's pipe offline against their bootloader mocks; none of them has been flashed from a phone.                                          |

## Documentation map

| Doc                                                                                                                    | Topic                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [DESIGN.md — Firmware flashing](../../../DESIGN.md#firmware-flashing)                                                  | Product rules: no vendor firmware, pinning, interlocks, gates                                |
| [releases.md](releases.md)                                                                                             | Where releases come from: the public release index, its format, and what Studio checks       |
| [DM-32UV firmware.md](../../reference/radios/baofeng/dm-32uv/firmware.md)                                              | Stock pin, update mode, patch format, bootloader protocol                                    |
| [AT-D890UV firmware.md](../../reference/radios/anytone/at-d890uv/firmware.md)                                          | Stock pin, update mode, patch format, bootloader protocol                                    |
| [RT95 firmware.md](../../reference/radios/retevis/rt95/firmware.md)                                                    | Front and main board stock pins and sources, update mode, patch format, protocol, pre-flight |
| [UV-5R Mini firmware.md](../../reference/radios/baofeng/uv-5r-mini/firmware.md)                                        | Stock pin, patch format, image checks, update mode, the update session, results, recovery    |
| [Adding a radio adapter — Firmware updater](../radio-read-write/adding-a-radio-adapter.md#8-firmware-updater-optional) | Checklist for a new radio's updater                                                          |
| [Stepper.md](../../../src/app/components/v2/Stepper.md)                                                                | Wizard step indicator                                                                        |

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
  and `/firmware` says the flasher is not available on this site yet. The gate has no Capacitor exemption. **On prod, [developer mode](../developer-mode/README.md)** (five taps
  on the footer version) offers the gated radios on that device; the gate is `resolveFirmwareFlashGate` over the one
  prod gate, and no interlock reads developer mode. The flasher page reads it when it opens.
- **Platform check.** Separate from the prod gate: each descriptor's `capacitorSupported` is `false` (hidden in the
  Android app), `'developerMode'` (offered in the app only while developer mode is on, in any build) or `true`.
  `isFirmwareUpdaterOfferedOnPlatform` in `firmwareFlashEnvGate.ts` applies it; in a browser every radio passes. The
  DM-32UV, the AT-D890UV, the RT95 front panel and the UV-5R Mini are `'developerMode'`; the RT95 main board is
  `false`. No radio is `true` yet. See [Android app](#android-app).

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
| RT95 (head)  | `src/integrations/radio-io/radios/rt95/firmwareUpdate/`                                    |
| RT95 (MAIN)  | Same folder: `RT95_MAIN_FIRMWARE_UPDATER` in `descriptor.ts`, profile in `targets.ts`      |
| UV-5R Mini   | `src/integrations/radio-io/radios/uv5r-mini/firmwareUpdate/`                               |
| App          | `src/app/routes/firmware/`, `src/app/services/firmwareFlash.ts`, `firmwareFlashEnvGate.ts` |
| Time left    | `src/app/routes/firmware/flashEta.ts` (count, elapsed and estimate formatting)             |

## Browsers without Web Serial

Flashing needs Web Serial, which phones, tablets, Firefox and Safari don't have. On those browsers `/firmware` shows no
wizard: a banner says flashing needs Chrome or Edge on a desktop computer, then each offered radio's published releases
are listed read-only, newest first, with the radio's "Supported: …" line and each release's "For the … on stock …"
line where the radio has them, **Show release candidates**, the **Release notes** disclosure and the same
**Try again** when the list can't be downloaded. Nothing there opens a port or loads a patch. The Tools strip still
shows the flasher entry, so the releases can be read from a phone. The Android app is covered below.

## Android app

The Capacitor app has no Web Serial; it reaches the cable through the USB-serial plugin over USB-OTG. The flasher offers
a radio there only through its platform check: today the DM-32UV, the AT-D890UV, the RT95 front panel and the UV-5R
Mini, and only while [developer mode](../developer-mode/README.md) is on for the phone, in any build. With developer
mode off, or for any other radio, `/firmware` in the app says flashing is available in a desktop browser. Developer mode
changes only which radios are offered: the stock pins, interlocks and frame guards are the same code as on the desktop.

- **The wizard** is the desktop one. Each port step (the pre-flight probe, the radio report on Prepare, Connect and
  flash) finds the one attached device matching the radio's cable instead of showing a picker; none, or more than one,
  is refused with a message and nothing is sent. Android asks to allow USB access once per plug-in. Each link opens at
  its own rate with its own DTR/RTS choice. The UV-5R Mini's switch to its loader's rate changes the rate on the open
  port; no other radio changes rate mid-session.
- **Files:** in the app the stock step's picker takes any file (Android's chooser greys out extensions it has no type
  for, such as `.ufw`); the pinned hashes decide what is accepted. The release list and patches are fetched as on the
  web.
- **Steps the app refuses:** a radio's safety backup stays desktop-only and refuses cleanly in the app. The pre-flight
  probe runs in the app.
- **Offline proof only.** The DM-32UV, AT-D890UV and RT95 front panel updaters are run end to end through the app's
  real pipe over a fake USB-serial plugin backed by their bootloader mocks: a clean run, a resend or a silent frame, a
  cable pulled mid-transfer, and a delay on every reply that stays inside their timeouts. For these three, DTR/RTS at
  the pins, the screen wake lock in the app's WebView and what Android does to a backgrounded flash are known only
  from the code.

Per radio:

- **DM-32UV:** the CH340 cable at 115200, no rate change. The bootloader takes no resend: any late or wrong reply
  aborts. A flash that stops after **Erasing** needs a re-flash from update mode (stock is the safe choice).
- **RT95 front panel:** PL2303, CH340 or FTDI cable at 115200, no rate change; each frame comes back as an echo and is
  checked, with up to three resends. **Check the radio** (the normal-mode probe) runs from the phone. A flash cut after
  the first frame needs a re-flash from update mode.
- **RT95 main board:** hidden in the app. Its safety backup is required and is desktop-only, and Studio has not
  flashed a main board on hardware.
- **AT-D890UV:** the radio's own USB port (CDC/ACM), no rate change. Every 40-byte frame waits for its one-byte
  reply, so a phone pays one USB round trip per frame: a flash is estimated at **2.5 to 7 minutes** from a phone
  (52,515 frames), against about 26 s on a desktop. The estimate is not measured; the flash summary's frame round-trip
  line gives the real figure. The wizard's "under a minute" is the desktop figure. Android may ask to allow USB access
  each time the radio attaches: when it enters update mode, and when it reboots at the end of the flash. A flash cut
  after the first frame needs a re-flash from update mode.

### Before the first flash from a phone

- Make the first phone flash of the DM-32UV, the AT-D890UV and the RT95 front panel their **stock** firmware: it is
  also the recovery image. The UV-5R Mini has no plain stock flash; its way back is the to-stock patch.
- Charge the phone, set a long screen timeout, and keep the app in front with the screen on until it finishes.
- Plug in nothing but the programming cable (through the USB-OTG adapter).
- Have a desktop browser with Studio (and the vendor's tool) ready as the fallback.
- If the flash stalls or the link drops: power-cycle the radio back into update mode and flash again, from the phone or
  from a desktop browser. For the DM-32UV, the AT-D890UV and the RT95 front panel, a cut flash after the first data
  frame needs that re-flash; that the bootloader comes back after a half-written flash is expected but not yet proven
  on hardware. The UV-5R Mini continues an interrupted update on the next run.

## Wizard steps

1. **Radio** — the radios this site offers, with the pinned stock version and how long a flash takes. A radio whose
   descriptor says which of its radios Studio supports (`supportedRadios`; the UV-5R Mini: "UV-5R Minis whose Radio
   Info (MENU → Radio Info) shows Firmware V0.27 and Hardware V1.7, and whose start-up screen (hold 8 while switching
   on) shows 5RMINI NRF. Other Minis are not supported yet.") shows it as "Supported: …" on its card, and under the
   page's intro on every later step, so an owner can check before fetching any file. Other radios show no such line.
2. **Firmware** — what to flash:
   - **Published releases** for the radio, from the firmware project's public release index
     ([releases.md](releases.md)), newest first, each named by its firmware project and version ("MM9PDY
     modded firmware 1.0.0"), with its date, a summary and a **Release notes**
     disclosure that shows the published notes unchanged. A radio that accepts more than one stock version (the UV-5R
     Mini) also says which radios each release is for: "For the Baofeng UV-5R Mini on stock v0.27 (NRF)". If the list can't be downloaded, a warning says so with
     **Try again**; stock and a patch file from disk still work. Finals only by default; **Show release
     candidates** adds RCs, labelled **Pre-release**.
   - **Stock firmware** ("Stock firmware (v1.01.048)"), always listed: it is also the recovery path.
     A radio with no stock flash (the UV-5R Mini) lists no Stock card; when it has no published release either, the
     step says "No firmware release is published for the Baofeng UV-5R Mini yet" and points to the Advanced patch file.
   - **Back to stock**, for a radio whose way back is a to-stock patch (the UV-5R Mini): one line saying the
     to-stock file comes from the firmware project's release artifact and that the plain stock file can't be
     flashed, and a file picker for it. Any other patch is refused there. A recognised file shows "This file puts back
     the stock firmware v0.04 (NRFB)" and needs no **I understand** tick: the radio's checks pin everything it
     installs ([UV-5R Mini: Back to stock](../../reference/radios/baofeng/uv-5r-mini/firmware.md#back-to-stock)).
   - **Advanced: use a patch file from disk.** A `.patch.json` identical to a published release is treated as that
     release ("This is the MM9PDY modded firmware 1.0.0 (published)"). Any other patch shows its project name and
     version, a short sha256 and a risk
     statement, and needs **I understand** ticked before the wizard continues. That is in addition to the risk
     acknowledgement every flash needs. A patch for another radio is refused with its own message. For a radio whose
     releases ship one file per flash layout (the UV-5R Mini), the drop zone takes the release's files at once ("A
     release has a file for each radio firmware it supports"); one file works too. With
     [developer mode](../developer-mode/README.md) on it lists their layouts ("Flash layouts: L1, L2."). Two files of one layout, files of different
     releases, and a retired `V4` file are refused
     ([releases](releases.md#uv-5r-mini-rows-one-per-flash-layout)).
3. **Stock firmware** — the stock sources (the vendor's download link, or how to ask the vendor, and any unofficial
   mirror, labelled; all plain links: Studio never fetches them), the expected zip and
   file names, and a drop zone for the zip or the extracted files. Studio checks every file against the pinned hashes.
   The UV-5R Mini, whose vendor publishes no stock firmware, lists the user's own copy and then one "Unofficial copy
   shared by a third party" link per stock version, each naming its file
   ([UV-5R Mini: where the file comes from](../../reference/radios/baofeng/uv-5r-mini/firmware.md#stock-firmware-pin)).
   A radio whose release files are built on different stocks (the UV-5R Mini: the L1 file on v0.04, the L2 file on
   v0.27) takes either stock file or both; each file is then prepared on its own stock. The step says so: "Studio
   needs one of these, the one for your radio's firmware:" over the files, each "for stock firmware v0.27 (NRF)" and
   so on ([UV-5R Mini: one stock per base](../../reference/radios/baofeng/uv-5r-mini/firmware.md#stock-firmware-pin)).
4. **Prepare** — builds the exact image (applying the patch and checking its result hash) and runs the updater's
   interlocks. Shows what will be flashed ("MM9PDY modded firmware 1.0.0 (published)", "MM9PDY modded firmware 1.1.0
   (unreviewed user-supplied patch)" or "stock firmware v1.01.048"), the
   version stamp and the result hashes. A failure, such as a patch made for different stock, stops here; nothing is
   sent.
   For a radio whose firmware comes in more than one flash layout (the UV-5R Mini; the factory firmware's packing,
   not the board), the step first finds the radio's stock base (UV-5R Mini: suffix and Firmware version) and layout,
   and prepares the release's file for exactly that; it never offers the nearest build. A release with no file for it
   shows "Not available in this release: there is no MM9PDY build for this radio (…) yet." and prepares nothing; one
   with no other file for this radio says "If the radio refuses this file, this release has no other file for this
   radio to try." **The flash layout is an internal detail:** the step's words say "your radio's firmware", and it
   shows the layout ("Flash layout: L2", with the prepared image or beside a refusal) only with
   [developer mode](../developer-mode/README.md) on. That is display only: no check reads developer mode. **Read the radio** reads, in normal mode and read-only, the radio report an MM9PDY build answers:
   its flash layout and the suffix, Firmware and Hardware strings of its stock firmware, matched against the same
   table and with the same refusals as the dropdowns below. A report naming a layout Studio doesn't know is refused as
   "This radio reports firmware Studio doesn't support"; what it reported shows only with developer mode on. With no report, or when the read fails, the step asks three dropdowns of the supported values: Firmware (`V0.04`,
   `V0.27`, `Other`) and Hardware (`V1.7`, `Other`) from Radio Info, and the suffix (`NRF`, `NRFB`, `Other`) from the
   start-up screen shown while holding `8`. `Other` is refused, and so is a combination with no build. A warning says to
   pick exactly what the radio shows: a wrong Firmware or suffix pick is refused with nothing installed but may reset
   its FM presets and volume, while a wrong Hardware pick, or a radio Studio doesn't know yet, may not be caught
   ([UV-5R Mini firmware](../../reference/radios/baofeng/uv-5r-mini/firmware.md#radio-info)). Studio never
   changes a radio's code base: the radio's interlocks refuse a file built on another one.
   When the radio already runs the image's build (on the UV-5R Mini: the build name the radio reports is the image's,
   or a to-stock file for a radio that names no build), the step shows a warning instead: writing it again rewrites the
   same firmware, a repair, with the usual power-cut risk. Nothing is prepared, and the wizard can't move on, until
   **Write it again anyway** is ticked; changing the answers clears the tick
   ([Already installed](../../reference/radios/baofeng/uv-5r-mini/firmware.md#already-installed)).
5. **Before you flash** — names what is being flashed ("You are flashing the MM9PDY modded firmware 1.0.0 to the
   Baofeng DM-32UV"), then a risk acknowledgement, required for every flash, plus battery, cable and "other programs
   closed" checks. A **Back up first** panel links to the Backup tab of any build for this radio in the open project.
   Some radios add their own checks: the RT95 asks two questions (serial number 21xx or later; the FUNC + P4 test
   screen shows LCD CPU V1.11 and RF CPU V1.11) and reads the radio's model and version in normal mode (**Check the
   radio**) before you put it into update mode. Continue stays disabled until both are ticked and the check passed.
   A radio may also require a **saved safety backup** of its irreplaceable data (calibration, identity). You type the
   serial number from the radio's label; if Studio already has a record of a backup for that serial, the step passes
   and reads nothing. Otherwise **Check / take safety backup** reads the radio (read-only), downloads the backup zip
   and asks you to tick "I've saved <file>" before it records that one was saved. **Use a backup file I already
   have** records an existing backup file for the serial. Studio keeps only a small record in this browser (serial,
   file name, fingerprint, date; never the bytes), so the same radio skips the step next time. It is required: the
   "already tested this radio" opt-out for the read-only check does not skip it.
6. **Enter update mode** — the radio's own steps, indicator and warnings, from its descriptor. The RT95's is P1 +
   knob with a blank screen; the P3 mode (screen "UPDATE THE RF CPU") flashes the main board and is the wrong one.
   The RT95 main board's is the other way round: remove power (a Power-key off and on is not enough), hold P3 and the
   knob, restore power; the screen says "UPDATE THE RF CPU".
   The UV-5R Mini's is PTT-A and = held while switching on (the screen shows UPDATE...); after a cut update, switch on
   with no keys instead: the screen stays dark and Studio continues the write.
7. **Flash** — names the firmware and radio again, and repeats the radio's update-mode warnings right above
   **Connect and flash**, which opens a port picker narrowed to the radio's USB device. Progress shows the phases
   the radio's updater reports: Handshake → Erase → Transfer → Finish for the DM-32UV; Handshake → Transfer →
   Finish for the AT-D890UV, which erases as part of the transfer; Handshake → Transfer → Finish for the RT95 front panel.
   The UV-5R Mini shows Handshake → Loader running → Erase → Transfer → Finish: Handshake while its stock app reads the
   image (about 21 s; the radio is not yet touched), Loader running from the first hello of its loader (the radio is
   touched from there; nothing is erased yet), Erase only once the loader announces its erase, Transfer as the loader
   reads the firmware area, Finish at the result. The current loaders always erase and rewrite; an older loader that
   announces no erase because the image is already installed stops at Loader running with the "already installed"
   message. It has a tick too, "The radio shows UPDATE..., or its
   screen stays dark after an interrupted update".
   The RT95 has one more tick on this step, "The screen is blank. It does not say UPDATE THE RF CPU." (front panel)
   or "The screen says UPDATE THE RF CPU." (main board), before **Connect and flash** is enabled. While the first block waits for the radio, the
   transfer step reads "Waiting for the radio (it may be erasing)…". Progress is redrawn at most every ~100 ms (a
   phase change, or the radio becoming touched, shows at once), so a 52,000-frame transfer stays responsive. While
   it runs, the screen is kept awake and leaving the page asks first. Cancelling after the radio has been touched
   asks for confirmation.
   Under the active step a line counts the write: written of total, the time since **Connect and flash**, and the
   time left, for example `212 / 478 blocks · 1:12 elapsed · about 1:40 left`. The count is distinct blocks the radio
   has taken (the DM-32UV, AT-D890UV and RT95 count data frames), or for the UV-5R Mini the KiB of the firmware area
   its loader has read: a block the loader asks for twice counts once. The time left is the rate since the first
   counted block (the erase wait before it is left out) applied to what remains; it reads "estimating time left…"
   until at least 5 s and 3% of the total have gone, so the first figure doesn't jump about, and it is 0 when the
   count reaches the total. The UV-5R Mini shows the elapsed time only until its loader announces the firmware area
   (its cmd 4); from then it shows `0 / 480 KiB` through the erase wait, and its count starts at the first area block.
   The other radios show `0 / N blocks` from the start. The figures are display only: nothing about what is sent, its order
   or any check depends on them. At the end the dialog gives the final count and time ("478 / 478 blocks in 3:02"). The
   figures cover different spans: the live elapsed time counts from **Connect and flash**, identifying the radio
   included; the final time on success is the updater's own, from the start of its flash (after the radio is
   identified), so it can be a few seconds less than the last elapsed figure; on a failure it runs from connecting to
   the stop. The summary's `Elapsed:` line covers the same span as the final time.
8. **Done or failed** — on success, what is now on the radio ("The MM9PDY modded firmware 1.0.0 is on the radio"),
   its verify hint and a plain-text summary (copy or download as `.txt`). The message depends on how the session
   ended (see [What to expect](#what-to-expect)). A failure before the radio was touched says nothing was written.
   A failure after it shows the recovery steps.
   A refusal before anything was installed (on the UV-5R Mini: the loader's `0x8F`, or the app's `0x83` before any
   erase; the file isn't for the radio's firmware) shows **Nothing was installed** instead, even though the loader ran,
   with the updater's words (the FM presets and volume may have been reset). When the release has a file for the
   other layout of the same variant (UV-5R Mini: the same NRF/NRFB suffix), the panel offers **Enter update mode
   again with the other file**: Studio prepares that file, on its own stock, for that layout and runs every check
   again, keeps the before-you-flash ticks, probe and safety backup, and goes back to **Enter update mode**. Nothing is
   sent until you put the radio into update mode and press **Connect and flash**. It is offered once per flash; a
   second refusal, or a release with no such file (today's Mini releases: their two files differ in suffix), offers
   nothing more
   ([UV-5R Mini results](../../reference/radios/baofeng/uv-5r-mini/firmware.md#results)).

## What to expect

| Radio            | Duration                                                                         | How the radio signals the end                                                                                                                       | How to check (release `1.1.0`)                                                 |
| ---------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| DM-32UV          | About 2 minutes (including a 13 s erase)                                         | Studio sends the end byte; any reply, or none, is fine (`eot-sent`)                                                                                 | Settings > Device Info > Versions shows `mm9pdy-1.1.0` under `DM32.01.L01.048` |
| AT-D890UV        | Under a minute (about 26 s transfer); an estimated 2.5 to 7 minutes from a phone | The radio restarts at once and its USB port disappears (`port-closed-by-radio`), or it replies `06` (`acknowledged`)                                | After the radio restarts, Device Info > Mod Ver shows `mm9pdy-1.1.0`           |
| RT95 front panel | Under a minute (estimate; not yet measured)                                      | Studio sends the end byte; the radio replies `06` (`acknowledged`) or nothing (`no-reply`). Switch the radio off and on afterwards                  | Stock: FUNC + P4 test screen shows LCD CPU V1.11                               |
| RT95 main board  | About 20 to 25 s (estimate; not yet measured)                                    | As the front panel; the head relays each frame to the main board. Stock or MAIN patch: FUNC + P4 test screen shows RF CPU V1.11 (the same for both) |
| UV-5R Mini       | About 3 minutes (estimate; not yet measured)                                     | The loader reports result `0`; Studio echoes it (`acknowledged`) and the radio restarts by itself                                                   | The power-on screen shows the release's build name                             |

The durations are the descriptors' `expectedDuration`, shown on the radio cards; the checks are the releases' verify
hints.

**When the radio doesn't confirm the end (`no-reply`).** Every block was acknowledged, but nothing came back after
the end byte, and the port stayed open. This is **not** a failure: the wizard shows the success screen with a
warning, "Every block was accepted, but the radio didn't confirm the end. Power-cycle it, then check: …". Power-cycle
the radio and use the verify hint. If the check fails, follow [Recovery](#recovery).

**Flash summary.** It records the end state (`End: …`), the elapsed time as `mm:ss`, the final count as
`Written: 478 / 478 blocks` (the UV-5R Mini: `Written: … / … bytes`, distinct bytes of the firmware area), and, for
updaters that measure it (the AT-D890UV), each data frame's round trip from write to acknowledgement:
`Frame round trip: median …, p99 …, max … ms`. A failed flash records the elapsed time to the stop, the last count reported
(updaters report every few frames, so it can trail the frames sent) and the timing up to the failure.

## Provenance

| Provenance   | Source                                                  | Flash summary line                                                                  |
| ------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `stock`      | The user's verified stock, unchanged                    | `Firmware: stock firmware <version>`                                                |
| `published`  | A published release, or a dropped file identical to one | `Firmware: <project> <tag> (published, patch sha256 <hash>)`                        |
| `unreviewed` | Any other patch file from disk                          | `Firmware: <project> <version> (user-supplied patch, sha256 <hash>, version <ver>)` |

A dropped file identical to a published release gets the same checks as a download of that release: the row's
version, stock, result hashes, `base` and `layout` must agree with the patch.

`<project>` is the firmware project's display name, looked up by the patch `name` in
`src/core/firmware/releases/projects.ts` (`FIRMWARE_PROJECTS`). The DM-32UV and AT-D890UV patch projects are both
"MM9PDY modded firmware". A patch name with no row there shows as "Firmware patch". Stock is never given a project
name.

The summary also records the version stamp read from the patched image, when the patch format has one.

A to-stock patch (its build name is the stock's own base name) keeps its patch provenance but reads as the stock:
`Firmware: back to stock, stock firmware <version> (…)`, with the stock's verify hint.

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
   [AT-D890UV](../../reference/radios/anytone/at-d890uv/firmware.md#update-mode-entry),
   [RT95 front panel](../../reference/radios/retevis/rt95/firmware.md#update-mode-entry) (P1 + knob, blank screen),
   [RT95 main board](../../reference/radios/retevis/rt95/firmware.md#recovery) (head first, then main board).
   The [UV-5R Mini](../../reference/radios/baofeng/uv-5r-mini/firmware.md#recovery): leave the cable in, switch the
   radio off and on with no keys held, then press **Connect and flash** with the same files; Studio hears the radio's
   loader and continues.
3. **Flash again:** the same release, or **stock** from the wizard's **Stock firmware** entry (the **Flash stock
   instead** button goes straight to the firmware choice).
4. Either way you need the vendor's stock download. A release is built from it, and stock is it.

### Going back to stock on purpose

Choose **Stock firmware** on the Firmware step and flash as usual. The radio then runs the vendor's pinned version.
On the UV-5R Mini, choose **Back to stock** and pick the to-stock file (`uv5rmini-fw-to-stock-<base>.patch.json`)
from the firmware project's release artifact; the plain stock file can't be flashed. A radio that already runs that
stock gets the same-build warning on Prepare, and can be rewritten with it ticked.

### Fallback: the vendor's programming software

If Studio can't flash the radio, the vendor's own CPS (customer programming software) can: the Baofeng DM-32UV CPS
or the AnyTone AT-D890UV CPS, using its firmware update with the vendor's firmware files. The vendor downloads
Studio pins are:

- DM-32UV: https://baofeng.s3.amazonaws.com/Baofeng_DM-32UV_Firmware_v1.01.048.zip
- AT-D890UV: https://anytoneusa.com/Files/D890UV%20V1.05%20DMR%20official%20release%20260521.zip
- RT95 front panel: Retevis's vendor updater (QXCodePro, Windows) is in the same package as the stock firmware. The
  package has no single vendor URL: Studio lists its sources (ask Retevis support, and an unofficial mirror) on the
  Stock step. The vendor tool can also recover the main board. Studio flashes the main board only as the pinned
  stock MAIN or a checked MAIN patch (next, dev and staging builds), never anything else.

### What Studio checks before any byte is sent

- **Stock hashes:** every stock file matches the pinned SHA-256 and size for the radio.
- **Result hashes:** a patched image matches the result hashes recorded in the release patch.
- **Interlocks:** the radio's updater refuses an unsafe image or frame in code (address windows away from the
  bootloader and the activation page, image length and header, vector table), and checks the bootloader's ident,
  including that the radio is in update mode, before the first data frame.
- **Radio-specific pre-flight:** attestations, a read-only normal-mode check and, for some radios, a saved safety
  backup of the radio's irreplaceable data.

A small **Start over** link beside the step indicator (every radio) resets the wizard to step 1 with nothing carried over. It is hidden on step 1 and while a flash is running, so it can never interrupt a write.

The RT95 front panel also runs its own pre-flight (attestations and a read-only normal-mode ident) before the wizard
lets you continue (the read-only check can be skipped with the opt-in "I've already tested this radio with Codeplug Studio" box; the attestations cannot); see [RT95 firmware.md](../../reference/radios/retevis/rt95/firmware.md#pre-flight-gate).

Rules: [DESIGN.md — Firmware flashing](../../../DESIGN.md#firmware-flashing). Per-radio interlocks: the "Hard
interlocks" sections of the two radios' `firmware.md`.

## Privacy

Stock firmware and patch files stay in the browser tab's memory and are dropped when you leave the page. Nothing is
written to browser storage or uploaded. The flash summary is only kept if you copy or download it.

## Manual verify

1. `npm run dev`, open `/firmware`. The DM-32UV card shows the pinned stock version.
2. Drop a non-firmware file on the stock step: a refusal message appears and Continue stays disabled.
3. The RT95 front panel card ("Retevis RT95 front panel (LCD)") is offered on dev. Its Stock step lists "Email Retevis
   support" and the unofficial mirror (marked unofficial); Before you flash shows the two attestations and **Check
   the radio**, and Continue stays disabled until both are ticked and the check passed. Hidden under
   `BUILD_ENV=prod npm run dev`.
4. `BUILD_ENV=prod npm run dev`: `/firmware` offers only the radios whose prod gate is cleared (both the DM-32UV and the AT-D890UV), and
   the Tools strip has a Firmware flasher entry. With no radio offered, `/firmware` shows "not available on this
   site yet" and the strip has no entry.
