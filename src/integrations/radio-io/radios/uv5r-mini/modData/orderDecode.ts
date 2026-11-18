import { crc16Xmodem } from '../../dm32uv/firmwareUpdate/crc16Xmodem.ts';
import { decodeUv5rMiniZoneTable } from './decode.ts';
import { decodeMiniScanSets } from './scanSetsDecode.ts';

/** Decode MMZO using the radio's validation and fallback rules. */
export function decodeMiniOrder(
  sector: Uint8Array,
): { fromRadio: boolean; slots: number[][] } | { reject: string } {
  const table = decodeUv5rMiniZoneTable(sector);
  if ('reject' in table) return { reject: 'no table' };
  const slots = table.zones.map((z) => z.slotIndexes);
  const fallback = () => ({ fromRadio: false, slots });
  if ('reject' in decodeMiniScanSets(sector)) return fallback();
  const stream = new Uint8Array([...sector.slice(0x40, 0x200), ...sector.slice(0x380, 0x400)]);
  const off = Math.ceil((22 + (stream[10]! | (stream[11]! << 8))) / 16) * 16;
  if (off + 22 > 576) return fallback();
  const b = stream.subarray(off);
  if (
    String.fromCharCode(...b.slice(0, 4)) !== 'MMZO' ||
    b[4] !== 1 ||
    b[5] !== slots.length ||
    b[6] ||
    b[7] ||
    b[12] ||
    b[13] ||
    (b[8]! | (b[9]! << 8)) !== table.generation
  )
    return fallback();
  const len = b[10]! | (b[11]! << 8);
  if (len > b.length - 22) return fallback();
  const kinds = Array.from({ length: 24 }, (_, i) => (b[16 + (i >> 2)]! >> (2 * (i & 3))) & 3);
  if (kinds.some((k, i) => k > 1 || (i >= slots.length && k !== 0))) return fallback();
  let bits = 0;
  for (let i = 0; i < slots.length; i++)
    if (kinds[i]) {
      const m = slots[i]!.length;
      if (m < 2) return fallback();
      bits += m * Math.ceil(Math.log2(m));
    }
  if (len !== Math.ceil(bits / 8) || (bits % 8 && b[21 + len]! >> (bits % 8))) return fallback();
  const covered = new Uint8Array(20 + len);
  covered.set(b.subarray(0, 14));
  covered.set(b.subarray(16, 22 + len), 14);
  if (crc16Xmodem(covered) !== (b[14]! | (b[15]! << 8))) return fallback();
  let bit = 0;
  const result: number[][] = [];
  for (let i = 0; i < slots.length; i++) {
    const zone = slots[i]!;
    if (!kinds[i]) {
      result.push(zone);
      continue;
    }
    const width = Math.ceil(Math.log2(zone.length));
    const indexes = zone.map(() => {
      let value = 0;
      for (let j = 0; j < width; j++, bit++) value |= ((b[22 + (bit >> 3)]! >> (bit & 7)) & 1) << j;
      return value;
    });
    if (new Set(indexes).size !== zone.length || indexes.some((n) => n >= zone.length))
      return fallback();
    result.push(indexes.map((n) => zone[n]!));
  }
  return { fromRadio: true, slots: result };
}
