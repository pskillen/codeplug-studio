/**
 * `retevis-rt95-firmware` patch, format 1: in-place hooks with their original bytes, plus bytes appended to the
 * `.CDD` image. Stricter than the firmware project's Python (untrusted input): a hook that touches a protected
 * range, a run over 32 bytes, or more than 256 original bytes in all is refused here as well as at build time.
 */
import {
  isRecord,
  malformed,
  requireArray,
  requireHashes,
  requireHex,
  requireRecord,
  requireString,
  requireUint,
} from '../../schema.ts';
import type { FirmwarePatchHashes } from '../../types.ts';
import {
  RT95_MAX_HOOK_ORIGINAL_TOTAL,
  RT95_MAX_HOOK_RUN,
  RT95_PATCH_NAME,
  RT95_REFUSED_RANGES,
  RT95_WIRE_KEYS,
  WIRE_TO_ROLE,
} from './constants.ts';

export interface Rt95PatchHook {
  readonly offset: number;
  readonly original: Uint8Array;
  readonly data: Uint8Array;
}

export interface Rt95PatchV1 {
  readonly format: 1;
  readonly name: typeof RT95_PATCH_NAME;
  readonly version: string;
  /** By member role. */
  readonly stock: Readonly<Record<string, FirmwarePatchHashes>>;
  /** By member role. */
  readonly result: Readonly<Record<string, FirmwarePatchHashes>>;
  readonly hooks: readonly Rt95PatchHook[];
  readonly append: { readonly offset: number; readonly data: Uint8Array };
}

function requireFileSet(v: unknown, field: string): Record<string, FirmwarePatchHashes> {
  const r = requireRecord(v, field);
  const keys = Object.keys(r);
  if (keys.length !== RT95_WIRE_KEYS.length || !RT95_WIRE_KEYS.every((k) => k in r)) {
    throw malformed(`"${field}" must list exactly ${RT95_WIRE_KEYS.join(', ')}`);
  }
  const out: Record<string, FirmwarePatchHashes> = {};
  for (const k of RT95_WIRE_KEYS) out[WIRE_TO_ROLE[k]] = requireHashes(r[k], `${field}.${k}`);
  return out;
}

export function parseRt95Patch(json: unknown): Rt95PatchV1 {
  if (!isRecord(json)) throw malformed('the patch must be an object');
  if (json.name !== RT95_PATCH_NAME) throw malformed(`"name" must be "${RT95_PATCH_NAME}"`);
  if (json.format !== 1) throw malformed('"format" must be 1');
  let originalTotal = 0;
  const hooks = requireArray(json.hooks, 'hooks').map((h, i) => {
    const r = requireRecord(h, `hooks[${i}]`);
    const hook = {
      offset: requireUint(r.offset, `hooks[${i}].offset`),
      original: requireHex(r.original, `hooks[${i}].original`),
      data: requireHex(r.hex, `hooks[${i}].hex`),
    };
    if (hook.original.length !== hook.data.length) {
      throw malformed(`hooks[${i}] changes the image length`);
    }
    const end = hook.offset + hook.original.length;
    for (const range of RT95_REFUSED_RANGES) {
      if (hook.offset < range.end && end > range.start) {
        throw malformed(`a hook changes the ${range.name}, which a patch must never touch`);
      }
    }
    if (hook.original.length > RT95_MAX_HOOK_RUN) {
      throw malformed(`hooks[${i}] is longer than ${RT95_MAX_HOOK_RUN} bytes`);
    }
    originalTotal += hook.original.length;
    return hook;
  });
  if (originalTotal > RT95_MAX_HOOK_ORIGINAL_TOTAL) {
    throw malformed(
      `the hooks replace more than ${RT95_MAX_HOOK_ORIGINAL_TOTAL} bytes of the stock image in all`,
    );
  }
  const append = requireRecord(json.append, 'append');
  return {
    format: 1,
    name: RT95_PATCH_NAME,
    version: requireString(json.version, 'version'),
    stock: requireFileSet(json.stock, 'stock'),
    result: requireFileSet(json.result, 'result'),
    hooks,
    append: {
      offset: requireUint(append.offset, 'append.offset'),
      data: requireHex(append.hex, 'append.hex'),
    },
  };
}
