import { useMemo } from 'react';
import type { Library, Zone } from '@core/models/library.ts';
import {
  applyFilters,
  channelHasGeolocation,
  DEFAULT_MAP_FILTER_OPTS,
} from '@core/domain/mapProjection.ts';
import { resolveEffectiveZoneChannelIds } from '@core/domain/zoneHierarchy.ts';
import type { ZoneMemberEditorMapFilters } from '../../../components/library/ZoneMemberEditor.tsx';

export function useZoneEditMap(
  library: Library,
  previewZone: Zone,
  mapFilters: ZoneMemberEditorMapFilters,
) {
  const hiddenMarkerIds = useMemo(
    () => new Set(mapFilters.hiddenMarkerChannelIds),
    [mapFilters.hiddenMarkerChannelIds],
  );

  const channelsForMap = useMemo(
    () => library.channels.filter((ch) => !hiddenMarkerIds.has(ch.id)),
    [library.channels, hiddenMarkerIds],
  );

  const zonesForMap = useMemo(() => {
    const others = library.zones.filter((z) => z.id !== previewZone.id);
    return [...others, previewZone];
  }, [library.zones, previewZone]);

  const fitBoundsChannelIds = useMemo(
    () => resolveEffectiveZoneChannelIds(previewZone, zonesForMap),
    [previewZone, zonesForMap],
  );

  const dimmedChannelIds = useMemo(() => {
    const memberIds = new Set(fitBoundsChannelIds);
    return channelsForMap
      .filter((ch) => channelHasGeolocation(ch) && !memberIds.has(ch.id))
      .map((ch) => ch.id);
  }, [channelsForMap, fitBoundsChannelIds]);

  const mapSkipped = useMemo(
    () => applyFilters(library.channels, DEFAULT_MAP_FILTER_OPTS).skipped,
    [library.channels],
  );

  return {
    channelsForMap,
    zonesForMap,
    fitBoundsChannelIds,
    dimmedChannelIds,
    mapSkipped,
  };
}
