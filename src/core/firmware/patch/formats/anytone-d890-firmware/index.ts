import type { FirmwarePatchFormat } from '../../types.ts';
import { applyD890Patch } from './apply.ts';
import { D890_PATCH_FORMATS, D890_PATCH_NAME } from './constants.ts';
import { parseD890Patch, type D890PatchV1 } from './schema.ts';

export type { D890PatchV1 } from './schema.ts';

/** No `readVersionStamp`: the image has no fixed slot; the radio shows its version under Device Info. */
export const anytoneD890PatchFormat: FirmwarePatchFormat<D890PatchV1> = {
  name: D890_PATCH_NAME,
  formats: D890_PATCH_FORMATS,
  parse: parseD890Patch,
  describe: (p) => ({
    name: p.name,
    format: p.format,
    version: p.version,
    stock: p.stock,
    result: p.result,
  }),
  apply: applyD890Patch,
};
