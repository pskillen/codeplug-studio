/**
 * Test-only port of `make`'s patch shape from the firmware project's `tools/make_patch.py` (UV-5R Mini, format 1)
 * over seeded random bytes. Never real stock bytes.
 */
import { seededBytes } from '../../../../__fixtures__/synthetic.ts';
import { sha256Hex } from '../../../../hash.ts';
import { bytesToHex } from '../../../../hex.ts';

/** Differing runs closer than this are merged into one edit. */
const GAP = 16;

export function synthUv5rMiniStock(len = 4096): Uint8Array {
  return seededBytes(5, len);
}

function editSegments(stock: Uint8Array, built: Uint8Array, end: number): [number, Uint8Array][] {
  const segs: [number, Uint8Array][] = [];
  let i = 0;
  while (i < end) {
    if (stock[i] === built[i]) {
      i++;
      continue;
    }
    const start = i;
    let last = i;
    while (i < end && i - last <= GAP) {
      if (stock[i] !== built[i]) last = i;
      i++;
    }
    segs.push([start, built.slice(start, last + 1)]);
    i = last + 1;
  }
  return segs;
}

export interface SyntheticUv5rMiniPatchOptions {
  readonly version?: string;
  readonly buildName?: string;
  /** The stock base the patch names; default `synthetic`. */
  readonly base?: string;
  /** Cut point; default: the shorter of the two images. */
  readonly truncate?: number;
}

/** A patch turning `stock` into `built`: edits over the common prefix, cut at `built.length` or the stock end. */
export async function makeSyntheticUv5rMiniPatch(
  stock: Uint8Array,
  built: Uint8Array,
  opts: SyntheticUv5rMiniPatchOptions = {},
): Promise<Record<string, unknown>> {
  const truncate = opts.truncate ?? Math.min(stock.length, built.length);
  const name = opts.buildName ?? 'synthetic';
  return {
    name: 'baofeng-uv5rmini-firmware',
    format: 1,
    version: opts.version ?? name,
    base: opts.base ?? 'synthetic',
    stock: { '.ufw': { sha256: await sha256Hex(stock), size: stock.length } },
    result: { '.ufw': { sha256: await sha256Hex(built), size: built.length } },
    build: { name, appSize: '0x1000', appCrc: '0xabcd' },
    loader: { sha256: '0'.repeat(64), list: ['synthetic'] },
    edits: editSegments(stock, built, truncate).map(([offset, data]) => ({
      offset,
      hex: bytesToHex(data),
    })),
    truncate,
    append: bytesToHex(built.slice(truncate)),
  };
}
