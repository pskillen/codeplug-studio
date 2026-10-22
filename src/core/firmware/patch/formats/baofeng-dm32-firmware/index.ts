import { DM32UV_FIRMWARE_ROLE_BIN } from '../../../../radios/baofeng/dm-32uv/firmware.ts';
import type { FirmwarePatchFormat } from '../../types.ts';
import { applyDm32Patch, readDm32VersionStamp } from './apply.ts';
import { DM32_PATCH_FORMATS, DM32_PATCH_NAME, parseDm32Patch, type Dm32PatchV1 } from './schema.ts';

export type { Dm32PatchV1 } from './schema.ts';

export const baofengDm32PatchFormat: FirmwarePatchFormat<Dm32PatchV1> = {
  name: DM32_PATCH_NAME,
  formats: DM32_PATCH_FORMATS,
  parse: parseDm32Patch,
  describe: (p) => ({
    name: p.name,
    format: p.format,
    version: p.version,
    stock: { [DM32UV_FIRMWARE_ROLE_BIN]: p.stock },
    result: { [DM32UV_FIRMWARE_ROLE_BIN]: p.result },
  }),
  apply: applyDm32Patch,
  readVersionStamp: readDm32VersionStamp,
};
