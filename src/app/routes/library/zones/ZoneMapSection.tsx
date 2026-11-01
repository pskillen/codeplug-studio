import { Text } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import CodeplugMap from '../../../components/CodeplugMap/CodeplugMap.tsx';
import { MapPanel } from '../../../components/v2/index.ts';
import { useZoneEdit } from './ZoneEditContext.tsx';
import { useZoneEditMap } from './useZoneEditMap.ts';

/** Viewport-relative: the map takes the screen below the chrome, never a fixed pixel box (#1498). */
export const ZONE_MAP_HEIGHT = 'clamp(280px, calc(100dvh - 240px), 720px)';

export default function ZoneMapSection({
  height = ZONE_MAP_HEIGHT,
  title = 'Map',
}: {
  height?: number | string;
  title?: string;
}) {
  const navigate = useNavigate();
  const { library, previewZone, mapFilters } = useZoneEdit();
  const { channelsForMap, zonesForMap, fitBoundsChannelIds, dimmedChannelIds, mapSkipped } =
    useZoneEditMap(library, previewZone, mapFilters);

  return (
    <MapPanel
      title={title}
      height={height}
      legend={
        mapSkipped.length > 0 ? (
          <Text size="sm" c="dimmed">
            {mapSkipped.length} channel{mapSkipped.length === 1 ? '' : 's'} not shown on map
            (missing coordinates, Use Location = No, or 0,0).
          </Text>
        ) : undefined
      }
    >
      <CodeplugMap
        channels={channelsForMap}
        zones={zonesForMap}
        allChannels={library.channels}
        height="100%"
        mapControlMode="zoneEmphasis"
        emphasisZoneId={previewZone.id}
        fitBoundsChannelIds={fitBoundsChannelIds}
        dimmedChannelIds={dimmedChannelIds}
        onChannelClick={(id) => navigate(`/library/channels/${id}`)}
      />
    </MapPanel>
  );
}
