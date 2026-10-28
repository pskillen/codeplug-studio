/**
 * RT95 head three-file firmware package (`.spi`, `.CDI`, `.CDD`): a port of `Package` in the firmware project's
 * `tools/rt95update.py`. Structural errors throw RadioInterlockError: an unsafe package never sends.
 * The `.spi` is exactly 10 bytes, `{u16 count, u32 total, u32 0}`, with no model string.
 */
import { RadioInterlockError } from '../../../kit/errors.ts';
import {
  RT95_HEAD_FW_BASE,
  RT95_HEAD_FW_BLOCK,
  RT95_HEAD_FW_ENTRY,
  RT95_HEAD_FW_SPI_LEN,
} from './constants.ts';

export interface Rt95HeadEntry {
  readonly name: string;
  readonly dest: number;
  readonly len: number;
  readonly offset: number;
  readonly flag: number;
}

export interface Rt95HeadPackage {
  readonly entry: Rt95HeadEntry;
  /** The `.spi` total, equal to `entry.len`. */
  readonly total: number;
  /** The whole `.CDD` file; only `entry.len` bytes from `entry.offset` are sent. */
  readonly cdd: Uint8Array;
  /** The bytes that are sent: `cdd[offset, offset + len)`. */
  readonly image: Uint8Array;
}

export interface Rt95HeadFiles {
  readonly cdd: Uint8Array;
  readonly cdi: Uint8Array;
  readonly spi: Uint8Array;
}

const u16 = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u32 = (b: Uint8Array, o: number) =>
  (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;

function nameOf(b: Uint8Array): string {
  const nul = b.indexOf(0);
  return String.fromCharCode(...(nul < 0 ? b : b.subarray(0, nul))).trim();
}

export function parseRt95HeadPackage(files: Rt95HeadFiles): Rt95HeadPackage {
  const { spi, cdi, cdd } = files;
  if (spi.length !== RT95_HEAD_FW_SPI_LEN) {
    throw new RadioInterlockError(
      `The .spi file must be exactly ${RT95_HEAD_FW_SPI_LEN} bytes (it is ${spi.length}): this is not an RT95 firmware package.`,
    );
  }
  if (u16(spi, 0) !== 1) {
    throw new RadioInterlockError(
      `The .spi says ${u16(spi, 0)} entries; an RT95 front panel package has exactly 1.`,
    );
  }
  if (u32(spi, 6) !== 0) {
    throw new RadioInterlockError(
      'The .spi tail is not zero: this is not an RT95 firmware package.',
    );
  }
  if (cdi.length !== RT95_HEAD_FW_ENTRY) {
    throw new RadioInterlockError(
      `The .CDI file is ${cdi.length} bytes; one entry is ${RT95_HEAD_FW_ENTRY}.`,
    );
  }
  const entry: Rt95HeadEntry = {
    name: nameOf(cdi.subarray(0, 0x100)),
    dest: u32(cdi, 0x100),
    len: u32(cdi, 0x104),
    offset: u32(cdi, 0x108),
    flag: u32(cdi, 0x10c),
  };
  if (entry.dest !== RT95_HEAD_FW_BASE) {
    throw new RadioInterlockError(
      `The entry loads at 0x${entry.dest.toString(16).padStart(8, '0')}; it must load at 0x${RT95_HEAD_FW_BASE.toString(16).padStart(8, '0')}.`,
    );
  }
  if ((entry.dest & (RT95_HEAD_FW_BLOCK - 1)) !== 0) {
    throw new RadioInterlockError('The entry address is not 1 KiB aligned.');
  }
  const total = u32(spi, 2);
  if (total !== entry.len) {
    throw new RadioInterlockError(
      `The .spi total length (${total}) does not match the .CDI entry length (${entry.len}).`,
    );
  }
  if (entry.offset + entry.len > cdd.length) {
    throw new RadioInterlockError(`Entry "${entry.name}" runs past the end of the .CDD file.`);
  }
  return {
    entry,
    total,
    cdd,
    image: cdd.subarray(entry.offset, entry.offset + entry.len),
  };
}

/** Blocks in send order: 1,024 bytes each, the last zero-padded. Lazy. */
export function* rt95HeadBlocks(
  pkg: Rt95HeadPackage,
): Generator<{ addr: number; data: Uint8Array }> {
  const { entry, image } = pkg;
  for (let k = 0; k < entry.len; k += RT95_HEAD_FW_BLOCK) {
    const n = Math.min(RT95_HEAD_FW_BLOCK, entry.len - k);
    const data = new Uint8Array(RT95_HEAD_FW_BLOCK);
    data.set(image.subarray(k, k + n));
    yield { addr: entry.dest + k, data };
  }
}

export function rt95HeadBlockCount(pkg: Rt95HeadPackage): number {
  return Math.ceil(pkg.entry.len / RT95_HEAD_FW_BLOCK);
}
