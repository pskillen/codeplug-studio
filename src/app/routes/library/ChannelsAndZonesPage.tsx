import { Button, Box, Group, Stack, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { newZone } from '@core/domain/factories.ts';
import CodeplugMap from '../../components/CodeplugMap/CodeplugMap.tsx';
import ZonePivotPanel, { pivotLabel } from '../../components/library/ZonePivotPanel.tsx';
import LibraryChannelTable from '../../components/library/LibraryChannelTable.tsx';
import AddChannelsToZoneModal from '../../components/library/AddChannelsToZoneModal.tsx';
import ZoneInlineSettings from '../../components/library/ZoneInlineSettings.tsx';
import UseMyLocationButton from '../../components/UseMyLocationButton/UseMyLocationButton.tsx';
import { ListPage } from '../../components/ui/index.ts';
import { useChannelListQuery } from '../../hooks/useChannelListQuery.ts';
import { useZonePivotChannelRows } from '../../hooks/useZonePivotChannelRows.ts';
import { useZonePivotMap } from '../../hooks/useZonePivotMap.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useOperatorPosition } from '../../state/operatorPosition.tsx';
import { DEFAULT_ZONE_PIVOT, parseZonePivotSearch, zonePivotPath } from './zonePivotQuery.ts';

export default function ChannelsAndZonesPage() {
  const { library, loading, projectId } = useLibrary();
  const { position, setPosition, clearPosition } = useOperatorPosition();
  const location = useLocation();
  const navigate = useNavigate();
  const query = useChannelListQuery();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);

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

  const { config: mapConfig, skippedCount } = useZonePivotMap(library, pivot, activeZone, rows);

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
      {pivot.pivot === 'zone' ? (
        <Button variant="light" size="compact-sm" onClick={() => setAddModalOpen(true)}>
          Add channels…
        </Button>
      ) : null}
      {pivot.pivot === 'orphans' ? (
        <Button variant="light" size="compact-sm" onClick={() => setAddModalOpen(true)}>
          Add to zone…
        </Button>
      ) : null}
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
          {activeZone ? (
            <ZoneInlineSettings
              key={`${activeZone.id}-${activeZone.revision}`}
              zone={activeZone}
              library={library}
            />
          ) : null}
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
          {position ? (
            <Group gap="sm" align="center">
              {position.accuracyMeters != null && Number.isFinite(position.accuracyMeters) ? (
                <Text size="sm" c="dimmed">
                  My location accuracy ±{Math.round(position.accuracyMeters)} m
                </Text>
              ) : null}
              <Button variant="subtle" size="compact-sm" onClick={clearPosition}>
                Clear my location
              </Button>
            </Group>
          ) : (
            <UseMyLocationButton
              label="Show my location"
              onLocation={(lat, lon, accuracyMeters) =>
                setPosition({ lat, lon, accuracyMeters: accuracyMeters ?? null })
              }
            />
          )}
          <CodeplugMap
            channels={mapConfig.channels}
            zones={mapConfig.zones}
            allChannels={mapConfig.allChannels}
            height={360}
            operatorPosition={position}
            mapControlMode={mapConfig.mapControlMode}
            emphasisZoneId={mapConfig.emphasisZoneId}
            fitBoundsChannelIds={mapConfig.fitBoundsChannelIds}
            dimmedChannelIds={mapConfig.dimmedChannelIds}
            onChannelClick={(id) => navigate(`/library/channels/${id}`)}
            onZoneClick={(id) => navigate(zonePivotPath({ pivot: 'zone', zoneId: id }))}
          />
          {skippedCount > 0 ? (
            <Text size="sm" c="dimmed">
              {skippedCount} channel{skippedCount === 1 ? '' : 's'} not shown on map (missing
              coordinates, Use Location = No, or 0,0).
            </Text>
          ) : null}
        </Stack>
      </Group>
      <AddChannelsToZoneModal
        opened={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        library={library}
        targetZone={pivot.pivot === 'zone' ? activeZone : null}
      />
    </ListPage>
  );
}
