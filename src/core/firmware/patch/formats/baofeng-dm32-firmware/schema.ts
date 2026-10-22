/**
 * `baofeng-dm32-firmware` patch, format 1: segments over the single DM-32UV image.
 * Source of truth: the firmware project's `fw/make_patch.py`. Studio's parser is stricter (untrusted input).
 */
import {
  isRecord,
  malformed,
  requireArray,
  requireHashes,
  requireHex,
  requireRecord,
  requireSha256,
  requireString,
  requireUint,
} from '../../schema.ts';
import type { FirmwarePatchHashes } from '../../types.ts';

export const DM32_PATCH_NAME = 'baofeng-dm32-firmware';
export const DM32_PATCH_FORMATS = [1] as const;
/** Upper bound on the version slot length. */
const VERSION_SLOT_MAX_LEN = 64;

export interface Dm32PatchSegment {
  readonly offset: number;
  readonly data: Uint8Array;
}

export interface Dm32PatchV1 {
  readonly format: 1;
  readonly name: typeof DM32_PATCH_NAME;
  readonly version: string;
  readonly stock: FirmwarePatchHashes;
  readonly result: FirmwarePatchHashes;
  readonly segments: readonly Dm32PatchSegment[];
  readonly neutralSha256?: string;
  readonly versionSlot?: { readonly offset: number; readonly len: number };
}

export function parseDm32Patch(json: unknown): Dm32PatchV1 {
  if (!isRecord(json)) throw malformed('the patch must be an object');
  if (json.name !== DM32_PATCH_NAME) throw malformed(`"name" must be "${DM32_PATCH_NAME}"`);
  if (json.format !== 1) throw malformed('"format" must be 1');
  const segments = requireArray(json.segments, 'segments').map((s, i) => {
    const r = requireRecord(s, `segments[${i}]`);
    return {
      offset: requireUint(r.offset, `segments[${i}].offset`),
      data: requireHex(r.hex, `segments[${i}].hex`),
    };
  });
  let versionSlot: Dm32PatchV1['versionSlot'];
  if (json.version_slot !== undefined) {
    const r = requireRecord(json.version_slot, 'version_slot');
    const offset = requireUint(r.offset, 'version_slot.offset');
    const len = requireUint(r.len, 'version_slot.len');
    if (len < 1 || len > VERSION_SLOT_MAX_LEN) {
      throw malformed(`"version_slot.len" must be 1 to ${VERSION_SLOT_MAX_LEN}`);
    }
    versionSlot = { offset, len };
  }
  return {
    format: 1,
    name: DM32_PATCH_NAME,
    version: requireString(json.version, 'version'),
    stock: requireHashes(json.stock, 'stock'),
    result: requireHashes(json.result, 'result'),
    segments,
    neutralSha256:
      json.neutral_sha256 === undefined
        ? undefined
        : requireSha256(json.neutral_sha256, 'neutral_sha256'),
    versionSlot,
  };
}
