import type { FirmwarePatchFormat } from '../../types.ts';
import { applyUv5rMiniPatch } from './apply.ts';
import { UV5RMINI_PATCH_FORMATS, UV5RMINI_PATCH_NAME } from './constants.ts';
import { parseUv5rMiniPatch, type Uv5rMiniPatchV1 } from './schema.ts';

export type {
  Uv5rMiniPatchBuild,
  Uv5rMiniPatchEdit,
  Uv5rMiniPatchLoader,
  Uv5rMiniPatchV1,
} from './schema.ts';

/**
 * The image's version slot is scrambled per radio, so Studio can't read it back: the stamp is the patch's
 * `build.name`, which the firmware project checks against the slot when it builds the patch.
 */
export const baofengUv5rMiniPatchFormat: FirmwarePatchFormat<Uv5rMiniPatchV1> = {
  name: UV5RMINI_PATCH_NAME,
  formats: UV5RMINI_PATCH_FORMATS,
  parse: parseUv5rMiniPatch,
  describe: (p) => ({
    name: p.name,
    format: p.format,
    version: p.version,
    stock: p.stock,
    result: p.result,
  }),
  apply: applyUv5rMiniPatch,
  readVersionStamp: (_result, p) => p.build.name,
};
