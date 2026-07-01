import { Stack, Text } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { applyFilters, DEFAULT_MAP_FILTER_OPTS } from '@core/domain/mapProjection.ts';
import CodeplugMap from '../../../components/CodeplugMap/CodeplugMap.tsx';
import LibraryEntityList from '../../../components/library/LibraryEntityList.tsx';
import { ListPage } from '../../../components/ui/index.ts';
import { useLibraryDelete } from '../../../hooks/useLibraryDelete.ts';
import { useLibrary } from '../../../state/useLibrary.ts';

export default function ZonesListPage() {
  const { library, loading } = useLibrary();
  const navigate = useNavigate();
  const handleDelete = useLibraryDelete();
  const { skipped: mapSkipped } = applyFilters(library.channels, DEFAULT_MAP_FILTER_OPTS);

  if (loading) {
    return (
      <ListPage title="Zones">
        <Text>Loading library…</Text>
      </ListPage>
    );
  }

  return (
    <ListPage title="Zones">
      <Stack gap="lg">
        <CodeplugMap
          channels={library.channels}
          zones={library.zones}
          allChannels={library.channels}
          height={420}
          onChannelClick={(id) => navigate(`/library/channels/${id}`)}
          onZoneClick={(id) => navigate(`/library/zones/${id}`)}
        />
        {mapSkipped.length > 0 ? (
          <Text size="sm" c="dimmed">
            {mapSkipped.length} channel{mapSkipped.length === 1 ? '' : 's'} not shown on map
            (missing coordinates, Use Location = No, or 0,0).
          </Text>
        ) : null}

        <LibraryEntityList
          library={library}
          kind="zone"
          slug="zones"
          plural="Zones"
          label="Zone"
          onDelete={handleDelete}
        />
      </Stack>
    </ListPage>
  );
}
