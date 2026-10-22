# AnyTone AT-D890UV — firmware

Facts the firmware flasher needs for the AT-D890UV: the one stock firmware Studio accepts, how to put the radio into
update mode, and the release patch format. Product rules: [DESIGN.md — Firmware flashing](../../../../../DESIGN.md#firmware-flashing).

**Code mirror:** [`src/core/radios/anytone/at-d890uv/firmware.ts`](../../../../../src/core/radios/anytone/at-d890uv/firmware.ts)
(`AT_D890UV_STOCK_FIRMWARE`, `AT_D890UV_FIRMWARE_ROLE`). Keep the two in step.

## Stock firmware pin

The user supplies the vendor zip, or the three files extracted from it. Studio never fetches, hosts or commits them.
Only the three firmware entries are decompressed from the zip; the ICON pack is never inflated.

| Field      | Value                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Version    | `V1.05 (20260521)`                                                                                                                                           |
| Vendor URL | `https://anytoneusa.com/Files/D890UV%20V1.05%20DMR%20official%20release%20260521.zip` (anytoneusa.com, 12 Volt Power, US dealer). Studio never fetches this. |
| Size note  | About 44.5 MB: the zip also holds the ICON pack, which Studio does not use                                                                                   |
| Zip name   | `D890UV V1.05 DMR official release 260521.zip`                                                                                                               |
| Zip sha256 | `193a4c24956a13094d3d529975d1f16077418d6527afaeb3de96c8628547f731` (diagnostic: a re-zipped download is accepted when every member matches)                  |

| Role  | File name                   | Size (bytes) | sha256                                                             |
| ----- | --------------------------- | ------------ | ------------------------------------------------------------------ |
| `cdd` | `D890UV_V1.05_20260521.CDD` | 1,675,272    | `6d84926eecf309b25f68287d3521adaae2765f171db9d9f6a1358a454c71c96e` |
| `cdi` | `D890UV_V1.05_20260521.CDI` | 278          | `b24dd25aa02d0d72b6ba32b3b6c0d08d787f40248c80132cc4d5d7942c0470de` |
| `spi` | `D890UV_V1.05_20260521.spi` | 51           | `857771404d6ac1e38c9427ae1735007af0d174e27fc59fa1dfa1881560319c8a` |

## Update-mode entry

Indicator: **red LED blinking, screen blank**.

1. Switch the radio off. Check the battery is full.
2. Hold PTT and PF3, and switch the radio on. Keep holding for 2 to 3 seconds.
3. The red LED blinks and the screen stays blank. There is no sound.
4. Plug the USB cable in.

**Warning:** in update mode the radio appears on the computer exactly as in normal mode. The blinking red LED is the
only sign.

After a stock flash, Menu > Device Info > Version shows "Ver 1.05".

## Recovery

If a flash stops after the radio was touched, re-enter update mode (above) and flash again, or flash stock from the
wizard's **Stock firmware** entry. Full steps, and the vendor CPS fallback:
[Firmware flashing — Recovery](../../../../features/firmware-flashing/README.md#recovery).

## Release patch format

Each firmware release is a JSON patch (`*.patch.json`) over the three-file package: in-place hooks with their original
bytes, bytes appended to the `.CDD` image, and SHA-256s pinning every stock and result file. Source of truth: the
`anytone-d890-firmware` project's `fw/make_patch.py`. Studio's port lives in
`src/core/firmware/patch/formats/anytone-d890-firmware/`, and is stricter than the Python, because a user-supplied
patch is untrusted input.

| Field     | Type                                                  | Meaning                                                                 |
| --------- | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `format`  | `1`                                                   | Patch format version. Anything else is refused as an unknown format     |
| `name`    | `"anytone-d890-firmware"`                             | Selects this format module                                              |
| `version` | text                                                  | Release version, e.g. `1.0.0`                                           |
| `stock`   | `{ ".CDD", ".CDI", ".spi" }`, each `{ sha256, size }` | The stock files the patch was made from. Exactly these three keys       |
| `result`  | same shape as `stock`                                 | The files the patch must produce. Exactly these three keys              |
| `hooks`   | list of `{ offset, original, hex }`                   | In-place replacements in `.CDD`; `original` and `hex` have equal length |
| `append`  | `{ offset, hex }`                                     | Bytes appended to `.CDD`; `offset` must equal the stock `.CDD` length   |

Wire keys map to member roles: `.CDD` → `cdd`, `.CDI` → `cdi`, `.spi` → `spi`. Unknown extra top-level keys are
ignored. `make` merges hooks closer than 16 bytes into one, stores the stock bytes of that run as `original`, and
refuses a `.CDI` or `.spi` that differs from stock by more than the length field.

**Apply order:**

1. The package must hold exactly the `cdd`, `cdi` and `spi` roles, and each file's SHA-256 and size must equal
   `stock`.
2. Copy `.CDD`. For each hook, refuse one that runs past the stock image or changes length, check the bytes at
   `offset` equal `original`, then write `hex`.
3. Refuse an `append.offset` other than the `.CDD` length, then append `hex`.
4. Copy `.CDI` and `.spi`, writing the new `.CDD` length as a u32 little-endian at `.CDI` + `0x104` and `.spi` + `6`.
   A length field outside its file is refused.
5. Each result file's SHA-256 and size must equal `result`.

There is no version stamp slot in this format: the radio shows its version under Menu > Device Info.

**Refusals:**

| Condition                                                                                                                                     | Code                      |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Not UTF-8, or not JSON                                                                                                                        | `patch-unreadable`        |
| Not an object, unknown `name`, or `format` other than 1                                                                                       | `patch-unknown-format`    |
| Missing, extra or mistyped keys, bad hex or SHA-256, out-of-range or length-changing hook, wrong append offset, length field outside its file | `patch-malformed`         |
| A stock file's hash or size differs, or a role is missing                                                                                     | `patch-wrong-stock`       |
| A hook's `original` bytes differ from the stock image                                                                                         | `patch-original-mismatch` |
| A result file's hash or size differs                                                                                                          | `patch-result-mismatch`   |

## Bootloader update protocol

Studio's updater ([#1364](https://github.com/pskillen/codeplug-studio/issues/1364)) is a byte-exact port of the
`anytone-d890-firmware` project's `tools/d890update.py`, **firmware mode only**. Protocol notes: that project's
`docs/reference/firmware/update-protocol-and-bootloader.md` (private repository). Resource mode (`PROGRAM`, the ICON
pack) is deliberately not supported: a 14-byte `.spi` is refused.

**Code:** `src/integrations/radio-io/radios/at-d890uv/firmwareUpdate/` — `constants.ts` (link, bytes, windows,
timeouts), `package.ts` (`parseD890FirmwarePackage`, `d890Blocks`), `frames.ts` (`makeD890UpdateFrame`),
`interlocks.ts`, `updater.ts`, `descriptor.ts` (`AT_D890UV_FIRMWARE_UPDATER`). Test bootloader:
`__fixtures__/d890BootloaderMock.ts`, with synthetic packages from `__fixtures__/syntheticPackage.ts`.

### Link

| Setting | Value                                                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| USB     | ST CDC, `0483:5740`: the **same ID in normal and update mode**. The picker filter identifies the device, not the mode         |
| Serial  | 921600 8N1 (CDC ignores the rate)                                                                                             |
| Signals | DTR and RTS raised                                                                                                            |
| Mode    | Only the blinking red LED shows update mode. The bootloader's ident band byte (below) is how Studio tells the two modes apart |

### Package layout

| File   | Layout                                                                                                                                                                                                                 |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.spi` | 50 or 51 bytes. u32 LE `0x20` at 0; u16 LE entry count at 4; u32 LE total `.CDD` length at 6; model at `0x0E..0x14` (`D890UV`); version at `0x16..0x1A` (e.g. `V100`). A 14-byte `.spi` is an ICON pack and is refused |
| `.CDI` | Entry count × 278 bytes. Each entry: name (`0x100` bytes, NUL- or space-padded), then u32 LE `addr`, `len`, `off`, `flag` at `0x100`                                                                                   |
| `.CDD` | The image. Entry _i_ sends `.CDD[off .. off+len)` to `addr`, in 32-byte blocks; the last block of an entry is zero-padded                                                                                              |

### Frames

A data frame is 40 bytes: `01`, the address (u32 LE), 32 data bytes, a 16-bit sum (LE) of bytes `[1, 37)` (address and
data), then `06`.

| Step        | TX            | Expected RX                                                            | Timeout                                                           |
| ----------- | ------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| update      | `UPDATE`      | Bytes read one at a time until `06` (at most 16)                       | 2 s overall                                                       |
| ident       | `02`          | 16 bytes: `I`, model (7, NUL-padded), band, version (4), `00 00`, `06` | 2 s                                                               |
| data (each) | 40-byte frame | `06`                                                                   | 30 s for the first frame (it may follow a flash erase), 2 s after |
| end         | `18`          | See end handling                                                       | 2 s                                                               |

`UPDATE` and the ident are the non-destructive `identify()`. **Resend rule:** on `15` (NAK), any other byte, or a
timeout, Studio clears the receive buffer and resends the same frame **once**. A second failure aborts; nothing more is
sent, and in particular no end byte.

Frame counts: stock V1.05 `.CDD` is 1,675,272 bytes, **52,353** frames; release `1.0.0` is 1,680,476 bytes, **52,515**
frames. Each frame waits for its own `06`; frames are never pipelined.

### End handling

| After `18`        | Result                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `06`              | `acknowledged`: success                                                                            |
| The port closes   | `port-closed-by-radio`: success. The bootloader usually restarts at once and its USB port vanishes |
| Silence (timeout) | `no-reply`: not an error, since every frame was acknowledged; the operator checks Device Info      |
| Any other byte    | Error                                                                                              |

The port closing **before** `18` is an error.

### Hard interlocks

None can be switched off by a setting, flag, environment value or patch field.

1. **Image:** radio id `anytone-at-d890uv`; exactly the `cdd`, `cdi` and `spi` roles; the package parses (lengths
   agree, no entry runs past the `.CDD`). Checked when the image is prepared and again in `flash()`.
2. **Address window:** every 32-byte block must lie in `0x0800C000 ≤ a` and `a + 32 ≤ 0x081E4000`, and must not
   overlap the activation page `0x0800A000..0x0800C000` (the bootloader sits below it).
3. **First entry** loads at `0x0800C000`.
4. **Vector table:** the image's initial stack pointer is in SRAM (`0x20000000..0x20040000`) and its reset vector is
   odd and inside the first entry.
5. **Ident:** the bootloader's model and version must equal the package's (`Model Error` otherwise), and the band
   byte (ident byte 8) must be `00`, the bootloader. `03` means the radio is in normal mode. Both are checked before
   any data frame.
6. **Frames:** every byte goes through the single guarded send. The guard allows only `UPDATE`, `02`, `18` and
   well-formed data frames (correct sum, safe address); anything else is refused and the session aborts.

### Abort, `radioTouched` and timing

- Cancel is checked between frames, never mid-frame.
- `radioTouched` becomes true immediately before the first data frame. `UPDATE` and the ident erase nothing: before
  that, the operator can power-cycle and retry.
- Every failure from `flash()` is a `FirmwareFlashError` with `radioTouched` and the position, e.g.
  `frame 3/52515 @ 0x0800C040`. The updater never closes the port; the caller does.
- The updater times each data frame from write to `06` and reports the median, p99 and maximum in the flash result
  (and on a failure), shown in the flash summary.
