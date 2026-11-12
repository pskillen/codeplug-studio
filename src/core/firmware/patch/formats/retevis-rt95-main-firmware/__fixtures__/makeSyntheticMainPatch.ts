/**
 * Test-only: build a MAIN patch (and its result package) from the synthetic MAIN stock by the tail rule:
 * result `.CDD` = stock[0, 0xD93C) + optional hook + append. Never real stock bytes.
 */
import { sha256Hex } from '../../../../hash.ts';
import { bytesToHex } from '../../../../hex.ts';
import {
  CDI_LEN_OFF,
  RT95_MAIN_HOOK_OFFSET,
  RT95_MAIN_HOOK_ORIGINAL,
  RT95_MAIN_IMAGE_LEN,
  SPI_LEN_OFF,
} from '../constants.ts';
import type { SyntheticMainFiles } from './synthMainStock.ts';

export const SYNTH_HOOK = Uint8Array.of(0x0d, 0xf0, 0xdb, 0xfa);

function withLength(buf: Uint8Array, off: number, n: number): Uint8Array {
  const out = buf.slice();
  new DataView(out.buffer).setUint32(off, n, true);
  return out;
}

async function meta(f: SyntheticMainFiles) {
  return {
    '.CDD': { sha256: await sha256Hex(f.cdd), size: f.cdd.length },
    '.CDI': { sha256: await sha256Hex(f.cdi), size: f.cdi.length },
    '.spi': { sha256: await sha256Hex(f.spi), size: f.spi.length },
  };
}

/** The build a patch with `hook` and `append` yields from `stock`. */
export function synthMainBuilt(
  stock: SyntheticMainFiles,
  opts: { hook?: boolean; append?: Uint8Array } = {},
): SyntheticMainFiles {
  const append = opts.append ?? new Uint8Array(0);
  const cdd = new Uint8Array(RT95_MAIN_IMAGE_LEN + append.length);
  cdd.set(stock.cdd.subarray(0, RT95_MAIN_IMAGE_LEN));
  if (opts.hook) cdd.set(SYNTH_HOOK, RT95_MAIN_HOOK_OFFSET);
  cdd.set(append, RT95_MAIN_IMAGE_LEN);
  return {
    cdd,
    cdi: withLength(stock.cdi, CDI_LEN_OFF, cdd.length),
    spi: withLength(stock.spi, SPI_LEN_OFF, cdd.length),
  };
}

export async function makeSyntheticMainPatch(
  stock: SyntheticMainFiles,
  opts: { hook?: boolean; append?: Uint8Array } = {},
): Promise<Record<string, unknown>> {
  const built = synthMainBuilt(stock, opts);
  return {
    format: 1,
    name: 'retevis-rt95-main-firmware',
    version: 'synthetic',
    stock: await meta(stock),
    result: await meta(built),
    append: {
      offset: RT95_MAIN_IMAGE_LEN,
      hex: bytesToHex(opts.append ?? new Uint8Array(0)),
    },
    hooks: opts.hook
      ? [
          {
            offset: RT95_MAIN_HOOK_OFFSET,
            original: bytesToHex(RT95_MAIN_HOOK_ORIGINAL),
            hex: bytesToHex(SYNTH_HOOK),
          },
        ]
      : [],
  };
}
