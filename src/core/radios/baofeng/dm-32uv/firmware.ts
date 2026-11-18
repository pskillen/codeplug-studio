/**
 * Baofeng DM-32UV pinned stock firmware and update-mode facts.
 * Code mirror of [firmware.md](../../../../docs/reference/radios/baofeng/dm-32uv/firmware.md).
 * Used by the firmware flasher only — not library CRUD or codeplug Write.
 */
import type { StockFirmwareDescriptor } from '../../../firmware/types.ts';

/** Member role of the single firmware image. */
export const DM32UV_FIRMWARE_ROLE_BIN = 'bin';
/** First 9 bytes of every DM-32UV image; the bootloader returns the same 9 bytes as its ident. */
export const DM32UV_FIRMWARE_MODEL_ID = 'BFUV32-V2';
/** Stock v1.01.048 length (840 KiB body + header). The updater refuses anything shorter. */
export const DM32UV_FIRMWARE_IMAGE_SIZE = 860_416;
export const DM32UV_FIRMWARE_HEADER_LEN = 0x100;
/** Where the image body (file offset 0x100) loads in program flash. */
export const DM32UV_FIRMWARE_BODY_LOAD_ADDRESS = 0x0300_c000;
/**
 * End of the app area the bootloader erases (exclusive). From RadioFoundry's notes (inferred, not read out of the
 * bootloader). RadioFoundry has flashed a 996,868-byte image through the stock bootloader and it booted.
 * The flash part is 1 MiB or 2 MiB (not yet known), so this is the proven 1 MiB bound; raise it once the flash size is
 * known.
 */
export const DM32UV_FIRMWARE_APP_AREA_END = 0x0310_0000;
/**
 * Largest image the updater sends: header + a body that fills the app area to its end
 * (0x100 + 0xF4000 = 999,680 bytes). Owner decision 88: images may be as long as the silicon allows.
 */
export const DM32UV_FIRMWARE_MAX_IMAGE_SIZE =
  DM32UV_FIRMWARE_HEADER_LEN + (DM32UV_FIRMWARE_APP_AREA_END - DM32UV_FIRMWARE_BODY_LOAD_ADDRESS);
/** File name sent in YMODEM block 0 for every image, stock or patched (what every successful write has used). */
export const DM32UV_FIRMWARE_BLOCK0_FILE_NAME = 'DM32_L01_048_20250821.bin';

export const DM32UV_STOCK_FIRMWARE: StockFirmwareDescriptor = {
  radioId: 'baofeng-dm32uv',
  label: 'Baofeng DM-32UV',
  version: 'v1.01.048',
  stockSources: [
    {
      kind: 'download',
      label: 'Vendor download',
      official: true,
      url: 'https://baofeng.s3.amazonaws.com/Baofeng_DM-32UV_Firmware_v1.01.048.zip',
      host: 'Baofeng (S3 bucket)',
    },
  ],
  zip: {
    fileName: 'Baofeng_DM-32UV_Firmware_v1.01.048.zip',
    sha256: '79ee0f41de20231300d6cad1e3d063148cc03c8e3c6d40924fc7198601c6336d',
  },
  members: [
    {
      role: DM32UV_FIRMWARE_ROLE_BIN,
      fileName: 'DM32_L01_048_20250821.bin',
      size: DM32UV_FIRMWARE_IMAGE_SIZE,
      sha256: 'fda860febfcf1a234eed7fa73272112891074aac83746e4f8dfe224a2a700f8f',
    },
  ],
  patchNames: ['baofeng-dm32-firmware'],
  bootloaderEntry: {
    steps: [
      'Turn the radio off and leave the programming cable out of the radio.',
      'Hold SK1 and PTT together, then turn the radio on.',
      'When the LED lights green, release the keys.',
      'Now plug the cable into the radio.',
    ],
    indicator: 'Green LED',
    warnings: [
      'Plugging the cable in before power-on can hang the radio until it is power-cycled.',
    ],
  },
  stockVerifyHint: 'The radio boots to its normal screen with your channels.',
};
