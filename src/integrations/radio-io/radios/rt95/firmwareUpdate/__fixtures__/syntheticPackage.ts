/**
 * Test-only synthetic RT95 front panel firmware packages. The golden package is shared with the firmware project's
 * `tools/test_rt95update.py`: keep its numbers exact. Bytes `(i*7+3) & 0xFF` with a plausible vector table and the
 * public 7-byte model name. Never real stock.
 */
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import type { Rt95HeadFiles } from '../package.ts';

export const RT95_GOLDEN_LEN = 0x15500; // 87,296 bytes -> 86 frames, last frame at 0x08017400
export const RT95_GOLDEN_SHA256 = {
  cdd: '4bbc68841e5555a3d3ef1ae0a143d4eeb01a35711e08225392889be2610039c3',
  cdi: 'b93f75d60983259710f48a65aeca8cb9d18e8f0411305384e214a7c3c1447860',
  spi: '28be21b26e38f5098c64799b611255994a7cfdd48bd5fcf9961afb846ead1ac8',
  /** Host-to-radio stream: PROGRAM, 86 frames, `18`; no echo bytes. */
  stream: 'ceb0ebecc747a3df6791c17dac7528d852e189cd0c9180cb77afda80f92c0b66',
} as const;
export const RT95_GOLDEN_STREAM_LEN = 88_760;
export const RT95_GOLDEN_FRAMES = 86;

const enc = (s: string) => new TextEncoder().encode(s);

function putU32(b: Uint8Array, o: number, v: number): void {
  b[o] = v & 0xff;
  b[o + 1] = (v >>> 8) & 0xff;
  b[o + 2] = (v >>> 16) & 0xff;
  b[o + 3] = (v >>> 24) & 0xff;
}

export interface SynthRt95Options {
  readonly sp?: number;
  readonly reset?: number;
  /** false: leave the bytes at the model offset as the filler. */
  readonly model?: boolean;
  readonly dest?: number;
  /** `.spi` total; defaults to the length. */
  readonly total?: number;
  readonly count?: number;
  /** Extra bytes in the `.CDD` after `length`. */
  readonly cddExtra?: number;
  readonly offset?: number;
}

/** The three files of the golden package, or a variant of it. */
export function synthRt95HeadPackage(
  length = RT95_GOLDEN_LEN,
  opts: SynthRt95Options = {},
): Rt95HeadFiles {
  const cdd = new Uint8Array(length + (opts.cddExtra ?? 0));
  for (let i = 0; i < cdd.length; i++) cdd[i] = (i * 7 + 3) & 0xff;
  const base = opts.offset ?? 0;
  if (length >= 8) {
    putU32(cdd, base, opts.sp ?? 0x200045e8);
    putU32(cdd, base + 4, opts.reset ?? 0x08002229);
  }
  if ((opts.model ?? true) && length >= 0x15367) cdd.set(enc('RT95-P\0'), base + 0x15360);

  const cdi = new Uint8Array(278);
  cdi.fill(0x20, 0, 0x100);
  cdi.set(enc('RT95_MAIN.bin'), 0);
  putU32(cdi, 0x100, opts.dest ?? 0x08002000);
  putU32(cdi, 0x104, length);
  putU32(cdi, 0x108, base);
  putU32(cdi, 0x10c, 0x00010000);

  const spi = new Uint8Array(10);
  spi[0] = opts.count ?? 1;
  putU32(spi, 2, opts.total ?? length);
  return { cdd, cdi, spi };
}

/** Tests only: the real constructor is `prepareFirmwareImage`. */
export function preparedRt95HeadImage(
  files: Rt95HeadFiles,
  overrides: Partial<{ radioId: string; files: Record<string, Uint8Array> }> = {},
): PreparedFirmwareImage {
  return {
    radioId: overrides.radioId ?? 'retevis-rt95-head',
    provenance: 'stock',
    stockVersion: 'V0.00-test',
    title: 'stock firmware V0.00-test',
    package: {
      radioId: overrides.radioId ?? 'retevis-rt95-head',
      files: overrides.files ?? { cdd: files.cdd, cdi: files.cdi, spi: files.spi },
    },
    sha256: {},
    verifyHint: 'test',
  } as unknown as PreparedFirmwareImage;
}
