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

## Bootloader update protocol

Added with the updater ([#1363](https://github.com/pskillen/codeplug-studio/issues/1363) / [#1364](https://github.com/pskillen/codeplug-studio/issues/1364)).
