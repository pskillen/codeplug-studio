/**
 * `baofeng-uv5rmini-firmware` patch, format 1: ordered in-place edits, a cut to `truncate` and appended bytes over
 * the stock `.ufw`. Matches the firmware project's Python `apply`: hex is lowercase, edits are non-empty, ascending
 * and inside `[0, truncate)`, the result is at most 1 MiB and there are at most 4096 edits. `build`, `loader` and
 * `base` are descriptive: shape-checked, exposed for the image interlocks, never used to widen a check.
 */
import { hexToBytes } from '../../../hex.ts';
import {
  isRecord,
  malformed,
  requireArray,
  requireHashes,
  requireRecord,
  requireSha256,
  requireString,
  requireUint,
} from '../../schema.ts';
import type { FirmwarePatchHashes } from '../../types.ts';
import {
  UV5RMINI_BUILD_NAME_RE,
  UV5RMINI_HEX_NUMBER_RE,
  UV5RMINI_MAX_EDITS,
  UV5RMINI_MAX_RESULT_SIZE,
  UV5RMINI_PATCH_NAME,
  UV5RMINI_WIRE_KEYS,
  WIRE_TO_ROLE,
} from './constants.ts';

export interface Uv5rMiniPatchEdit {
  readonly offset: number;
  readonly data: Uint8Array;
}

/** The image's version slot and its `app.bin` directory entry. */
export interface Uv5rMiniPatchBuild {
  readonly name: string;
  /** `0x` hex string, as written in the patch. */
  readonly appSize: string;
  /** `0x` hex string, as written in the patch. */
  readonly appCrc: string;
}

/** The packed loader the image carries (SHA-256, lowercase) and the builds its list names. */
export interface Uv5rMiniPatchLoader {
  readonly sha256: string;
  readonly list: readonly string[];
}

export interface Uv5rMiniPatchV1 {
  readonly format: 1;
  readonly name: typeof UV5RMINI_PATCH_NAME;
  readonly version: string;
  /** The stock base's name, e.g. `nrfb-v0.04`. Descriptive. */
  readonly base: string;
  /** By member role. */
  readonly stock: Readonly<Record<string, FirmwarePatchHashes>>;
  /** By member role. */
  readonly result: Readonly<Record<string, FirmwarePatchHashes>>;
  readonly build: Uv5rMiniPatchBuild;
  readonly loader: Uv5rMiniPatchLoader;
  /** Ascending, non-empty, non-overlapping, each inside `[0, truncate)`. */
  readonly edits: readonly Uv5rMiniPatchEdit[];
  readonly truncate: number;
  readonly append: Uint8Array;
}

function requireFileSet(v: unknown, field: string): Record<string, FirmwarePatchHashes> {
  const r = requireRecord(v, field);
  const keys = Object.keys(r);
  if (keys.length !== UV5RMINI_WIRE_KEYS.length || !UV5RMINI_WIRE_KEYS.every((k) => k in r)) {
    throw malformed(`"${field}" must list exactly ${UV5RMINI_WIRE_KEYS.join(', ')}`);
  }
  const out: Record<string, FirmwarePatchHashes> = {};
  for (const k of UV5RMINI_WIRE_KEYS) out[WIRE_TO_ROLE[k]] = requireHashes(r[k], `${field}.${k}`);
  return out;
}

/** Even-length lowercase hex, at most the result cap in bytes. Empty is allowed here; edits check it themselves. */
function requireLowerHex(v: unknown, field: string): Uint8Array {
  if (
    typeof v !== 'string' ||
    v.length > 2 * UV5RMINI_MAX_RESULT_SIZE ||
    v.length % 2 !== 0 ||
    !/^[0-9a-f]*$/.test(v)
  ) {
    throw malformed(`"${field}" must be lowercase hex text`);
  }
  return hexToBytes(v);
}

function requireBuildName(v: unknown, field: string): string {
  if (typeof v !== 'string' || !UV5RMINI_BUILD_NAME_RE.test(v)) {
    throw malformed(`"${field}" must be 1 to 21 printable characters with no space`);
  }
  return v;
}

function requireHexNumber(v: unknown, field: string): string {
  if (typeof v !== 'string' || !UV5RMINI_HEX_NUMBER_RE.test(v)) {
    throw malformed(`"${field}" must be a 0x hex number`);
  }
  return v;
}

/** Lowercase only: the firmware project compares the hash as text. */
function requireLowerSha256(v: unknown, field: string): string {
  const s = requireSha256(v, field);
  if (s !== v) throw malformed(`"${field}" must be lowercase`);
  return s;
}

function parseBuild(v: unknown): Uv5rMiniPatchBuild {
  const r = requireRecord(v, 'build');
  return {
    name: requireBuildName(r.name, 'build.name'),
    appSize: requireHexNumber(r.appSize, 'build.appSize'),
    appCrc: requireHexNumber(r.appCrc, 'build.appCrc'),
  };
}

function parseLoader(v: unknown): Uv5rMiniPatchLoader {
  const r = requireRecord(v, 'loader');
  return {
    sha256: requireLowerSha256(r.sha256, 'loader.sha256'),
    list: requireArray(r.list, 'loader.list').map((n, i) =>
      requireBuildName(n, `loader.list[${i}]`),
    ),
  };
}

/** Hashes are lowercase in the stock/result entries too: the Python compares them as text. */
function lowerHashes(set: Record<string, FirmwarePatchHashes>, raw: unknown, field: string): void {
  const r = raw as Record<string, Record<string, unknown>>;
  for (const k of UV5RMINI_WIRE_KEYS) {
    if (r[k]?.sha256 !== set[WIRE_TO_ROLE[k]]?.sha256) {
      throw malformed(`"${field}.${k}.sha256" must be lowercase`);
    }
  }
}

export function parseUv5rMiniPatch(json: unknown): Uv5rMiniPatchV1 {
  if (!isRecord(json)) throw malformed('the patch must be an object');
  if (json.name !== UV5RMINI_PATCH_NAME) throw malformed(`"name" must be "${UV5RMINI_PATCH_NAME}"`);
  if (json.format !== 1) throw malformed('"format" must be 1');
  const stock = requireFileSet(json.stock, 'stock');
  lowerHashes(stock, json.stock, 'stock');
  const result = requireFileSet(json.result, 'result');
  lowerHashes(result, json.result, 'result');
  if (result[WIRE_TO_ROLE['.ufw']]!.size > UV5RMINI_MAX_RESULT_SIZE) {
    throw malformed(`the result is larger than ${UV5RMINI_MAX_RESULT_SIZE} bytes`);
  }
  const truncate = requireUint(json.truncate, 'truncate');
  if (truncate > stock[WIRE_TO_ROLE['.ufw']]!.size) {
    throw malformed('"truncate" is longer than the stock image');
  }
  const rawEdits = requireArray(json.edits, 'edits');
  if (rawEdits.length > UV5RMINI_MAX_EDITS) {
    throw malformed(`the patch has more than ${UV5RMINI_MAX_EDITS} edits`);
  }
  let last = 0;
  const edits = rawEdits.map((e, i) => {
    const r = requireRecord(e, `edits[${i}]`);
    const edit = {
      offset: requireUint(r.offset, `edits[${i}].offset`),
      data: requireLowerHex(r.hex, `edits[${i}].hex`),
    };
    if (edit.data.length === 0) throw malformed(`edits[${i}] is empty`);
    if (edit.offset < last) {
      throw malformed(`edits[${i}] is out of order or overlaps the one before`);
    }
    last = edit.offset + edit.data.length;
    if (last > truncate) throw malformed(`edits[${i}] runs past "truncate"`);
    return edit;
  });
  return {
    format: 1,
    name: UV5RMINI_PATCH_NAME,
    version: requireString(json.version, 'version'),
    base: requireString(json.base, 'base'),
    stock,
    result,
    build: parseBuild(json.build),
    loader: parseLoader(json.loader),
    edits,
    truncate,
    append: requireLowerHex(json.append, 'append'),
  };
}
