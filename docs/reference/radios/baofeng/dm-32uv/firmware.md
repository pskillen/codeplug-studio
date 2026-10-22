# Baofeng DM-32UV — firmware

Facts the firmware flasher needs for the DM-32UV: the one stock firmware Studio accepts, how to put the radio into
update mode, and the release patch format. Product rules: [DESIGN.md — Firmware flashing](../../../../../DESIGN.md#firmware-flashing).

**Code mirror:** [`src/core/radios/baofeng/dm-32uv/firmware.ts`](../../../../../src/core/radios/baofeng/dm-32uv/firmware.ts)
(`DM32UV_STOCK_FIRMWARE` and the `DM32UV_FIRMWARE_*` constants). Keep the two in step.

## Stock firmware pin

The user supplies the vendor zip, or the `.bin` extracted from it. Studio never fetches, hosts or commits it.

| Field      | Value                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Version    | `v1.01.048`                                                                                                                               |
| Vendor URL | `https://baofeng.s3.amazonaws.com/Baofeng_DM-32UV_Firmware_v1.01.048.zip` (Baofeng S3 bucket). Studio never fetches this.                 |
| Zip name   | `Baofeng_DM-32UV_Firmware_v1.01.048.zip`                                                                                                  |
| Zip sha256 | `79ee0f41de20231300d6cad1e3d063148cc03c8e3c6d40924fc7198601c6336d` (diagnostic: a re-zipped download is accepted when the member matches) |

| Role  | File name                   | Size (bytes) | sha256                                                             |
| ----- | --------------------------- | ------------ | ------------------------------------------------------------------ |
| `bin` | `DM32_L01_048_20250821.bin` | 860,416      | `fda860febfcf1a234eed7fa73272112891074aac83746e4f8dfe224a2a700f8f` |

Image facts used by the updater:

| Constant                           | Value                       | Meaning                                                                    |
| ---------------------------------- | --------------------------- | -------------------------------------------------------------------------- |
| `DM32UV_FIRMWARE_MODEL_ID`         | `BFUV32-V2`                 | First 9 bytes of every image; the bootloader returns the same as its ident |
| `DM32UV_FIRMWARE_IMAGE_SIZE`       | 860,416                     | Every release is stock length; the updater refuses any other length        |
| `DM32UV_FIRMWARE_HEADER_LEN`       | `0x100`                     | Image header length                                                        |
| `DM32UV_FIRMWARE_BLOCK0_FILE_NAME` | `DM32_L01_048_20250821.bin` | File name sent in YMODEM block 0 for every image, stock or patched         |

## Update-mode entry

Indicator: **green LED**.

1. Turn the radio off and leave the programming cable out of the radio.
2. Hold SK1 and PTT together, then turn the radio on.
3. When the LED lights green, release the keys.
4. Now plug the cable into the radio.

**Warning:** plugging the cable in before power-on can hang the radio until it is power-cycled.

After a stock flash, the radio boots to its normal screen with your channels.

## Release patch format

Each firmware release is a JSON patch (`*.patch.json`): the bytes that differ between the pinned stock image and the
built image, with SHA-256s pinning both ends. Source of truth: the `baofeng-dm32-firmware` project's
`fw/make_patch.py`. Studio's port lives in `src/core/firmware/patch/formats/baofeng-dm32-firmware/`, and is stricter
than the Python, because a user-supplied patch is untrusted input.

| Field            | Type                                       | Meaning                                                                      |
| ---------------- | ------------------------------------------ | ---------------------------------------------------------------------------- |
| `format`         | `1`                                        | Patch format version. Anything else is refused as an unknown format          |
| `name`           | `"baofeng-dm32-firmware"`                  | Selects this format module                                                   |
| `version`        | text                                       | Release version, e.g. `1.0.0`                                                |
| `stock`          | `{ sha256, size }`                         | The stock image the patch was made from (role `bin`)                         |
| `result`         | `{ sha256, size }`                         | The image the patch must produce (role `bin`)                                |
| `segments`       | list of `{ offset, hex }`                  | File offset and replacement bytes. Applied in order; may extend past the end |
| `neutral_sha256` | 64 hex, optional                           | Hash of the build before the version stamp. Not used by Studio               |
| `version_slot`   | `{ offset, len }`, optional, `len` 1 to 64 | Where the release tag is stamped in the result image (NUL-padded ASCII)      |

Unknown extra keys are ignored. `make` merges differing runs closer than 16 bytes into one segment; a result longer
than stock has its tail as one more segment, merged with the last segment when that ends exactly at the stock length.

**Apply order:**

1. The package must hold exactly the `bin` role, and its SHA-256 and size must equal `stock`.
2. Copy the image. For each segment, refuse an `offset` past the current length (a gap), then overwrite
   `hex` at `offset`, growing the image when the segment runs past the end.
3. The result's SHA-256 and size must equal `result`.
4. For the flash summary, the version stamp is read from `version_slot` in the result image, trimmed at the first NUL.

**Refusals:**

| Condition                                                                                      | Code                    |
| ---------------------------------------------------------------------------------------------- | ----------------------- |
| Not UTF-8, or not JSON                                                                         | `patch-unreadable`      |
| Not an object, unknown `name`, or `format` other than 1                                        | `patch-unknown-format`  |
| Missing or mistyped field, negative or non-integer offset, bad hex, bad SHA-256, gap, bad slot | `patch-malformed`       |
| Stock hash or size differs, or the package is not a single `bin`                               | `patch-wrong-stock`     |
| Result hash or size differs                                                                    | `patch-result-mismatch` |

## Bootloader update protocol

Added with the updater ([#1363](https://github.com/pskillen/codeplug-studio/issues/1363) / [#1364](https://github.com/pskillen/codeplug-studio/issues/1364)).
