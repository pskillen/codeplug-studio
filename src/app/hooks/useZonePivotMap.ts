import { useMemo } from 'react';
import type { Channel, Library, Zone } from '@core/models/library.ts';
import {
  applyFilters,
  channelHasGeolocation,
  DEFAULT_MAP_FILTER_OPTS,
} from '@core/domain/mapProjection.ts';
import { channelsNotInAnyZone } from '@core/domain/zoneMembership.ts';
import { resolveEffectiveZoneChannelIds } from '@core/domain/zoneHierarchy.ts';
import type { ZonePivotState } from '../routes/library/zonePivotQuery.ts';

export interface ZonePivotMapConfig {
  channels: Channel[];
  zones: Zone[];
  allChannels: Channel[];
  mapControlMode?: 'zoneEmphasis' | 'zoneFromLocation';
  emphasisZoneId?: string;
  fitBoundsChannelIds?: string[];
  dimmedChannelIds?: string[];
}

export function useZonePivotMap(
  library: Library,
  pivot: ZonePivotState,
  activeZone: Zone | null,
  filteredRowChannels: Channel[],
): { config: ZonePivotMapConfig; skippedCount: number } {
  const { channels, zones } = library;

  const skippedCount = useMemo(
    () => applyFilters(channels, DEFAULT_MAP_FILTER_OPTS).skipped.length,
    [channels],
  );

  const config = useMemo((): ZonePivotMapConfig => {
    if (pivot.pivot === 'zone' && activeZone) {
      const previewZone = activeZone;
      const zonesForMap = [...zones.filter((z) => z.id !== activeZone.id), previewZone];
      const channelsForMap = channels;
      const fitBoundsChannelIds = resolveEffectiveZoneChannelIds(previewZone, zonesForMap);
      const memberIds = new Set(fitBoundsChannelIds);
      const dimmedChannelIds = channelsForMap
        .filter((ch) => channelHasGeolocation(ch) && !memberIds.has(ch.id))
        .map((ch) => ch.id);

      return {
        channels: channelsForMap,
        zones: zonesForMap,
        allChannels: channels,
        mapControlMode: 'zoneEmphasis',
        emphasisZoneId: activeZone.id,
        fitBoundsChannelIds,
        dimmedChannelIds,
      };
    }

    if (pivot.pivot === 'orphans') {
      const orphanIds = new Set(channelsNotInAnyZone(library).map((ch) => ch.id));
      return {
        channels: filteredRowChannels.filter((ch) => orphanIds.has(ch.id)),
        zones,
        allChannels: channels,
        dimmedChannelIds: channels
          .filter((ch) => channelHasGeolocation(ch) && !orphanIds.has(ch.id))
          .map((ch) => ch.id),
      };
    }

    return {
      channels: filteredRowChannels,
      zones,
      allChannels: channels,
    };
  }, [activeZone, channels, filteredRowChannels, library, pivot.pivot, zones]);

  return { config, skippedCount };
}
