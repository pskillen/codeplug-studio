import { UV5R_MINI_LIMITS } from '@core/radios/baofeng/uv-5r-mini/limits.ts';
import { crc16Xmodem } from '../../dm32uv/firmwareUpdate/crc16Xmodem.ts';
import {
  MMZ1_BASE,
  MMZ1_BITMAPS_ADDR,
  MMZ1_BITMAP_BYTES,
  MMZ1_FRAME_BYTES,
  MMZ1_HEADER_ADDR,
  MMZ1_MAGIC,
  MMZ1_NAMES_ADDR,
  MMZ1_NAME_RECORD_BYTES,
  MMZ1_SECTOR_BYTES,
  MMZ1_VERSION,
} from './layout.ts';

export interface Uv5rMiniZoneTableInput {
  /** `slotIndexes` are 0-based channel slots (channel 1 = slot 0), any order; duplicates collapse (a zone is a set). */
  zones: readonly { name: string; slotIndexes: readonly number[] }[];
}

export interface Uv5rMiniZoneFrame {
  address: number;
  /** Always 64 bytes. */
  bytes: Uint8Array;
}

export interface Uv5rMiniZoneTableEncoded {
  /** In write order: header, name frames, then each zone's two bitmap frames (lower first). */
  frames: readonly Uv5rMiniZoneFrame[];
  /** CRC-16/XMODEM stored in the header. */
  crc: number;
  /** The table generation: the CRC with 0x0000 -> 0x0001 and 0xFFFF -> 0xFFFE. */
  generation: number;
  /** The sector image, 4 KiB, FF where nothing is written. */
  sector: Uint8Array;
}

export class Uv5rMiniZoneTableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Uv5rMiniZoneTableError';
  }
}

/** Name bytes: 1-12 characters, each 0x20-0x7E. */
export function isValidZoneName(name: string): boolean {
  if (name.length < 1 || name.length > UV5R_MINI_LIMITS.ZONE_NAME_LENGTH) return false;
  for (let i = 0; i < name.length; i++) {
    const c = name.charCodeAt(i);
    if (c < 0x20 || c > 0x7e) return false;
  }
  return true;
}

export function zoneTableGeneration(crc: number): number {
  return crc === 0x0000 ? 0x0001 : crc === 0xffff ? 0xfffe : crc;
}

function bitmapOf(slots: readonly number[]): Uint8Array {
  const out = new Uint8Array(MMZ1_BITMAP_BYTES);
  for (const s of slots) out[s >> 3]! |= 1 << (s & 7);
  return out;
}

export function encodeUv5rMiniZoneTable(input: Uv5rMiniZoneTableInput): Uv5rMiniZoneTableEncoded {
  const { ZONE_MAX, ZONE_SLOTS } = UV5R_MINI_LIMITS;
  const n = input.zones.length;
  if (n > ZONE_MAX) throw new Uv5rMiniZoneTableError(`at most ${ZONE_MAX} zones, got ${n}`);

  const names: Uint8Array[] = [];
  const maps: Uint8Array[] = [];
  for (const z of input.zones) {
    if (!isValidZoneName(z.name)) {
      throw new Uv5rMiniZoneTableError(
        `bad zone name ${JSON.stringify(z.name)}: 1-${UV5R_MINI_LIMITS.ZONE_NAME_LENGTH} printable ASCII characters`,
      );
    }
    const slots = [...new Set(z.slotIndexes)];
    if (slots.length === 0) {
      throw new Uv5rMiniZoneTableError(`zone ${JSON.stringify(z.name)} has no members`);
    }
    for (const s of slots) {
      if (!Number.isInteger(s) || s < 0 || s >= ZONE_SLOTS) {
        throw new Uv5rMiniZoneTableError(
          `zone ${JSON.stringify(z.name)}: slot ${s} is outside 0-${ZONE_SLOTS - 1}`,
        );
      }
    }
    const rec = new Uint8Array(MMZ1_NAME_RECORD_BYTES);
    for (let i = 0; i < z.name.length; i++) rec[i] = z.name.charCodeAt(i);
    rec[12] = slots.length & 0xff;
    rec[13] = (slots.length >> 8) & 0xff;
    names.push(rec);
    maps.push(bitmapOf(slots));
  }

  const head = new Uint8Array(MMZ1_FRAME_BYTES);
  for (let i = 0; i < MMZ1_MAGIC.length; i++) head[i] = MMZ1_MAGIC.charCodeAt(i);
  head[4] = MMZ1_VERSION;
  head[5] = n;
  head[8] = ZONE_SLOTS & 0xff;
  head[9] = (ZONE_SLOTS >> 8) & 0xff;

  const covered = new Uint8Array(62 + n * (MMZ1_NAME_RECORD_BYTES + MMZ1_BITMAP_BYTES));
  covered.set(head.subarray(0, 62), 0);
  let off = 62;
  for (const r of names) {
    covered.set(r, off);
    off += r.length;
  }
  for (const m of maps) {
    covered.set(m, off);
    off += m.length;
  }
  const crc = crc16Xmodem(covered);
  head[62] = crc & 0xff;
  head[63] = (crc >> 8) & 0xff;

  const sector = new Uint8Array(MMZ1_SECTOR_BYTES).fill(0xff);
  const frames: Uv5rMiniZoneFrame[] = [];
  const put = (address: number, bytes: Uint8Array): void => {
    frames.push({ address, bytes });
    sector.set(bytes, address - MMZ1_BASE);
  };

  put(MMZ1_HEADER_ADDR, head);
  for (let k = 0; k < Math.ceil(n / 4); k++) {
    const frame = new Uint8Array(MMZ1_FRAME_BYTES).fill(0xff);
    names.slice(4 * k, 4 * k + 4).forEach((r, j) => frame.set(r, j * MMZ1_NAME_RECORD_BYTES));
    put(MMZ1_NAMES_ADDR + MMZ1_FRAME_BYTES * k, frame);
  }
  maps.forEach((bm, i) => {
    for (const h of [0, 1]) {
      put(
        MMZ1_BITMAPS_ADDR + MMZ1_BITMAP_BYTES * i + MMZ1_FRAME_BYTES * h,
        bm.slice(MMZ1_FRAME_BYTES * h, MMZ1_FRAME_BYTES * (h + 1)),
      );
    }
  });

  return { frames, crc, generation: zoneTableGeneration(crc), sector };
}
