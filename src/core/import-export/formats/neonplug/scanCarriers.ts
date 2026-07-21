import type { Channel } from '@core/models/library.ts';
import type { SyntheticScanCarrier } from '@core/import-export/zoneDerivedScanLists/carrier.ts';
import type { AssembledChannel } from '@core/services/assemble.ts';
import type { ExpandedNeonplugChannelRow } from './channelExpansion.ts';
import type { NumberedNeonplugChannelRow } from './exportContext.ts';
import type { NeonplugScanList } from './wireTypes.ts';

export function neonplugCarrierChannelEntity(
  carrier: SyntheticScanCarrier,
  template: Channel,
): Channel {
  return {
    ...template,
    id: `scan-carrier:${carrier.zoneId}`,
    name: carrier.wireName,
    rxFrequency: carrier.frequencyHz,
    txFrequency: carrier.frequencyHz,
    modeProfiles: [
      { mode: 'fm', squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 },
    ],
  };
}

export function neonplugCarrierExpandedRow(
  carrier: SyntheticScanCarrier,
): ExpandedNeonplugChannelRow {
  return {
    sourceChannelId: `scan-carrier:${carrier.zoneId}`,
    key: `scan-carrier:${carrier.zoneId}`,
    wireName: carrier.wireName,
    mode: 'fm',
    modeProfile: {
      mode: 'fm',
      squelch: null,
      rxTone: 'none',
      txTone: 'none',
      bandwidthKHz: 12.5,
    },
    txContactRef: null,
    rxGroupListId: null,
    rowKind: 'lean',
  };
}

/**
 * Append zone-derived scan carriers after library expanded rows are numbered.
 * Sets designatedTxChannel on each matching scan list; returns zone→carrier number map.
 */
export function appendNeonplugScanCarriers(
  numbered: NumberedNeonplugChannelRow[],
  numbersBySourceChannelId: Map<string, number[]>,
  carriers: readonly SyntheticScanCarrier[],
  scanLists: NeonplugScanList[],
  scanListIdByZoneId: ReadonlyMap<string, number>,
  maxChannels: number,
  profileLabel: string,
  template: Channel | undefined,
  warnings: string[],
): {
  numbered: NumberedNeonplugChannelRow[];
  carrierSources: Map<string, AssembledChannel>;
  carrierNumberByZoneId: Map<string, number>;
} {
  const carrierSources = new Map<string, AssembledChannel>();
  const carrierNumberByZoneId = new Map<string, number>();
  if (!template || carriers.length === 0) {
    return { numbered, carrierSources, carrierNumberByZoneId };
  }

  const result = [...numbered];
  for (let i = 0; i < carriers.length; i++) {
    const carrier = carriers[i]!;
    if (result.length >= maxChannels) {
      warnings.push(
        `Truncated ${carriers.length - i} scan carrier channel(s) to fit ${maxChannels} channels for ${profileLabel}`,
      );
      break;
    }
    const sourceId = `scan-carrier:${carrier.zoneId}`;
    const number = result.length + 1;
    const entity = neonplugCarrierChannelEntity(carrier, template);
    result.push({ row: neonplugCarrierExpandedRow(carrier), number });
    numbersBySourceChannelId.set(sourceId, [number]);
    carrierSources.set(sourceId, { entity, wireName: carrier.wireName });
    carrierNumberByZoneId.set(carrier.zoneId, number);

    const scanListId = scanListIdByZoneId.get(carrier.zoneId);
    if (scanListId != null) {
      const list = scanLists[scanListId - 1];
      if (list) list.designatedTxChannel = number;
    }
  }

  return { numbered: result, carrierSources, carrierNumberByZoneId };
}
