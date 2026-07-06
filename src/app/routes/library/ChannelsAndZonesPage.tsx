import { Button, Box, Group, Stack, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { newZone } from '@core/domain/factories.ts';
import ZonePivotPanel, { pivotLabel } from '../../components/library/ZonePivotPanel.tsx';
import LibraryChannelTable from '../../components/library/LibraryChannelTable.tsx';
import { ListPage } from '../../components/ui/index.ts';
import { useChannelListQuery } from '../../hooks/useChannelListQuery.ts';
import { useZonePivotChannelRows } from '../../hooks/useZonePivotChannelRows.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useOperatorPosition } from '../../state/operatorPosition.tsx';
import { DEFAULT_ZONE_PIVOT, parseZonePivotSearch, zonePivotPath } from './zonePivotQuery.ts';

export default function ChannelsAndZonesPage() {
  const { library, loading, projectId } = useLibrary();
  const { position } = useOperatorPosition();
  const location = useLocation();
  const navigate = useNavigate();
  const query = useChannelListQuery();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const pivot = useMemo(() => parseZonePivotSearch(location.search), [location.search]);

  const { zones } = library;

  const activeZone = useMemo(() => {
    if (pivot.pivot !== 'zone' || !pivot.zoneId) return null;
    return zones.find((zone) => zone.id === pivot.zoneId) ?? null;
  }, [pivot, zones]);

  const { rows, totalCount, preserveMemberOrder } = useZonePivotChannelRows(
    library,
    pivot,
    activeZone,
    query,
    position,
  );

  const handleCreateZoneFromSelected = useCallback(() => {
    if (!projectId || selectedKeys.length === 0) return;
    const orderedIds = rows.filter((ch) => selectedKeys.includes(ch.id)).map((ch) => ch.id);
    if (orderedIds.length === 0) return;
    setSelectedKeys([]);
    navigate('/library/zones/new', { state: { initialChannelIds: orderedIds } });
  }, [navigate, projectId, rows, selectedKeys]);

  const handleCreateEmptyZone = useCallback(async () => {
    if (!projectId) return;
    const zone = newZone(projectId, 'New zone');
    const result = await persistence.putZone(zone, null);
    if (result.ok) {
      navigate(zonePivotPath({ pivot: 'zone', zoneId: zone.id }));
    }
  }, [navigate, projectId]);

  if (!loading && pivot.pivot === 'zone' && pivot.zoneId && !activeZone) {
    return <Navigate to={zonePivotPath(DEFAULT_ZONE_PIVOT)} replace />;
  }

  const title = pivotLabel(pivot.pivot, zones, pivot.zoneId);

  const toolbar = (
    <Group gap="xs">
      <Button
        component={Link}
        to="/library/channels/new"
        leftSection={<IconPlus size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        size="compact-sm"
      >
        New channel
      </Button>
      <Button
        variant="light"
        size="compact-sm"
        disabled={selectedKeys.length === 0}
        onClick={handleCreateZoneFromSelected}
      >
        New zone from selected
      </Button>
      {pivot.pivot !== 'zone' ? (
        <Button variant="light" size="compact-sm" onClick={() => void handleCreateEmptyZone()}>
          New zone
        </Button>
      ) : null}
    </Group>
  );

  if (loading) {
    return (
      <ListPage title="Channels & zones">
        <Text>Loading library…</Text>
      </ListPage>
    );
  }

  return (
    <ListPage title="Channels & zones" description={title}>
      <Group align="flex-start" gap="lg" wrap="nowrap">
        <Box visibleFrom="md" w={240} style={{ flexShrink: 0 }}>
          <ZonePivotPanel zones={zones} pivot={pivot} variant="sidebar" />
        </Box>
        <Stack gap="lg" style={{ flex: 1, minWidth: 0 }}>
          <Box hiddenFrom="md">
            <ZonePivotPanel zones={zones} pivot={pivot} variant="inline" />
          </Box>
          <LibraryChannelTable
            library={library}
            rows={rows}
            totalRowCount={totalCount}
            preserveMemberOrder={preserveMemberOrder}
            activeZone={activeZone}
            selectedKeys={selectedKeys}
            onSelectedKeysChange={setSelectedKeys}
            toolbar={toolbar}
          />
        </Stack>
      </Group>
    </ListPage>
  );
}
