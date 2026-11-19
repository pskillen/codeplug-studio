import type { RadioZoneDto } from '../../../radioWriteProjection.ts';
import { decodeUv5rMiniZoneTable } from './decode.ts';
import { decodeMiniOrder } from './orderDecode.ts';
import { decodeMiniScanSets } from './scanSetsDecode.ts';

export type Uv5rMiniZoneRead =
  | { kind: 'none'; reason: string }
  | {
      kind: 'zones';
      zones: RadioZoneDto[];
      memberOrderFromRadio: boolean;
      scanSetsFromRadio: boolean;
    };

/** Decode the table and its optional member order and scan sets. */
export function decodeUv5rMiniZoneRead(sector: Uint8Array): Uv5rMiniZoneRead {
  const table = decodeUv5rMiniZoneTable(sector);
  if ('reject' in table) return { kind: 'none', reason: table.reject };
  const order = decodeMiniOrder(sector);
  const scans = decodeMiniScanSets(sector);
  // The table has already been validated, so the order reader cannot reject it.
  const orderedSlots = 'reject' in order ? table.zones.map((z) => z.slotIndexes) : order.slots;
  const zones = table.zones.map((zone, i): RadioZoneDto => {
    const channelNumbers = orderedSlots[i]!.map((slot) => slot + 1);
    if ('reject' in scans) return { wireName: zone.name, channelNumbers };
    const included = new Set(zone.slotIndexes.filter((_, j) => scans.include[i]![j]));
    return {
      wireName: zone.name,
      channelNumbers,
      scanChannelNumbers: channelNumbers.filter((number) => included.has(number - 1)),
    };
  });
  return {
    kind: 'zones',
    zones,
    memberOrderFromRadio: !('reject' in order) && order.fromRadio,
    scanSetsFromRadio: !('reject' in scans),
  };
}
