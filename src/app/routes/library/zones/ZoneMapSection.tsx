import { Text } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import CodeplugMap from '../../../components/CodeplugMap/CodeplugMap.tsx';
import { MapPanel } from '../../../components/v2/index.ts';
import { useZoneEdit } from './ZoneEditContext.tsx';
import { useZoneEditMap } from './useZoneEditMap.ts';

export default function ZoneMapSection({ height = 360 }: { height?: number }) {
  const navigate = useNavigate();
  const { library, previewZone, mapFilters } = useZoneEdit();
  const { channelsForMap, zonesForMap, fitBoundsChannelIds, dimmedChannelIds, mapSkipped } =
    useZoneEditMap(library, previewZone, mapFilters);

  return (
    <MapPanel
      title="Map"
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
