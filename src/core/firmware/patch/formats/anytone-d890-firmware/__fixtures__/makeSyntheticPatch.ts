/**
 * Test-only port of `make` from the firmware project's `fw/make_patch.py` (format 1), and a synthetic
 * three-file package with consistent length fields. Never uses real stock bytes.
 */
import { seededBytes } from '../../../../__fixtures__/synthetic.ts';
import { sha256Hex } from '../../../../hash.ts';
import { bytesToHex } from '../../../../hex.ts';
import { CDI_LEN_OFF, SPI_LEN_OFF } from '../constants.ts';

/** Differing runs closer than this are merged into one hook. */
const GAP = 16;

export interface SyntheticD890Files {
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
 * Seeded `.CDD`; a 278-byte `.CDI` (name padded to 0x100, then u32 LE addr, len, off, flag, zero padding); a
 * 51-byte `.spi` (u32 0x20, u16 count = 1, u32 total = len, then a model tag, padded). Mirrors the firmware
 * project's updater test `synth()`.
 */
export function synthD890Stock(len = 5000): SyntheticD890Files {
  const cdd = seededBytes(890, len);
  const cdi = new Uint8Array(278);
  cdi.fill(0x20, 0, 0x100);
  cdi.set(new TextEncoder().encode('SYNTH_MAIN.bin'), 0);
  const cdiView = new DataView(cdi.buffer);
  cdiView.setUint32(0x100, 0x0800c000, true);
  cdiView.setUint32(CDI_LEN_OFF, len, true);
  cdiView.setUint32(0x108, 0, true);
  cdiView.setUint32(0x10c, 0x10000, true);
  const spi = new Uint8Array(51).fill(0x20);
  const spiView = new DataView(spi.buffer);
  spiView.setUint32(0, 0x20, true);
  spiView.setUint16(4, 1, true);
  spiView.setUint32(SPI_LEN_OFF, len, true);
  spi.fill(0, 10, 14);
  spi.set(new TextEncoder().encode('D890UV  V100'), 14);
  return { cdd, cdi, spi };
}

/** A built package: `cdd` with the same `.CDI` / `.spi` length fields rewritten. */
export function synthD890Built(stock: SyntheticD890Files, cdd: Uint8Array): SyntheticD890Files {
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

async function fileMeta(f: SyntheticD890Files) {
  return {
    '.CDD': { sha256: await sha256Hex(f.cdd), size: f.cdd.length },
    '.CDI': { sha256: await sha256Hex(f.cdi), size: f.cdi.length },
    '.spi': { sha256: await sha256Hex(f.spi), size: f.spi.length },
  };
}

export async function makeSyntheticD890Patch(
  stock: SyntheticD890Files,
  built: SyntheticD890Files,
  version: string,
): Promise<Record<string, unknown>> {
  if (built.cdd.length < stock.cdd.length) throw new Error('built .CDD is shorter than stock');
  return {
    format: 1,
    name: 'anytone-d890-firmware',
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
