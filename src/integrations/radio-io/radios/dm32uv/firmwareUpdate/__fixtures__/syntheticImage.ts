/**
 * Test-only synthetic DM-32UV images: `BFUV32-V2` at 0, `END` at 0xFD, seeded bytes elsewhere. Never real stock.
 */
import { seededBytes } from '@core/firmware/__fixtures__/synthetic.ts';
import { DM32UV_FIRMWARE_IMAGE_SIZE } from '@core/radios/baofeng/dm-32uv/firmware.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

export function syntheticDm32Image(length = DM32UV_FIRMWARE_IMAGE_SIZE, seed = 32): Uint8Array {
  const img = seededBytes(seed, length);
  img.set(new TextEncoder().encode('BFUV32-V2'), 0);
  img.set(new TextEncoder().encode('END'), 0xfd);
  return img;
}

/** Tests only: the real constructor is `prepareFirmwareImage`. */
export function preparedDm32Image(
  bin: Uint8Array,
  overrides: Partial<{ radioId: string; files: Record<string, Uint8Array> }> = {},
): PreparedFirmwareImage {
  return {
    radioId: overrides.radioId ?? 'baofeng-dm32uv',
    provenance: 'stock',
    stockVersion: 'v0.0.1-test',
    title: 'stock firmware v0.0.1-test',
    package: {
      radioId: overrides.radioId ?? 'baofeng-dm32uv',
      files: overrides.files ?? { bin },
    },
    sha256: {},
    verifyHint: 'test',
  } as unknown as PreparedFirmwareImage;
}
