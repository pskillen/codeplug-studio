import type { FirmwarePatchFormat } from '../../types.ts';
import { applyRt95Patch } from './apply.ts';
import { RT95_PATCH_FORMATS, RT95_PATCH_NAME } from './constants.ts';
import { parseRt95Patch, type Rt95PatchV1 } from './schema.ts';

export type { Rt95PatchV1 } from './schema.ts';

/** No `readVersionStamp`: format 1 has no version slot; the radio shows its version on the test screen. */
export const retevisRt95PatchFormat: FirmwarePatchFormat<Rt95PatchV1> = {
  name: RT95_PATCH_NAME,
  formats: RT95_PATCH_FORMATS,
  parse: parseRt95Patch,
  describe: (p) => ({
    name: p.name,
    format: p.format,
    version: p.version,
    stock: p.stock,
    result: p.result,
  }),
  apply: applyRt95Patch,
};
