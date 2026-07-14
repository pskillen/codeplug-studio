import { newChannel } from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
import type { AssembledBuild, AssembledChannel, LibrarySlice } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { isZoneScanCarrierChannelId } from '@core/import-export/zoneDerivedScanLists/carrier.ts';
import type { SyntheticScanCarrier } from '@core/import-export/zoneDerivedScanLists/carrier.ts';
import {
  buildAnytoneExportWireContext,
  type AnytoneExportWireContext,
} from './exportWireContext.ts';
import {
  expandAllAnytoneChannelsForExport,
  anytoneChannelExpansionById,
  type ExpandedAnytoneChannelRow,
} from './channelExpansion.ts';
import {
  deriveAnytoneZoneDerivedScanLists,
  zoneDerivedScanListId,
} from './zoneDerivedScanLists.ts';
import { getAnytoneProfile, DEFAULT_ANYTONE_PROFILE_ID } from './profiles.ts';

export interface AnytonePreparedExport {
  assembled: AssembledBuild;
  context: AnytoneExportWireContext;
  carrierPrependByZoneId: Map<string, string>;
  expandedChannels: ExpandedAnytoneChannelRow[];
  expansionByChannelId: Map<string, ExpandedAnytoneChannelRow[]>;
}

function carrierChannelEntity(carrier: SyntheticScanCarrier, projectId: string): Channel {
  const baseName = `${carrier.zoneName} Scan`.trim();
  return {
    ...newChannel(projectId, baseName, ''),
    id: `scan-carrier:${carrier.zoneId}`,
    scanListId: null,
    rxFrequency: carrier.frequencyHz,
    txFrequency: carrier.frequencyHz,
    modeProfiles: [
      {
        mode: 'fm',
        squelch: null,
        rxTone: 'none',
        txTone: 'none',
        bandwidthKHz: 12.5,
      },
    ],
  };
}

/** Merge library + zone-derived scan lists, carrier channels, and wire context. */
export function prepareAnytoneExportAssembly(
  assembled: AssembledBuild,
  library: LibrarySlice,
  options?: CpsExportOptions,
  warnings: string[] = [],
): AnytonePreparedExport {
  const derived = deriveAnytoneZoneDerivedScanLists(assembled, library, options, warnings);
  const mergedScanLists = [...assembled.scanLists, ...derived.scanLists];

  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_ANYTONE_PROFILE_ID;
  const profile = getAnytoneProfile(profileId);
  if (mergedScanLists.length > profile.maxScanLists) {
    warnings.push(
      `Scan list count ${mergedScanLists.length} exceeds profile cap ${profile.maxScanLists}`,
    );
  }

  const projectId = assembled.channels[0]?.entity.projectId ?? library.channels[0]?.projectId ?? '';
  const carrierRows: AssembledChannel[] = derived.carriers.map((carrier) => ({
    entity: carrierChannelEntity(carrier, projectId),
    wireName: carrier.wireName,
  }));

  const withCarriers: AssembledBuild = {
    ...assembled,
    scanLists: mergedScanLists,
    channels: [...assembled.channels, ...carrierRows],
  };

  const expandedChannels = expandAllAnytoneChannelsForExport(
    withCarriers,
    library,
    options,
    warnings,
  );
  const expansionByChannelId = anytoneChannelExpansionById(expandedChannels);
  const context = buildAnytoneExportWireContext(withCarriers, expandedChannels, options, warnings);

  const carrierChannels = carrierRows.map((row) => {
    const zoneId = row.entity.id.replace('scan-carrier:', '');
    return {
      ...row,
      wireName: context.channelWireName(row.entity.id) || row.wireName,
      scanListWireName: context.scanListWireName(zoneDerivedScanListId(zoneId)),
    };
  });

  const exportAssembly: AssembledBuild = {
    ...withCarriers,
    channels: [...assembled.channels, ...carrierChannels],
  };

  const carrierPrependByZoneId = new Map<string, string>();
  for (const carrier of derived.carriers) {
    const carrierId = `scan-carrier:${carrier.zoneId}`;
    const wireName = context.channelWireName(carrierId);
    if (wireName) {
      carrierPrependByZoneId.set(carrier.zoneId, wireName);
    }
  }

  return {
    assembled: exportAssembly,
    context,
    carrierPrependByZoneId,
    expandedChannels,
    expansionByChannelId,
  };
}

export { isZoneScanCarrierChannelId };
