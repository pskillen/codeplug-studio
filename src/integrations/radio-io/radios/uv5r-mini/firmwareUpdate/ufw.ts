/**
 * Reader for the UV-5R Mini `.ufw` container (interlocks I1 and I2). Layout and CRCs are in constants.ts and in
 * docs/reference/radios/baofeng/uv-5r-mini/firmware.md. The reader only looks at the framing, which is plain apart
 * from the ENC layer: it never descrambles the firmware inside `flash.bin`.
 */
import { crc16Xmodem } from '../../dm32uv/firmwareUpdate/crc16Xmodem.ts';
import {
  OTA_ENTRY_ATTR,
  OTA_ENTRY_SIZE,
  OTA_LOADER_NAME,
  UFW_ENC_KEY,
  UFW_ENC_POLY,
  UFW_ENTRY_NAME_LEN,
  UFW_ENTRY_NAME_OFFSET,
  UFW_ENTRY_SIZE,
  UFW_HEADER_SIZE,
  UFW_NAME_FLASH,
  UFW_NAME_OTA,
  UFW_TYPE_FLASH,
  UFW_TYPE_OTA,
} from './constants.ts';

export type Uv5rMiniUfwErrorCode =
  | 'too-short'
  | 'header-crc'
  | 'list-crc'
  | 'entry-count'
  | 'entry-outside-file'
  | 'data-crc'
  | 'entry-set'
  | 'ota-directory'
  | 'ota-loader-name'
  | 'ota-loader-attr'
  | 'ota-header-crc'
  | 'ota-data-crc';

/** A `.ufw` that does not have the shape the updater accepts. Mapped to an operator message by the interlocks. */
export class Uv5rMiniUfwError extends Error {
  constructor(
    readonly code: Uv5rMiniUfwErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'Uv5rMiniUfwError';
  }
}

/**
 * ENC layer: XOR each byte with the low byte of a 16-bit key that steps after every byte. The key does not depend on
 * the data, so the same call encodes and decodes.
 */
export function encDecode(bytes: Uint8Array, key = UFW_ENC_KEY): Uint8Array {
  const out = new Uint8Array(bytes.length);
  let k = key;
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i]! ^ (k & 0xff);
    k = ((k << 1) ^ (k & 0x8000 ? UFW_ENC_POLY : 0)) & 0xffff;
  }
  return out;
}

const u16 = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u32 = (b: Uint8Array, o: number) =>
  (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;

function cString(b: Uint8Array): string {
  let n = b.indexOf(0);
  if (n < 0) n = b.length;
  return String.fromCharCode(...b.subarray(0, n));
}

export interface UfwHeader {
  readonly hdrCrc: number;
  readonly listCrc: number;
  readonly imageSize: number;
  readonly entryCount: number;
}

export interface UfwEntry {
  readonly type: number;
  readonly idx: number;
  readonly dataCrc: number;
  readonly off: number;
  readonly size: number;
  readonly alignedSize: number;
  readonly name: string;
  readonly data: Uint8Array;
}

export interface OtaEntry {
  readonly hcrc: number;
  readonly dcrc: number;
  readonly off: number;
  readonly size: number;
  readonly attr: number;
  readonly idx: number;
  readonly name: string;
}

export interface Uv5rMiniUfwContainer {
  readonly header: UfwHeader;
  readonly entries: { readonly flash: UfwEntry; readonly ota: UfwEntry };
}

export interface Uv5rMiniUfw extends Uv5rMiniUfwContainer {
  readonly loader: { readonly packed: Uint8Array; readonly entry: OtaEntry };
}

/** A stock base: the container, and a loader only when the file carries one. */
export interface Uv5rMiniStockUfw extends Uv5rMiniUfwContainer {
  readonly loader: Uv5rMiniUfw['loader'] | null;
}

/** Parse and check the container: I1 (framing, CRCs, entry set) and I2 (the one `uart_user.bin` loader). */
export function parseUv5rMiniUfw(bytes: Uint8Array): Uv5rMiniUfw {
  const container = parseContainer(bytes);
  return { ...container, loader: parseLoader(container.entries.ota) };
}

/**
 * Parse a file used as a stock base only. As `parseUv5rMiniUfw`, except that an `ota.bin` of all `0xFF` (no loader,
 * by design: the file of a build no pinned loader lists) is accepted. An `ota.bin` that holds anything else must
 * still be a well-formed loader entry. An image to flash never goes through here: it keeps I2.
 */
export function parseUv5rMiniStockUfw(bytes: Uint8Array): Uv5rMiniStockUfw {
  const container = parseContainer(bytes);
  const { data } = container.entries.ota;
  const blank = data.length > 0 && data.every((b) => b === 0xff);
  return { ...container, loader: blank ? null : parseLoader(container.entries.ota) };
}

function parseContainer(bytes: Uint8Array): Uv5rMiniUfwContainer {
  if (bytes.length < UFW_HEADER_SIZE) {
    throw new Uv5rMiniUfwError('too-short', 'The image is too short to hold a header.');
  }
  const hdr = encDecode(bytes.subarray(0, UFW_HEADER_SIZE));
  const header: UfwHeader = {
    hdrCrc: u16(hdr, 0),
    listCrc: u16(hdr, 2),
    imageSize: u32(hdr, 4),
    entryCount: u16(hdr, 8),
  };
  if (crc16Xmodem(hdr.subarray(2)) !== header.hdrCrc) {
    throw new Uv5rMiniUfwError('header-crc', 'The image header fails its checksum.');
  }
  if (header.entryCount !== 2) {
    throw new Uv5rMiniUfwError(
      'entry-count',
      `The image lists ${header.entryCount} files; it must hold exactly flash.bin and ota.bin.`,
    );
  }
  const tableEnd = UFW_HEADER_SIZE + header.entryCount * UFW_ENTRY_SIZE;
  if (bytes.length < tableEnd) {
    throw new Uv5rMiniUfwError('too-short', 'The image is too short to hold its file table.');
  }
  const table = bytes.subarray(UFW_HEADER_SIZE, tableEnd);
  if (crc16Xmodem(table) !== header.listCrc) {
    throw new Uv5rMiniUfwError('list-crc', 'The image file table fails its checksum.');
  }

  const entries: UfwEntry[] = [];
  for (let i = 0; i < header.entryCount; i++) {
    const e = encDecode(table.subarray(i * UFW_ENTRY_SIZE, (i + 1) * UFW_ENTRY_SIZE));
    const off = u32(e, 8);
    const size = u32(e, 0xc);
    const name = cString(
      e.subarray(UFW_ENTRY_NAME_OFFSET, UFW_ENTRY_NAME_OFFSET + UFW_ENTRY_NAME_LEN),
    );
    if (off < tableEnd || off + size > bytes.length) {
      throw new Uv5rMiniUfwError('entry-outside-file', `${name} lies outside the image file.`);
    }
    const data = bytes.subarray(off, off + size);
    if (crc16Xmodem(data) !== u16(e, 4)) {
      throw new Uv5rMiniUfwError('data-crc', `${name} fails its checksum.`);
    }
    entries.push({
      type: u16(e, 0),
      idx: u16(e, 2),
      dataCrc: u16(e, 4),
      off,
      size,
      alignedSize: u32(e, 0x10),
      name,
      data,
    });
  }
  const flash = entries.find((e) => e.type === UFW_TYPE_FLASH && e.name === UFW_NAME_FLASH);
  const ota = entries.find((e) => e.type === UFW_TYPE_OTA && e.name === UFW_NAME_OTA);
  if (!flash || !ota) {
    throw new Uv5rMiniUfwError(
      'entry-set',
      'The image must hold exactly flash.bin (type 0) and ota.bin (type 100).',
    );
  }

  return { header, entries: { flash, ota } };
}

/** `ota.bin`: a plaintext directory of exactly one entry, the loader following it. */
function parseLoader(ota: UfwEntry): Uv5rMiniUfw['loader'] {
  const d = ota.data;
  if (d.length < OTA_ENTRY_SIZE) {
    throw new Uv5rMiniUfwError('ota-directory', 'ota.bin is too short to hold a loader entry.');
  }
  const entry: OtaEntry = {
    hcrc: u16(d, 0),
    dcrc: u16(d, 2),
    off: u32(d, 4),
    size: u32(d, 8),
    attr: d[0xc]!,
    idx: u16(d, 0xe),
    name: cString(d.subarray(0x10, 0x20)),
  };
  if (entry.off !== OTA_ENTRY_SIZE || entry.size === 0 || entry.off + entry.size > d.length) {
    throw new Uv5rMiniUfwError(
      'ota-directory',
      'ota.bin must hold exactly one loader entry, with the loader straight after it.',
    );
  }
  if (entry.name !== OTA_LOADER_NAME) {
    throw new Uv5rMiniUfwError(
      'ota-loader-name',
      `ota.bin holds "${entry.name}", not ${OTA_LOADER_NAME}.`,
    );
  }
  if (entry.attr !== OTA_ENTRY_ATTR) {
    throw new Uv5rMiniUfwError('ota-loader-attr', 'The loader entry has the wrong attribute.');
  }
  if (crc16Xmodem(d.subarray(2, OTA_ENTRY_SIZE)) !== entry.hcrc) {
    throw new Uv5rMiniUfwError('ota-header-crc', 'The loader entry fails its checksum.');
  }
  const packed = d.subarray(entry.off, entry.off + entry.size);
  if (crc16Xmodem(packed) !== entry.dcrc) {
    throw new Uv5rMiniUfwError('ota-data-crc', 'The loader fails its checksum.');
  }
  return { packed, entry };
}
