/**
 * AT-D890UV three-file firmware package (`.spi`, `.CDI`, `.CDD`): a port of `Package` in the firmware project's
 * `tools/d890update.py`, firmware mode only. Structural errors throw RadioInterlockError: an unsafe package never sends.
 */
import { RadioInterlockError } from '../../../kit/errors.ts';
import { AT_D890_FW_BLOCK, AT_D890_FW_ENTRY } from './constants.ts';

export interface D890FirmwareEntry {
  readonly name: string;
  readonly addr: number;
  readonly len: number;
  readonly off: number;
  readonly flag: number;
}

export interface D890FirmwarePackage {
  readonly model: string;
  readonly version: string;
  readonly entries: readonly D890FirmwareEntry[];
  readonly cdd: Uint8Array;
}

export interface D890FirmwareFiles {
  readonly cdd: Uint8Array;
  readonly cdi: Uint8Array;
  readonly spi: Uint8Array;
}

const u16 = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u32 = (b: Uint8Array, o: number) =>
  (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;

/** ASCII decode, then trim whitespace and NULs, like Python's `decode().strip()` on these fields. */
function ascii(b: Uint8Array): string {
  return String.fromCharCode(...b).trim();
}

export function parseD890FirmwarePackage(files: D890FirmwareFiles): D890FirmwarePackage {
  const { spi, cdi, cdd } = files;
  if (spi.length === 14) {
    throw new RadioInterlockError('ICON pack / resource mode is not supported.');
  }
  if ((spi.length !== 50 && spi.length !== 51) || u32(spi, 0) !== 0x20) {
    throw new RadioInterlockError(
      'The .spi file must be 50 or 51 bytes long and start with 0x20: this is not a firmware package.',
    );
  }
  const count = u16(spi, 4);
  const total = u32(spi, 6);
  if (cdi.length !== AT_D890_FW_ENTRY * count) {
    throw new RadioInterlockError(
      `The .CDI file is ${cdi.length} bytes; the .spi says ${count} entries of ${AT_D890_FW_ENTRY}.`,
    );
  }
  if (total !== cdd.length) {
    throw new RadioInterlockError(
      `The .spi total length (${total}) does not match the .CDD length (${cdd.length}).`,
    );
  }
  const entries: D890FirmwareEntry[] = [];
  for (let i = 0; i < count; i++) {
    const e = cdi.subarray(i * AT_D890_FW_ENTRY, (i + 1) * AT_D890_FW_ENTRY);
    const nameBytes = e.subarray(0, 0x100);
    const nul = nameBytes.indexOf(0);
    const name = ascii(nul < 0 ? nameBytes : nameBytes.subarray(0, nul));
    const addr = u32(e, 0x100);
    const len = u32(e, 0x104);
    const off = u32(e, 0x108);
    const flag = u32(e, 0x10c);
    if (off + len > cdd.length) {
      throw new RadioInterlockError(`Entry "${name}" runs past the end of the .CDD file.`);
    }
    entries.push({ name, addr, len, off, flag });
  }
  return {
    model: ascii(spi.subarray(0x0e, 0x14)),
    version: ascii(spi.subarray(0x16, 0x1a)),
    entries,
    cdd,
  };
}

/**
 * Blocks in send order: entry by entry, 32 bytes each, the last block of an entry zero-padded. Lazy: a full image
 * is about 52,000 blocks.
 */
export function* d890Blocks(
  pkg: D890FirmwarePackage,
): Generator<{ addr: number; data: Uint8Array }> {
  for (const e of pkg.entries) {
    for (let k = 0; k < e.len; k += AT_D890_FW_BLOCK) {
      const n = Math.min(AT_D890_FW_BLOCK, e.len - k);
      const data = new Uint8Array(AT_D890_FW_BLOCK);
      data.set(pkg.cdd.subarray(e.off + k, e.off + k + n));
      yield { addr: e.addr + k, data };
    }
  }
}

export function d890BlockCount(pkg: D890FirmwarePackage): number {
  return pkg.entries.reduce((n, e) => n + Math.ceil(e.len / AT_D890_FW_BLOCK), 0);
}
