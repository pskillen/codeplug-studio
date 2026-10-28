/**
 * Test-only port of `make` from the firmware project's `fw/make_patch.py` (RT95, format 1), and a synthetic
 * three-file package in the RT95 shape (10-byte `.spi`) with consistent length fields. Never real stock bytes.
 */
import { seededBytes } from '../../../../__fixtures__/synthetic.ts';
import { sha256Hex } from '../../../../hash.ts';
import { bytesToHex } from '../../../../hex.ts';
import { CDI_LEN_OFF, SPI_LEN_OFF } from '../constants.ts';

/** Differing runs closer than this are merged into one hook. */
const GAP = 16;

export interface SyntheticRt95Files {
  readonly cdd: Uint8Array;
  readonly cdi: Uint8Array;
  readonly spi: Uint8Array;
}

function writeLength(buf: Uint8Array, off: number, n: number): Uint8Array {
  const out = buf.slice();
  new DataView(out.buffer, out.byteOffset, out.byteLength).setUint32(off, n, true);
  return out;
}

/**
 * Seeded `.CDD` (long enough to cover every protected range); a 278-byte `.CDI` (name padded to 0x100, then u32 LE
 * dest, len, offset, flag, zero padding); a 10-byte `.spi` `{u16 count = 1, u32 total = len, u32 0}`.
 */
export function synthRt95Stock(len = 0x15500): SyntheticRt95Files {
  const cdd = seededBytes(95, len);
  const cdi = new Uint8Array(278);
  cdi.fill(0x20, 0, 0x100);
  cdi.set(new TextEncoder().encode('SYNTH_HEAD.bin'), 0);
  const cdiView = new DataView(cdi.buffer);
  cdiView.setUint32(0x100, 0x08002000, true);
  cdiView.setUint32(CDI_LEN_OFF, len, true);
  cdiView.setUint32(0x108, 0, true);
  cdiView.setUint32(0x10c, 0x00010000, true);
  const spi = new Uint8Array(10);
  const spiView = new DataView(spi.buffer);
  spiView.setUint16(0, 1, true);
  spiView.setUint32(SPI_LEN_OFF, len, true);
  return { cdd, cdi, spi };
}

/** A built package: `cdd` with the `.CDI` / `.spi` length fields rewritten. */
export function synthRt95Built(stock: SyntheticRt95Files, cdd: Uint8Array): SyntheticRt95Files {
  return {
    cdd,
    cdi: writeLength(stock.cdi, CDI_LEN_OFF, cdd.length),
    spi: writeLength(stock.spi, SPI_LEN_OFF, cdd.length),
  };
}

function hookSegments(stock: Uint8Array, built: Uint8Array): [number, Uint8Array, Uint8Array][] {
  const segs: [number, Uint8Array, Uint8Array][] = [];
  const n = stock.length;
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
    segs.push([start, stock.slice(start, last + 1), built.slice(start, last + 1)]);
    i = last + 1;
  }
  return segs;
}

async function fileMeta(f: SyntheticRt95Files) {
  return {
    '.CDD': { sha256: await sha256Hex(f.cdd), size: f.cdd.length },
    '.CDI': { sha256: await sha256Hex(f.cdi), size: f.cdi.length },
    '.spi': { sha256: await sha256Hex(f.spi), size: f.spi.length },
  };
}

export async function makeSyntheticRt95Patch(
  stock: SyntheticRt95Files,
  built: SyntheticRt95Files,
  version: string,
): Promise<Record<string, unknown>> {
  if (built.cdd.length < stock.cdd.length) throw new Error('built .CDD is shorter than stock');
  return {
    format: 1,
    name: 'retevis-rt95-firmware',
    version,
    stock: await fileMeta(stock),
    result: await fileMeta(built),
    append: { offset: stock.cdd.length, hex: bytesToHex(built.cdd.slice(stock.cdd.length)) },
    hooks: hookSegments(stock.cdd, built.cdd).map(([offset, original, hex]) => ({
      offset,
      original: bytesToHex(original),
      hex: bytesToHex(hex),
    })),
  };
}
