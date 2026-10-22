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

Studio's updater ([#1363](https://github.com/pskillen/codeplug-studio/issues/1363)) is a byte-exact port of the
firmware project's `tools/flash/dm32_fw_send.py`, whose frame plan equals a USB capture of the official CPS byte for
byte. Protocol notes: that project's `docs/reference/update-protocol.md`.

**Code:** `src/integrations/radio-io/radios/dm32uv/firmwareUpdate/` — `constants.ts` (link, frame bytes, timeouts),
`crc16Xmodem.ts`, `plan.ts` (`buildDm32FirmwarePlan`), `interlocks.ts`, `updater.ts`, `descriptor.ts`
(`DM32UV_FIRMWARE_UPDATER`). Test bootloader: `__fixtures__/dm32BootloaderMock.ts` (synthetic images only).

### Link

| Setting  | Value                                                                                                                                           |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Cable    | CH340, USB `1a86:7523`                                                                                                                          |
| Serial   | 115200 8N1, no flow control                                                                                                                     |
| Signals  | DTR and RTS raised (as the CPS does)                                                                                                            |
| Picker   | Filtered to `1a86:7523`. The filter identifies the cable, not whether the radio is in update mode: the cable enumerates with or without a radio |
| Pre-send | Before every frame: clear the receive buffer, wait 10 ms (the CPS's ComWrite), then write                                                       |

### Session

Every frame is precomputed from the image before the first byte is sent. Each step sends its TX and must read back
exactly its expected RX within the timeout. There is no NAK, no resend and no resume: any other reply, or silence,
aborts at once.

| Step           | TX                                   | Expected RX                 | Timeout | Phase     |
| -------------- | ------------------------------------ | --------------------------- | ------- | --------- |
| `init`         | `52`                                 | `06`                        | 0.5 s   | handshake |
| `model-query`  | `4D 00 00 00 01`                     | `4D 01 09`                  | 0.5 s   | handshake |
| `model-id`     | `06`                                 | `image[0..9)` = `BFUV32-V2` | 0.5 s   | handshake |
| `prelude-45`   | `45 00 00 00 00`                     | `06`                        | 0.5 s   | handshake |
| `prelude-31`   | `31`                                 | `43` (`C`)                  | 5 s     | handshake |
| `soh-block0`   | `01`                                 | `43`                        | 5 s     | handshake |
| `block0+erase` | `00 FF` + block 0 + CRC (0x84 bytes) | `06 43`                     | 60 s    | erase     |
| `type#n`       | `02` (1024-byte block) or `01` (128) | `43`                        | 10 s    | transfer  |
| `block#n`      | `seq`, `FF-seq`, data, CRC           | `06`                        | 10 s    | transfer  |
| `eot`          | `04`                                 | 1 byte, ignored             | 5 s     | finish    |

The first three steps are the non-destructive ident (`identify()`). The erase happens in reply to block 0: the CPS
waits 20 s, the erase was observed at 12.6 s, and Studio waits 60 s.

### Frames

- **Block 0:** `<file name>\0<body length in decimal>`, zero-padded to 0x80 bytes. The file name is always
  `DM32_L01_048_20250821.bin`, for patched images too. For a stock-length image the body length is `860160`, and the
  block 0 CRC is `0x4227`.
- **CRC:** CRC16-XMODEM (poly 0x1021, init 0, MSB first, no xorout), sent big-endian. `crc("123456789") = 0x31C3`.
- **Data blocks:** the body (the image after its 0x100-byte header) in 1024-byte STX blocks; a tail under 1024 bytes
  goes in 128-byte SOH blocks. The last block is padded with `0x1A`.
- **Sequence:** starts at 1 and wraps from `0xFF` to `0x00`.
- **Header:** the image's first 0x100 bytes are never sent.
- **Stock-length image:** 840 STX blocks, last sequence `0x48`; 6 + 1 + 840 × 2 + 1 = 1,688 frames.

### Hard interlocks

None can be switched off by a setting, flag, environment value or patch field.

1. **Image:** radio id `baofeng-dm32uv`; exactly one file (role `bin`); exactly 860,416 bytes; bytes 0–8 equal
   `BFUV32-V2`; the CPS's header check (`E` at `0xFD`, `N` at `0xFE` or `D` at `0xFF`). Checked when the image is
   prepared and again in `flash()`.
2. **Model:** the image's first 9 bytes must equal the bootloader's ident, checked before the erase.
3. **Frames:** every byte goes through the single guarded send. The guard copies the precomputed plan and accepts
   exactly the next frame; anything else is refused and the session aborts.

### Abort and `radioTouched`

- Cancel is checked between frames, never mid-frame.
- `radioTouched` becomes true immediately before the `block0+erase` frame is sent. Before that, nothing has been
  written and the operator can simply power-cycle and retry. After it, the radio needs a re-flash (re-enter update
  mode and flash again, or flash stock).
- Every failure from `flash()` is a `FirmwareFlashError` carrying the cause, `radioTouched` and the step name it
  stopped at (e.g. `block#57`). The updater never closes the port; the caller does.
- A silent EOT is not an error: the session ends with `eot-sent`.
