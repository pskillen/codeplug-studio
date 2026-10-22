/**
 * `anytone-d890-firmware` patch, format 1: in-place hooks with their original bytes, plus bytes appended to the
 * `.CDD` image. Stricter than the firmware project's Python (untrusted input).
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
import { D890_PATCH_NAME, D890_WIRE_KEYS, WIRE_TO_ROLE } from './constants.ts';

export interface D890PatchHook {
  readonly offset: number;
  readonly original: Uint8Array;
  readonly data: Uint8Array;
}

export interface D890PatchV1 {
  readonly format: 1;
  readonly name: typeof D890_PATCH_NAME;
  readonly version: string;
  /** By member role. */
  readonly stock: Readonly<Record<string, FirmwarePatchHashes>>;
  /** By member role. */
  readonly result: Readonly<Record<string, FirmwarePatchHashes>>;
  readonly hooks: readonly D890PatchHook[];
  readonly append: { readonly offset: number; readonly data: Uint8Array };
}

function requireFileSet(v: unknown, field: string): Record<string, FirmwarePatchHashes> {
  const r = requireRecord(v, field);
  const keys = Object.keys(r);
  if (keys.length !== D890_WIRE_KEYS.length || !D890_WIRE_KEYS.every((k) => k in r)) {
    throw malformed(`"${field}" must list exactly ${D890_WIRE_KEYS.join(', ')}`);
  }
  const out: Record<string, FirmwarePatchHashes> = {};
  for (const k of D890_WIRE_KEYS) out[WIRE_TO_ROLE[k]] = requireHashes(r[k], `${field}.${k}`);
  return out;
}

export function parseD890Patch(json: unknown): D890PatchV1 {
  if (!isRecord(json)) throw malformed('the patch must be an object');
  if (json.name !== D890_PATCH_NAME) throw malformed(`"name" must be "${D890_PATCH_NAME}"`);
  if (json.format !== 1) throw malformed('"format" must be 1');
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
    return hook;
  });
  const append = requireRecord(json.append, 'append');
  return {
    format: 1,
    name: D890_PATCH_NAME,
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
