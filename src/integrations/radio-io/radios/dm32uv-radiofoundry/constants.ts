/**
 * DM-32UV RadioFoundry programming-cable constants.
 * Image length is the open-firmware codeplug (`RADIOFOUNDRY_IMAGE_SIZE`).
 * The radio adds {@link PHYSICAL_CODEPLUG_BASE} itself. That value is never a wire address.
 */

import { RADIOFOUNDRY_IMAGE_SIZE } from '@core/import-export/formats/radiofoundry/layout.ts';

export const DM32_RADIOFOUNDRY_MODEL_ID = 'DM-32UV-RadioFoundry';
export const DM32_RADIOFOUNDRY_PROFILE_ID = 'radio-io-dm32uv-radiofoundry';

/** Programming cable, UART 115200 8N1. No second baud. */
export const DM32_RADIOFOUNDRY_BAUD_RATE = 115200;

export const DM32_RADIOFOUNDRY_IMAGE_SIZE = RADIOFOUNDRY_IMAGE_SIZE;

/** Debug-link CODEPLUG command. Replies use this value with bit 7 set. */
export const CODEPLUG_COMMAND = 0x1c;

export const BLOCK_SIZE = 4096;
/** EEPROM image, image offsets. The gap after this is not served. */
export const EEPROM_IMAGE_END = 0x10000;
/** Flash image start (open-firmware flash minus the EEPROM base). */
export const FLASH_IMAGE_START = 0x20000;

/**
 * Physical base of the open-firmware image on this radio.
 * The firmware adds it. A host sends image offsets only.
 */
export const PHYSICAL_CODEPLUG_BASE = 0x700000;

export const OP_INFO = 0;
export const OP_SUMS = 1;
export const OP_READ = 2;
export const OP_BEGIN = 3;
export const OP_BLOCK = 4;
export const OP_DATA = 5;
export const OP_END = 6;
export const OP_COMMIT = 7;
export const OP_ABORT = 9;

export const FMT_LZ4 = 1;
export const FMT_BLANK = 2;
export const MODE_DIRECT = 0;

/** Request payload is at most 64 bytes, so a DATA chunk is at most 61 stream bytes. */
export const DATA_CHUNK_MAX = 61;

export const HANDSHAKE_ERROR = 'This radio did not answer the RadioFoundry codeplug protocol.';

/** 4 KB blocks the fast protocol will serve inside the codeplug file. */
export function servedBlockAddresses(imageSize: number = DM32_RADIOFOUNDRY_IMAGE_SIZE): number[] {
  const addresses: number[] = [];
  for (let addr = 0; addr + BLOCK_SIZE <= EEPROM_IMAGE_END; addr += BLOCK_SIZE) {
    addresses.push(addr);
  }
  for (let addr = FLASH_IMAGE_START; addr < imageSize; addr += BLOCK_SIZE) {
    addresses.push(addr);
  }
  return addresses;
}
