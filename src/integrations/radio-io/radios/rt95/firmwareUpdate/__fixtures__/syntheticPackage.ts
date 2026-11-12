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

/**
 * The MAIN golden package, shared with the firmware project's `tools/test_rt95update.py` (`MAIN_GOLDEN`, phase 06b).
 * `.CDD` is the image plus a 40-byte tail that is never sent; 55 frames; SP 0x200013E8, reset 0x08002869.
 */
export const RT95_MAIN_GOLDEN_LEN = 0xd93c;
export const RT95_MAIN_GOLDEN_SHA256 = {
  cdd: 'b774f2897c0cac9761f3bab363c580bcbf4ea42ea52d7d876ef3d774fd27c5a4',
  cdi: '99fb0f983dd1ad1f563709025a6a3eddb60838653c3da8a40f20fbcae48b4d82',
  spi: '3d096d4788e747417c669f5348ac4b4c6aa3d31a2bd8dd7799300203729714c3',
  /** Host-to-radio stream: PROGRAM, 55 frames, `18`; no echo bytes. */
  stream: '3dc0d44c6ef7a141d5b8b245c2f42d0d21e171be1594cca2f8cd2e017a6cc2d3',
} as const;
export const RT95_MAIN_GOLDEN_FRAMES = 55;
export const RT95_MAIN_GOLDEN_STREAM_LEN = 56_768;

export interface SynthRt95MainOptions {
  readonly sp?: number;
  readonly reset?: number;
  /** false: leave the bytes at the model offset as the filler. */
  readonly model?: boolean;
  /** Extra bytes in the `.CDD` after the image (the stock tail is 40). */
  readonly tail?: number;
  /** Extra byte changed in the image at this offset (a non-stock MAIN-shaped image). */
  readonly flipAt?: number;
}

/** The three files of the MAIN golden package, or a variant of it. */
export function synthRt95MainPackage(
  length = RT95_MAIN_GOLDEN_LEN,
  opts: SynthRt95MainOptions = {},
): Rt95HeadFiles {
  const cdd = new Uint8Array(length + (opts.tail ?? 40));
  for (let i = 0; i < cdd.length; i++) cdd[i] = (i * 7 + 3) & 0xff;
  putU32(cdd, 0, opts.sp ?? 0x200013e8);
  putU32(cdd, 4, opts.reset ?? 0x08002869);
  if (opts.model ?? true) cdd.set(enc('RT95-P\0'), 0xd65c);
  cdd.set([0x08, 0xf0, 0x81, 0xfe], 0x382);
  if (opts.flipAt !== undefined) cdd[opts.flipAt] = cdd[opts.flipAt]! ^ 0xff;

  const cdi = new Uint8Array(278);
  cdi.fill(0x20, 0, 0x100);
  cdi.set(enc('RT95_MAIN.bin'), 0);
  putU32(cdi, 0x100, 0x08002000);
  putU32(cdi, 0x104, length);
  putU32(cdi, 0x108, 0);
  putU32(cdi, 0x10c, 0x00010000);

  const spi = new Uint8Array(10);
  spi[0] = 1;
  putU32(spi, 2, length);
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
