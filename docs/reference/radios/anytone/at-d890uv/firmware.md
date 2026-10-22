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

Added with the updater ([#1363](https://github.com/pskillen/codeplug-studio/issues/1363) / [#1364](https://github.com/pskillen/codeplug-studio/issues/1364)).
