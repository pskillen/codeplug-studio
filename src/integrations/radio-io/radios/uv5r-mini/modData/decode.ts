import { UV5R_MINI_LIMITS } from '@core/radios/baofeng/uv-5r-mini/limits.ts';
import { crc16Xmodem } from '../../dm32uv/firmwareUpdate/crc16Xmodem.ts';
import { zoneTableGeneration } from './encode.ts';
import {
  MMZ1_BASE,
  MMZ1_BITMAPS_ADDR,
  MMZ1_BITMAP_BYTES,
  MMZ1_FRAME_BYTES,
  MMZ1_MAGIC,
  MMZ1_NAMES_ADDR,
  MMZ1_NAME_RECORD_BYTES,
  MMZ1_SECTOR_BYTES,
  MMZ1_VERSION,
} from './layout.ts';

export interface Uv5rMiniZoneTable {
  zones: { name: string; slotIndexes: number[] }[];
  crc: number;
  generation: number;
}

export interface Uv5rMiniZoneTableReject {
  /** The reader's reason; any reject means "no table, the radio is stock". */
  reject: string;
}

function nameOk(raw: Uint8Array): boolean {
  let end = raw.indexOf(0);
  if (end < 0) end = raw.length;
  if (end < 1) return false;
  for (let i = 0; i < end; i++) if (raw[i]! < 0x20 || raw[i]! > 0x7e) return false;
  for (let i = end; i < raw.length; i++) if (raw[i] !== 0) return false;
  return true;
}

function padOk(bm: Uint8Array): boolean {
  if (bm[124]! & 0x80) return false;
  for (let i = 125; i < MMZ1_BITMAP_BYTES; i++) if (bm[i] !== 0) return false;
  return true;
}

/** The radio's reader rules over the 4 KiB sector read from 0xC000. */
export function decodeUv5rMiniZoneTable(
  sector: Uint8Array,
): Uv5rMiniZoneTable | Uv5rMiniZoneTableReject {
  const { ZONE_MAX, ZONE_SLOTS, ZONE_NAME_LENGTH } = UV5R_MINI_LIMITS;
  if (sector.length !== MMZ1_SECTOR_BYTES) return { reject: 'sector is not 4096 bytes' };
  if (sector.subarray(0, MMZ1_FRAME_BYTES).every((b) => b === 0xff)) {
    return { reject: 'blank header' };
  }
  for (let i = 0; i < MMZ1_MAGIC.length; i++) {
    if (sector[i] !== MMZ1_MAGIC.charCodeAt(i)) return { reject: 'bad magic' };
  }
  if (sector[4] !== MMZ1_VERSION) return { reject: `unsupported version ${sector[4]}` };
  if (sector[6] !== 0) return { reject: 'flags set' };
  const n = sector[5]!;
  if (n > ZONE_MAX) return { reject: `zone count ${n} over ${ZONE_MAX}` };
  if ((sector[8]! | (sector[9]! << 8)) !== ZONE_SLOTS) {
    return { reject: `slot count is not ${ZONE_SLOTS}` };
  }

  const nameBase = MMZ1_NAMES_ADDR - MMZ1_BASE;
  const mapBase = MMZ1_BITMAPS_ADDR - MMZ1_BASE;
  const names: Uint8Array[] = [];
  const maps: Uint8Array[] = [];
  for (let i = 0; i < n; i++) {
    names.push(
      sector.subarray(
        nameBase + MMZ1_NAME_RECORD_BYTES * i,
        nameBase + MMZ1_NAME_RECORD_BYTES * (i + 1),
      ),
    );
    maps.push(
      sector.subarray(mapBase + MMZ1_BITMAP_BYTES * i, mapBase + MMZ1_BITMAP_BYTES * (i + 1)),
    );
  }
  for (let i = 0; i < n; i++) {
    if (!nameOk(names[i]!.subarray(0, ZONE_NAME_LENGTH))) return { reject: `zone ${i}: bad name` };
  }
  for (let i = 0; i < n; i++) {
    if (!padOk(maps[i]!)) return { reject: `zone ${i}: pad bits set` };
  }

  const covered = new Uint8Array(62 + n * (MMZ1_NAME_RECORD_BYTES + MMZ1_BITMAP_BYTES));
  covered.set(sector.subarray(0, 62), 0);
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
  if ((sector[62]! | (sector[63]! << 8)) !== crc) return { reject: 'CRC mismatch' };

  const zones = names.map((rec, i) => {
    let end = rec.subarray(0, ZONE_NAME_LENGTH).indexOf(0);
    if (end < 0) end = ZONE_NAME_LENGTH;
    let name = '';
    for (let j = 0; j < end; j++) name += String.fromCharCode(rec[j]!);
    const slotIndexes: number[] = [];
    for (let s = 0; s < ZONE_SLOTS; s++)
      if ((maps[i]![s >> 3]! >> (s & 7)) & 1) slotIndexes.push(s);
    return { name, slotIndexes };
  });
  return { zones, crc, generation: zoneTableGeneration(crc) };
}
