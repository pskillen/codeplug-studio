/**
 * Test-only port of `make` from the firmware project's `fw/make_patch.py` (format 1). Used with synthetic
 * images only.
 */
import { sha256Hex } from '../../../../hash.ts';
import { bytesToHex } from '../../../../hex.ts';

/** Differing runs closer than this are merged into one segment. */
const GAP = 16;

function segments(stock: Uint8Array, built: Uint8Array): [number, Uint8Array][] {
  const segs: [number, Uint8Array][] = [];
  const n = Math.min(stock.length, built.length);
  let i = 0;
  while (i < n) {
    if (stock[i] === built[i]) {
      i++;
      continue;
    }
    const start = i;
    let last = i;
    while (i < n && i - last <= GAP) {
      if (stock[i] !== built[i]) last = i;
      i++;
    }
    segs.push([start, built.slice(start, last + 1)]);
    i = last + 1;
  }
  if (built.length > stock.length) {
    const tail = built.slice(stock.length);
    const prev = segs[segs.length - 1];
    if (prev && prev[0] + prev[1].length === stock.length) {
      const merged = new Uint8Array(prev[1].length + tail.length);
      merged.set(prev[1]);
      merged.set(tail, prev[1].length);
      segs[segs.length - 1] = [prev[0], merged];
    } else {
      segs.push([stock.length, tail]);
    }
  }
  return segs;
}

export async function makeSyntheticDm32Patch(
  stock: Uint8Array,
  built: Uint8Array,
  version: string,
  opts?: { versionSlot?: { offset: number; len: number } },
): Promise<Record<string, unknown>> {
  if (built.length < stock.length) throw new Error('built image is shorter than stock');
  const patch: Record<string, unknown> = {
    format: 1,
    name: 'baofeng-dm32-firmware',
    version,
    stock: { sha256: await sha256Hex(stock), size: stock.length },
    result: { sha256: await sha256Hex(built), size: built.length },
    segments: segments(stock, built).map(([offset, d]) => ({ offset, hex: bytesToHex(d) })),
  };
  if (opts?.versionSlot) patch.version_slot = { ...opts.versionSlot };
  return patch;
}
