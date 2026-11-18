/** Decode MMZS using the radio's validation rules. */
import { crc16Xmodem } from '../../dm32uv/firmwareUpdate/crc16Xmodem.ts';
import { decodeUv5rMiniZoneTable } from './decode.ts';

export function decodeMiniScanSets(
  sector: Uint8Array,
): { kinds: number[]; include: boolean[][] } | { reject: string } {
  const table = decodeUv5rMiniZoneTable(sector);
  if ('reject' in table) return { reject: 'no table' };
  const stream = new Uint8Array(576);
  stream.set(sector.subarray(0x40, 0x200));
  stream.set(sector.subarray(0x380, 0x400), 448);
  if (stream.slice(0, 4).every((n) => n === 255)) return { reject: 'no block' };
  if (String.fromCharCode(...stream.slice(0, 4)) !== 'MMZS') return { reject: 'magic' };
  if (stream[4] !== 1) return { reject: 'version' };
  if (stream[5] !== table.zones.length) return { reject: 'zone count' };
  if (stream[6] !== 0) return { reject: 'flags' };
  if (stream[7] || stream[12] || stream[13]) return { reject: 'reserved' };
  if ((stream[8]! | (stream[9]! << 8)) !== table.generation) return { reject: 'stale generation' };
  const length = stream[10]! | (stream[11]! << 8);
  if (length > 554) return { reject: 'data length' };
  const kinds = Array.from({ length: 24 }, (_, i) => (stream[16 + (i >> 2)]! >> (2 * (i & 3))) & 3);
  if (kinds.slice(0, table.zones.length).some((k) => k > 1)) return { reject: 'kind' };
  if (kinds.slice(table.zones.length).some(Boolean)) return { reject: 'kind past N' };
  const used = table.zones.reduce(
    (sum, zone, i) => sum + (kinds[i] === 1 ? zone.slotIndexes.length : 0),
    0,
  );
  if (Math.ceil(used / 8) !== length) return { reject: 'data length' };
  if (used % 8 && stream[21 + length]! >> (used % 8)) return { reject: 'pad' };
  const covered = new Uint8Array(20 + length);
  covered.set(stream.subarray(0, 14));
  covered.set(stream.subarray(16, 22 + length), 14);
  if (crc16Xmodem(covered) !== (stream[14]! | (stream[15]! << 8))) return { reject: 'CRC' };
  let bit = 0;
  const include = table.zones.map((zone, i) =>
    zone.slotIndexes.map(() => {
      if (kinds[i] === 0) return true;
      const value = Boolean(stream[22 + (bit >> 3)]! & (1 << (bit & 7)));
      bit++;
      return value;
    }),
  );
  return { kinds: kinds.slice(0, table.zones.length), include };
}
