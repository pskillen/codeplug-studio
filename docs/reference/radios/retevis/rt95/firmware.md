# Retevis RT95 — firmware (front panel and main board)

Facts the firmware flasher needs for the RT95's two MCUs: the **front panel** (the LCD / "head" MCU) and the **main
board** (MAIN, the "RF CPU"). For each, the one stock firmware Studio accepts, where to get it, and how to put the
radio into update mode. Sections below are about the front panel unless headed **Main board**. Product rules:
[DESIGN.md — Firmware flashing](../../../../../DESIGN.md#firmware-flashing).

**Code mirror:** [`src/core/radios/retevis/rt95/firmware.ts`](../../../../../src/core/radios/retevis/rt95/firmware.ts)
(`RT95_HEAD_STOCK_FIRMWARE`, `RT95_MAIN_STOCK_FIRMWARE`, `RT95_HEAD_FIRMWARE_ROLE`). Keep the two in step.

**Offered on every site, prod included** (`prodFlashDisabled: false`, [#1460](https://github.com/pskillen/codeplug-studio/issues/1460)).
The owner has flashed stock V1.41, the ladder test builds and the MM9PDY zones build to an RT95 from Studio (Linux,
PL2303GC cable).

**The main board is a separate firmware radio, `retevis-rt95-main`,** one radio id per MCU, sharing the head's stock
zip. Its facts are the [stock pin](#main-board-stock-pin), [update mode](#main-board-update-mode), the
[pre-flight](#main-board-pre-flight) and the [interlocks](#main-board-interlocks). **The MAIN updater flashes the
pinned stock MAIN, or a MAIN patch file ([format](#main-board-patch-format)), and is hidden on prod**
(`prodFlashDisabled: true`): it is listed on next, dev and staging.

## Stock firmware pin

The user supplies the vendor zip, or the three head files from it. Studio never fetches, hosts or commits them. The zip
also holds the MAIN V1.61 files, the vendor's updater (QXCodePro) and a CPS installer; Studio inflates only the three
head members, matched by file name.

| Field      | Value                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Version    | `LCD V1.41 (20231202)`                                                                                                                      |
| Zip name   | `RT95 Upgrade software-Microphone gain adjustment.zip` (6,068,457 bytes)                                                                    |
| Zip sha256 | `4cbddc96bce718a9990137f3a83cb21dafb78101f0204ebd4fb41da6b8241089` (diagnostic: a re-zipped download is accepted when every member matches) |

| Role  | File name                         | Size (bytes) | sha256                                                             |
| ----- | --------------------------------- | ------------ | ------------------------------------------------------------------ |
| `cdd` | `RT95_LCD(NG)_V1.41_20231202.CDD` | 105,628      | `50c00fc44b3122e54e9e6ea7273519df1b1d05f136d5313120e10d7eb5b03b84` |
| `cdi` | `RT95_LCD(NG)_V1.41_20231202.CDI` | 278          | `a8970f8d6327630569426936465fa40a6734fa0cf91d2f84d21354e7b5ad2b4a` |
| `spi` | `RT95_LCD(NG)_V1.41_20231202.spi` | 10           | `29f97d17af27624d43ed192dc54ed36ed41b852f684a4fc16391e483fbf90164` |

### Stock sources

The wizard lists both as plain text or links; Studio never fetches either.

| Source                | What it is                                                                                                                                                                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email Retevis support | Retevis sends the 2024 mic-gain update package on request. Contact: [the Retevis contact page](https://www.retevis.com/pages/contactus)                                                                                                                                                 |
| Unofficial mirror     | `http://47.253.5.16/soft/RT95%20Upgrade%20software-Microphone%20gain%20adjustment.zip`. A bare IP, **not run by Retevis**, over **plain HTTP**: the browser may warn that the download is not secure. Safe to use only because Studio checks every file against the pinned hashes above |

## Main board stock pin

The same vendor zip as the head (directory `RT95_MAIN(zb)`); Studio inflates only the three MAIN members, matched by
file name. A zip shared by two firmware radios proves nothing about which one the user meant, so a wrong MAIN member
in the right zip is reported as the wrong version, not as front-panel firmware.

| Field   | Value                   |
| ------- | ----------------------- |
| Version | `MAIN V1.61 (20231202)` |
| Zip     | As for the front panel  |

| Role  | File name                      | Size (bytes) | sha256                                                             |
| ----- | ------------------------------ | ------------ | ------------------------------------------------------------------ |
| `cdd` | `RT95_MAIN_V1.61_20231202.CDD` | 55,652       | `ca7918ffd242362b39bda5457b2350ab69d112d4704129187909bcfa1f609551` |
| `cdi` | `RT95_MAIN_V1.61_20231202.CDI` | 278          | `75fce5bd6093449b6a5cd04d2319019b1c4689ea81ac6e8328e2f40fa76af9d9` |
| `spi` | `RT95_MAIN_V1.61_20231202.spi` | 10           | `3d096d4788e747417c669f5348ac4b4c6aa3d31a2bd8dd7799300203729714c3` |

## Main board update mode

Indicator: **the screen says `UPDATE THE RF CPU`** (two lines: `UPDATE THE` / `RF CPU`). Inferred from static analysis
until the owner's first MAIN flash proves it.

1. Studio checks that a safety backup of this radio is saved first.
2. Remove power from the radio; a Power-key off/on is not enough.
3. Hold **P3** and the **channel knob**.
4. Restore power while holding them.
5. Connect the programming cable.

**Warning:** if the screen stays blank you pressed P1: that mode updates the front panel. Remove power and start
again. **Warning:** never flash a radio with a serial number before 2101.

Verify: hold FUNC + P4 while switching on; the test screen shows `RF CPU: V1.11` (a patched MAIN shows the same: the
constant is protected). Turn the knob only, then switch off.

## Main board pre-flight

The wire cannot tell P1 from P3, so the gate is the same hard gate as the head's, with these differences
(`RT95_MAIN_PREFLIGHT` in `preflight.ts`):

- **Attestations:** the head's two (serial 21xx or later; the FUNC + P4 test screen shows LCD CPU V1.11 and RF CPU
  V1.11).
- **Probe:** the head's normal-mode probe (9,600 baud; exactly `PROGRAM`, `02`, `END`). The wrong-radio text names the
  main board ("Studio flashes only the RT95-P main board …").
- **Safety backup (required):** "Your radio's calibration and identity (EEPROM 0x3B00–0x3FFF) cannot be rebuilt if a
  main-board flash goes wrong." Once per radio, keyed by the serial the operator types from the label. If Studio holds a
  record for that serial, the step sends only `PROGRAM`, `02` and `END`; otherwise it reads 0x3B00–0x3FFF (and the
  0x7B00 alias) and offers the zip to save.- **Confirmation on the Flash step (the inverse of the head's):** "The screen says UPDATE THE RF CPU." must be ticked.

## Main board interlocks

Code only; none can be switched off. The head's checks run against the main-board profile (`RT95_MAIN_TARGET`,
`targets.ts`), plus an image rule:

| Fact          | Value                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| Window        | frames inside `0x08002000` to `0x0800FC00` (D35); at most 55 data frames                                             |
| Initial SP    | exactly `0x200013E8`; a head-range SP (above `0x20002000`, at most `0x20005000`) is refused as "a front-panel image" |
| Reset vector  | odd, inside the image (stock `0x08002869`)                                                                           |
| Model         | `RT95-P\0` at `.CDD` offset `0xD65C`                                                                                 |
| Image         | the `.CDI` length is `0xD93C`; the stock `.CDD` has a 40-byte tail that is never sent                                |
| Identity      | stock: every role's SHA-256, computed at flash time, equals the pinned MAIN member. Patched: see below               |
| Outgoing gate | a data frame at or above `0x0800FC00`, or below `0x08002000`, is refused                                             |

**Identity for a patched image** (`createRt95MainImageIdentityCheck`, `targets.ts`) repeats the patch format's rules
at the send path, on purpose: the image's `stockPackage` must hash to the pinned MAIN members; its `.CDD` must equal
`stock[0, 0xD93C)` everywhere except `[0x382, 0x386)`, with a total length of at most `0xDC00`; its `.CDI` and `.spi`
must equal stock except the length field (`.CDI` +0x104, `.spi` +2), which must hold the result length. Anything else is
refused with "This main-board image changes more than D35 allows." The rule does not look at who made the patch: a
user-loaded patch is untrusted input, checked by the strict parser and this check (owner decision 34; no known-good
list, no extra warning, no signing).

Transfer: the PC side is the head's protocol unchanged (115,200 8N1, same cable echo, `PROGRAM` then `06`, 1,032-byte
frames, end byte `18`). The head re-checks each frame's sum and relays it to MAIN at 37,500 baud; only MAIN's `06`
comes back. If MAIN is not in its bootloader the bridge loops and the PC sees silence (a timeout, then a resend, then
the "Is the main board in update mode?" message). About 20 to 25 s for 55 frames (estimate, not measured).

## Update-mode entry

Indicator: **blank screen**.

1. Take a backup with Studio's Read first.
2. Switch the radio off.
3. Hold **P1** and press and hold the **channel knob**, then switch the radio on.
4. The screen stays blank: that is update mode.
5. Connect the programming cable.

**Warning — P3 is the wrong mode.** P3 + knob also answers the vendor's handshake, but it relays to the **main board**
and the screen shows `UPDATE THE / RF CPU`. Studio cannot tell the two modes apart on the wire; the screen is the only
tell. If you see that text, switch off and start again.

**Warning — serial numbers before 2101.** The 2024 package is documented for serials 202101 and later. First-revision
radios are reported bricked by it.

After a stock flash, hold FUNC + P4 while switching on: the test screen shows `LCD CPU: V1.11`. Turn the knob only,
then switch off.

## Pre-flight gate

The update-mode bootloader has **no ident**: no byte on the wire names the target, the package has no model string,
and the P1 mode (front panel, blank screen) and the P3 mode (main board, "UPDATE THE RF CPU") both answer the
handshake with `06`. Studio cannot tell them apart, so the Before-you-flash step is a hard gate. Continue stays
disabled until all of these hold (`preflight` on the descriptor; code in `preflight.ts`):

1. **Attestation:** "My radio's serial number starts 21xx or later." First-revision radios (serial before 2101, no VOX)
   are reported bricked by this firmware.
2. **Attestation:** "The FUNC + P4 test screen shows LCD CPU V1.11 and RF CPU V1.11." (Back up first; in test mode
   turn only the knob.)
3. **Probe, "Check the radio":** with the radio switched on **normally** and the cable connected, Studio opens the
   port at **9,600** (the codeplug baud rate) and sends exactly `PROGRAM`, `02` and `END`. The reply must be the
   ident `RT95-P`, version `V100` (a first-revision radio reports `RT95`). `END` is sent on every path after a
   successful enter, which leaves clone mode and puts the main board back. It writes nothing. Because the radio
   ignores `PROGRAM` for about 3 to 5 seconds after `END` (for example right after a Studio Read), the probe makes up
   to 5 attempts, one second apart. A wrapper around the port allows only those three byte strings.
4. **Confirmation on the Flash step:** "The screen is blank. It does not say UPDATE THE RF CPU." must be ticked before
   **Connect and flash** is enabled.

   **Opt-out:** the step has an unticked-by-default box, "I've already tested this radio with Codeplug Studio". Ticking
   it disables the **Check the radio** button and lets the operator continue without the reboot to normal mode and
   back. The attestations and the Flash-step confirmation stay required. The probe is a wizard convenience, not an
   interlock: the send path never reads its result, and the stock pin, image checks, prod gate and bootloader
   handshake apply either way.

The probe cannot prove which MCU a later P1 or P3 start-up reaches; the confirmation and the update-mode copy do.
An automatic check would need further reverse engineering.

## Main board patch format

A MAIN patch is JSON with `name` `retevis-rt95-main-firmware`, `format` 1: a separate name from the head's
`retevis-rt95-firmware`, so an older Studio refuses it as an unknown name instead of trying it on head stock. The
fields are the head's (`stock` and `result` hashes for `.CDD`, `.CDI`, `.spi`; `hooks`; `append`), with these rules.
Source of truth: the firmware project's `docs/reference/patch-format.md` (MAIN section), `fw/make_patch.py`
(`apply_main`) and decision D37. Studio's port is `src/core/firmware/patch/formats/retevis-rt95-main-firmware/` and is
stricter than the Python.

| Rule          | Value                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hook          | none or one, at `.CDD` file offset `0x382`, exactly 4 bytes, `original` = `08 f0 81 fe` (the `bl 0x0800B088`; D35's only site)                   |
| Append        | `offset` = `0xD93C`; at most 708 bytes (the image ends at or before `0xDC00`, address `0x0800FC00`)                                              |
| Tail rule     | the result `.CDD` is `stock[0, 0xD93C)` + hook + append: the stock's 40-byte tail is always dropped, so a zero-change patch's `.CDD` is 55,612 B |
| Lengths       | `.CDI` +0x104 and `.spi` +2 carry the result length                                                                                              |
| Version stamp | none; the RF CPU constant is protected, so FUNC + P4 shows the same `RF CPU: V1.11` for stock and patched                                        |

Refused ranges (a hook on any of them, `fw/main/protect.toml`; `.CDD` file offsets, half-open): vector table
`[0x0000, 0x0150)`; model string `[0xD65C, 0xD663)`; RF CPU constant `[0xD667, 0xD669)`; scatter-load table and RW-init
data `[0xD8D8, 0xD93C)`; EEPROM read `[0x94E4, 0x958C)`; EEPROM write `[0x958C, 0x9648)`; RF write `[0x9792, 0x97EA)`.

**Gated by construction upstream.** The firmware project's `make_patch --target main` refuses any build that changes
MAIN and did not pass its D35 gate (static checks and the Unicorn hook test), so CI-built MAIN patches are gated.
CI uploads them as artifact `rt95-main-fw-<label>` (`rt95-main-fw-<label>.patch.json`, a `-probe` variant,
`SHA256SUMS`); the owner loads one as a user patch. Releases are published to `releases/retevis-rt95-main/` in the
public repository with `radioId` `retevis-rt95-main`, `patchName` `retevis-rt95-main-firmware`, `assetPrefix`
`rt95-main-fw-` and `stockVersion` `MAIN V1.61 (20231202)`. Studio does not rely on that gate: it checks every patch
structurally and again at the send path.

Tests copy the firmware project's conformance vector (`fw/main/tests/vectors/main-patch-vector.json`) verbatim; replace
it only from a new firmware commit.

## Release patch format

A release is a JSON patch (`*.patch.json`, named `rt95-fw-<label>.patch.json` by the firmware project) over the
three-file package: in-place hooks with their original bytes, bytes appended to the `.CDD`, and SHA-256s pinning every
stock and result file. The fields are those of the AT-D890UV format 1 with `name` `retevis-rt95-firmware` and no
version stamp. Source of truth: the firmware project's `docs/reference/patch-format.md` and `fw/make_patch.py` (its
`fw/protect.toml` holds the protect table below). Studio's port is
`src/core/firmware/patch/formats/retevis-rt95-firmware/` and is stricter than the Python, because a user-supplied patch
is untrusted input.

| Field     | Type                                                  | Meaning                                                                 |
| --------- | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `format`  | `1`                                                   | Anything else is refused as an unknown format                           |
| `name`    | `"retevis-rt95-firmware"`                             | Selects this format module                                              |
| `version` | text                                                  | The label; display only                                                 |
| `stock`   | `{ ".CDD", ".CDI", ".spi" }`, each `{ sha256, size }` | The stock files the patch was made from. Exactly these three keys       |
| `result`  | same shape as `stock`                                 | The files the patch must produce                                        |
| `hooks`   | list of `{ offset, original, hex }`                   | In-place replacements in `.CDD`; `original` and `hex` have equal length |
| `append`  | `{ offset, hex }`                                     | Bytes appended to `.CDD`; `offset` must equal the stock `.CDD` length   |

A zero-change patch is valid (`"hooks": []`, empty `append`) and applies to stock to give stock.

**Apply:** check the three stock hashes and sizes; for each hook check `original` and write `hex`; append; write the
new `.CDD` length as a u32 little-endian at **`.CDI` + 0x104** and **`.spi` + 2** (the RT95 `.spi` is
`{u16 count, u32 total, u32 0}`; the AT-D890UV's length is at +6); check the three result hashes and sizes.

**Refusals** (`patch-malformed` unless noted):

| Condition                                                                                            | Why                                                                               |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| The result `.CDD` is longer than `0x1E000` bytes                                                     | The image must end at or below `0x08020000`, the end of the flasher's window      |
| A hook overlaps a protected range (below)                                                            | Those bytes keep the radio identifiable and the main-board update path working    |
| One hook is longer than 32 bytes, or the hooks' `original` bytes total more than 256                 | A patch carries our code and a few stock bytes, never a slice of the vendor image |
| A hook changes the length or runs past the stock image, or the append offset is not the stock length | Structural                                                                        |
| A stock file's hash or size differs (`patch-wrong-stock`)                                            | The patch was made for other stock                                                |
| A hook's `original` bytes differ from the stock image (`patch-original-mismatch`)                    | The stock is not what the patch expects                                           |
| A result file's hash or size differs (`patch-result-mismatch`)                                       | The patch does not reproduce what it recorded                                     |

**Protected ranges** (`.CDD` file offsets, end exclusive; file offset = address − `0x08002000`). Mirrors the firmware
project's `fw/protect.toml`; "build" rows are build-side additions that Studio refuses too.

| Addresses                 | File offsets         | Scope   | What                                                                         |
| ------------------------- | -------------------- | ------- | ---------------------------------------------------------------------------- |
| `0x08002000`–`0x08002007` | `[0x0000, 0x0008)`   | flasher | Initial SP and reset vector                                                  |
| `0x08004F1C`–`0x08005017` | `[0x2F1C, 0x3018)`   | flasher | Main-board update bridge, body and literal pool                              |
| `0x080170EE`–`0x080170F1` | `[0x150EE, 0x150F2)` | flasher | The bridge's only call, in `main`                                            |
| `0x08017360`–`0x08017366` | `[0x15360, 0x15367)` | flasher | `RT95-P\0`, the model string the head's own check compares                   |
| `0x08005074`–`0x08005077` | `[0x3074, 0x3078)`   | flasher | Literal pointing at the model string                                         |
| `0x0801722D`–`0x08017233` | `[0x1522D, 0x15234)` | flasher | PC-link ident copy of the model                                              |
| `0x08017234`–`0x08017237` | `[0x15234, 0x15238)` | flasher | PC-link ident copy of the version (`V100`)                                   |
| `0x0800B108`–`0x0800B10B` | `[0x9108, 0x910C)`   | build   | Literal pointing at the model string, read by the redraw's error screen      |
| `0x08015058`–`0x08015C1F` | `[0x13058, 0x13C20)` | build   | PC-link handler with its jump tables and literals                            |
| `0x08017216`–`0x0801721D` | `[0x15216, 0x1521E)` | build   | `PROGRAM\0`, sent to the main board by the bridge and matched by the handler |
| `0x08013E72`–`0x08013E75` | `[0x11E72, 0x11E76)` | build   | The main loop's call into the PC-link handler                                |

## Bootloader update protocol

Studio's updater is a port of the firmware project's `tools/rt95update.py`; protocol notes: that project's
`docs/reference/update-protocol.md`. Static analysis of the vendor updater only: nothing here has been seen on a radio
from Studio yet.

**Code:** `src/integrations/radio-io/radios/rt95/firmwareUpdate/` — `constants.ts`, `package.ts`
(`parseRt95HeadPackage`, `rt95HeadBlocks`), `frames.ts`, `echo.ts`, `targets.ts` (`RT95_HEAD_TARGET`: the per-MCU window, SP rule, model offset and refusal copy that
`interlocks.ts` and `updater.ts` read), `interlocks.ts`, `updater.ts`, `preflight.ts`,
`descriptor.ts` (`RT95_HEAD_FIRMWARE_UPDATER`). Test radio: `__fixtures__/rt95BootloaderMock.ts` with the synthetic
packages from `__fixtures__/syntheticPackage.ts`.

### Link

| Setting     | Value                                                                                                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cable       | A programming cable with a USB-serial chip (Prolific PL2303 `067b:2303` and PL2303GC `067b:23a3`, WCH CH340 or FTDI FT232R are in the picker filter). The ID identifies the cable, not the mode |
| Serial      | 115,200 8N1; DTR and RTS raised                                                                                                                                                                 |
| Echo        | Single-wire cable: by default every byte sent comes back as an echo first                                                                                                                       |
| Normal mode | The head's PC link runs at 9,600 (used only by the pre-flight probe)                                                                                                                            |

### Package layout

| File   | Layout                                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.spi` | Exactly 10 bytes: `{u16 count = 1, u32 total, u32 0}`. No model string                                                                                                    |
| `.CDI` | One 278-byte entry: name (`0x100` bytes, space- or NUL-padded), then u32 LE `dest` (`0x08002000`, 1 KiB aligned), `len`, `offset`, `flag` (`0x00010000`) and 6 zero bytes |
| `.CDD` | The image. `len` bytes from `offset` are sent to `dest`, in 1,024-byte blocks; the last block is zero-padded. A longer `.CDD` is allowed; only `len` is sent              |

### Session

| Step      | TX                                                               | Expected RX         | Timeout                             |
| --------- | ---------------------------------------------------------------- | ------------------- | ----------------------------------- |
| handshake | `PROGRAM`                                                        | `06`                | 2 s, up to 3 tries                  |
| data      | `01` + address (u32 LE) + 1,024 data bytes + sum (u16 LE) + `06` | `06`, or `15` (NAK) | 10 s for the first frame, 3 s after |
| end       | `18`                                                             | `06`, or nothing    | 2 s                                 |

The sum covers frame bytes 1 to `0x404` inclusive (the address and the data). A frame is 1,032 bytes.

- **Echo detection.** If the first byte back after `PROGRAM` is `P`, the line echoes: Studio reads the other six echo
  bytes and then the reply. If it is `06`, the line does not echo. The mode is fixed for the session. In echo mode
  every sent frame's echo must equal what was sent; a mismatch stops the session with nothing more sent (no
  automatic resend).
- **Resends.** On `15`, a timeout or silence, Studio clears the receive buffer and resends the same frame, at most 3
  times (4 sends in all; the vendor resends without limit). A final failure aborts; nothing more is sent, and in
  particular no `18`.
- **A radio switched on normally.** If the reply to `PROGRAM` is `QX 06`, the radio is in normal mode: Studio sends
  `END` (restores the main board), writes no frame and says so.
- **End handling.** `06` is `acknowledged`; silence is `no-reply`; the port closing is `port-closed-by-radio`. All are
  success, because every frame was acknowledged. Any other byte is an error.
- Frame counts: the stock head `.CDD` is 105,628 bytes, **104** frames (`0x08002000` to `0x0801C000`).

### Hard interlocks

None can be switched off by a setting, flag, environment value or patch field.

1. **Target binding:** radio id `retevis-rt95-head`; exactly the `cdd`, `cdi` and `spi` roles.
2. **Package shape:** the `.spi`, `.CDI` and length checks above; an entry that runs past the `.CDD` is refused.
3. **Address window:** every block lies in `0x08002000 ≤ a` and `a + 1024 ≤ 0x08020000`. Nothing is ever sent below
   `0x08002000` (the bootloader).
4. **Vector table:** the initial SP is above `0x20002000` and at most `0x20005000` (the head's 20 KB of SRAM; the main
   board's image has `0x200013E8` and is refused as "a main-board image"), and the reset vector is odd and inside the
   image.
5. **Model string:** `RT95-P\0` at `.CDD` offset `0x15360`.
6. **Outgoing gate on every write:** only `PROGRAM`, `18`, `END` (only on the normal-mode exit path above) and a
   well-formed data frame (`01` first, `06` last, a correct sum, inside the window). `02`, codeplug `R`/`W` frames and
   empty frames are refused, and a refusal aborts the session.

Plus the [pre-flight gate](#pre-flight-gate) in the wizard. Interlocks 1 to 5 run when the image is prepared and again
in `flash()`.

### Abort, `radioTouched` and timing

- Cancel is checked between frames, never mid-frame.
- `radioTouched` becomes true immediately before the first data frame. `PROGRAM` writes nothing.
- Every failure from `flash()` is a `FirmwareFlashError` with `radioTouched` and the position, e.g.
  `frame 3/104 @ 0x08002C00`. The caller closes the port.
- The updater times each data frame from write to `06` and reports the median, p99 and maximum. Duration is an
  estimate (about 15 to 25 s for the head); it has not been measured on a radio.

## Recovery

If a flash stops after the radio was touched, re-enter update mode (P1 + knob, blank screen) and flash again, or flash
stock from the wizard's **Stock firmware** entry. Full steps:
[Firmware flashing — Recovery](../../../../features/firmware-flashing/README.md#recovery).

- **Vendor fallback.** The vendor's updater (QXCodePro, Windows) is in the same Retevis package as the stock firmware.
- **Main board.** Recovery order is **head first, then MAIN**: the main board is reached through the front panel's
  bridge, so a working front panel (stock V1.41 from the wizard if needed) comes first. Then re-enter MAIN update mode
  (cold power-up, P3 + knob, the screen says UPDATE THE RF CPU) and flash the pinned stock MAIN V1.61; stock MAIN is
  the way back. The safety backup holds the calibration and identity (EEPROM 0x3B00–0x3FFF); Studio has no
  restore for it yet, use the firmware project's restore tools.
