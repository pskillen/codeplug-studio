import { useMemo } from 'react';
import type { Channel, Library, Zone } from '@core/models/library.ts';
import { channelsNotInAnyZone } from '@core/domain/zoneMembership.ts';
import { directZoneMemberChannelIds } from '@core/domain/zoneMembers.ts';
import { useFilteredChannels } from './useChannelListFilters.ts';
import type { ChannelListQuery } from './useChannelListQuery.ts';
import type { OperatorPosition } from '../state/operatorPosition.tsx';
import type { ZonePivotState } from '../routes/library/zonePivotQuery.ts';

export function useZonePivotChannelRows(
  library: Library,
  pivot: ZonePivotState,
  activeZone: Zone | null,
  query: ChannelListQuery,
  position: OperatorPosition | null,
): { rows: Channel[]; totalCount: number; preserveMemberOrder: boolean } {
  const baseRows = useMemo(() => {
    if (pivot.pivot === 'all') return library.channels;
    if (pivot.pivot === 'orphans') return channelsNotInAnyZone(library);
    if (!activeZone) return [];
    const byId = new Map(library.channels.map((channel) => [channel.id, channel]));
    return directZoneMemberChannelIds(activeZone)
      .map((id) => byId.get(id))
      .filter((channel): channel is Channel => channel != null);
  }, [activeZone, library, pivot.pivot]);

  const filtered = useFilteredChannels(baseRows, query, position, {
    skipSort: pivot.pivot === 'zone',
  });

  return {
    rows: filtered,
    totalCount: baseRows.length,
    preserveMemberOrder: pivot.pivot === 'zone',
  };
}
