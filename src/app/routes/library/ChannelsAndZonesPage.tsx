import { Grid, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { channelsNotInAnyZone } from '@core/domain/zoneMembership.ts';
import { directZoneMemberChannelIds } from '@core/domain/zoneMembers.ts';
import ZonePivotPanel, { pivotLabel } from '../../components/library/ZonePivotPanel.tsx';
import { ListPage } from '../../components/ui/index.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { DEFAULT_ZONE_PIVOT, parseZonePivotSearch, zonePivotPath } from './zonePivotQuery.ts';

export default function ChannelsAndZonesPage() {
  const { library, loading } = useLibrary();
  const location = useLocation();

  const pivot = useMemo(() => parseZonePivotSearch(location.search), [location.search]);
  const { channels, zones } = library;

  const activeZone = useMemo(() => {
    if (pivot.pivot !== 'zone' || !pivot.zoneId) return null;
    return zones.find((zone) => zone.id === pivot.zoneId) ?? null;
  }, [pivot, zones]);

  const rowCount = useMemo(() => {
    if (pivot.pivot === 'all') return channels.length;
    if (pivot.pivot === 'orphans') return channelsNotInAnyZone(library).length;
    if (!activeZone) return 0;
    return directZoneMemberChannelIds(activeZone).length;
  }, [activeZone, channels.length, library, pivot.pivot]);

  if (!loading && pivot.pivot === 'zone' && pivot.zoneId && !activeZone) {
    return <Navigate to={zonePivotPath(DEFAULT_ZONE_PIVOT)} replace />;
  }

  const title = pivotLabel(pivot.pivot, zones, pivot.zoneId);

  if (loading) {
    return (
      <ListPage title="Channels & zones">
        <Text>Loading library…</Text>
      </ListPage>
    );
  }

  return (
    <ListPage title="Channels & zones" description={title}>
      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 3 }} visibleFrom="md">
          <ZonePivotPanel zones={zones} pivot={pivot} variant="sidebar" />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 9 }}>
          <Stack gap="lg">
            <ZonePivotPanel zones={zones} pivot={pivot} variant="inline" hiddenFrom="md" />
            <Text c="dimmed" size="sm">
              {rowCount} channel{rowCount === 1 ? '' : 's'} in this view
            </Text>
          </Stack>
        </Grid.Col>
      </Grid>
    </ListPage>
  );
}
