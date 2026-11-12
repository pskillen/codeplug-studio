import type { FirmwarePatchFormat } from '../../types.ts';
import { applyRt95MainPatch } from './apply.ts';
import { RT95_MAIN_PATCH_FORMATS, RT95_MAIN_PATCH_NAME } from './constants.ts';
import { parseRt95MainPatch, type Rt95MainPatchV1 } from './schema.ts';

export type { Rt95MainPatchV1 } from './schema.ts';

/** No `readVersionStamp`: the RF CPU constant is protected, so the radio cannot tell stock from patched. */
export const retevisRt95MainPatchFormat: FirmwarePatchFormat<Rt95MainPatchV1> = {
  name: RT95_MAIN_PATCH_NAME,
  formats: RT95_MAIN_PATCH_FORMATS,
  parse: parseRt95MainPatch,
  describe: (p) => ({
    name: p.name,
    format: p.format,
    version: p.version,
    stock: p.stock,
    result: p.result,
  }),
  apply: applyRt95MainPatch,
};
