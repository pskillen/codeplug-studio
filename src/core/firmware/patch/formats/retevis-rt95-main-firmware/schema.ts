/**
 * `retevis-rt95-main-firmware` patch, format 1: at most one 4-byte hook at the D35 site plus bytes appended at the
 * end of the 0xD93C-byte image. Stricter than the firmware project's Python (untrusted input): a hook on a protected
 * range, an append past 708 bytes or a second hook is refused here as well.
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
  RT95_MAIN_HOOK_LEN,
  RT95_MAIN_HOOK_OFFSET,
  RT95_MAIN_HOOK_ORIGINAL,
  RT95_MAIN_IMAGE_LEN,
  RT95_MAIN_MAX_APPEND,
  RT95_MAIN_PATCH_NAME,
  RT95_MAIN_REFUSED_RANGES,
  RT95_MAIN_WIRE_KEYS,
  WIRE_TO_ROLE,
} from './constants.ts';

export interface Rt95MainPatchHook {
  readonly offset: number;
  readonly original: Uint8Array;
  readonly data: Uint8Array;
}

export interface Rt95MainPatchV1 {
  readonly format: 1;
  readonly name: typeof RT95_MAIN_PATCH_NAME;
  readonly version: string;
  readonly stock: Readonly<Record<string, FirmwarePatchHashes>>;
  readonly result: Readonly<Record<string, FirmwarePatchHashes>>;
  /** Zero or one. */
  readonly hooks: readonly Rt95MainPatchHook[];
  readonly append: { readonly offset: number; readonly data: Uint8Array };
}

function requireFileSet(v: unknown, field: string): Record<string, FirmwarePatchHashes> {
  const r = requireRecord(v, field);
  const keys = Object.keys(r);
  if (keys.length !== RT95_MAIN_WIRE_KEYS.length || !RT95_MAIN_WIRE_KEYS.every((k) => k in r)) {
    throw malformed(`"${field}" must list exactly ${RT95_MAIN_WIRE_KEYS.join(', ')}`);
  }
  const out: Record<string, FirmwarePatchHashes> = {};
  for (const k of RT95_MAIN_WIRE_KEYS) out[WIRE_TO_ROLE[k]] = requireHashes(r[k], `${field}.${k}`);
  return out;
}

export function parseRt95MainPatch(json: unknown): Rt95MainPatchV1 {
  if (!isRecord(json)) throw malformed('the patch must be an object');
  if (json.name !== RT95_MAIN_PATCH_NAME) {
    throw malformed(`"name" must be "${RT95_MAIN_PATCH_NAME}"`);
  }
  if (json.format !== 1) throw malformed('"format" must be 1');
  const rawHooks = requireArray(json.hooks, 'hooks');
  if (rawHooks.length > 1) throw malformed('a main-board patch carries at most one hook');
  const hooks = rawHooks.map((h, i) => {
    const r = requireRecord(h, `hooks[${i}]`);
    const hook = {
      offset: requireUint(r.offset, `hooks[${i}].offset`),
      original: requireHex(r.original, `hooks[${i}].original`),
      data: requireHex(r.hex, `hooks[${i}].hex`),
    };
    const end = hook.offset + Math.max(hook.original.length, hook.data.length);
    for (const range of RT95_MAIN_REFUSED_RANGES) {
      if (hook.offset < range.end && end > range.start) {
        throw malformed(`a hook changes the ${range.name}, which a patch must never touch`);
      }
    }
    if (
      hook.offset !== RT95_MAIN_HOOK_OFFSET ||
      hook.original.length !== RT95_MAIN_HOOK_LEN ||
      hook.data.length !== RT95_MAIN_HOOK_LEN ||
      !hook.original.every((b, j) => b === RT95_MAIN_HOOK_ORIGINAL[j])
    ) {
      throw malformed(
        `a main-board hook must be the ${RT95_MAIN_HOOK_LEN} bytes at file 0x${RT95_MAIN_HOOK_OFFSET.toString(16)}`,
      );
    }
    return hook;
  });
  const append = requireRecord(json.append, 'append');
  const appendOffset = requireUint(append.offset, 'append.offset');
  const appendData = requireHex(append.hex, 'append.hex');
  if (appendOffset !== RT95_MAIN_IMAGE_LEN) {
    throw malformed('the appended bytes must start at the end of the main-board image');
  }
  if (appendData.length > RT95_MAIN_MAX_APPEND) {
    throw malformed(`the appended bytes are longer than ${RT95_MAIN_MAX_APPEND}`);
  }
  return {
    format: 1,
    name: RT95_MAIN_PATCH_NAME,
    version: requireString(json.version, 'version'),
    stock: requireFileSet(json.stock, 'stock'),
    result: requireFileSet(json.result, 'result'),
    hooks,
    append: { offset: appendOffset, data: appendData },
  };
}
