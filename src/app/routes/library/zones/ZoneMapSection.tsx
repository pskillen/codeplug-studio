import { Stack, Text } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import CodeplugMap from '../../../components/CodeplugMap/CodeplugMap.tsx';
import { PageSection } from '../../../components/ui/index.ts';
import { useZoneEdit } from './ZoneEditContext.tsx';
import { useZoneEditMap } from './useZoneEditMap.ts';

export default function ZoneMapSection({ height = 360 }: { height?: number }) {
  const navigate = useNavigate();
  const { library, previewZone, mapFilters } = useZoneEdit();
  const { channelsForMap, zonesForMap, fitBoundsChannelIds, dimmedChannelIds, mapSkipped } =
    useZoneEditMap(library, previewZone, mapFilters);

  return (
    <PageSection title="Map">
      <Stack gap="xs">
        <CodeplugMap
          channels={channelsForMap}
          zones={zonesForMap}
          allChannels={library.channels}
          height={height}
          mapControlMode="zoneEmphasis"
          emphasisZoneId={previewZone.id}
          fitBoundsChannelIds={fitBoundsChannelIds}
          dimmedChannelIds={dimmedChannelIds}
          onChannelClick={(id) => navigate(`/library/channels/${id}`)}
        />
        {mapSkipped.length > 0 ? (
          <Text size="sm" c="dimmed">
            {mapSkipped.length} channel{mapSkipped.length === 1 ? '' : 's'} not shown on map
            (missing coordinates, Use Location = No, or 0,0).
          </Text>
        ) : null}
      </Stack>
    </PageSection>
  );
}
