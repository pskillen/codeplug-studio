import { Button, NavLink, Select, Stack, Text } from '@mantine/core';
import { IconMapPin, IconPlus } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';
import type { Zone } from '@core/models/library.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import type { ZonePivotKind, ZonePivotState } from '../../routes/library/zonePivotQuery.ts';
import { zonePivotPath } from '../../routes/library/zonePivotQuery.ts';
import { buildZonePivotTreeRows } from './zonePivotTree.ts';

export interface ZonePivotPanelProps {
  zones: Zone[];
  pivot: ZonePivotState;
  variant: 'sidebar' | 'inline';
}

function pivotLabel(pivot: ZonePivotKind, zones: Zone[], zoneId: string | null): string {
  if (pivot === 'all') return 'All channels';
  if (pivot === 'orphans') return 'Not in a zone';
  const zone = zones.find((z) => z.id === zoneId);
  return zone?.name ?? 'Zone';
}

export default function ZonePivotPanel({ zones, pivot, variant }: ZonePivotPanelProps) {
  const navigate = useNavigate();
  const treeRows = buildZonePivotTreeRows(zones);
  const isSidebar = variant === 'sidebar';

  const selectData = [
    { value: 'all', label: 'All channels' },
    { value: 'orphans', label: 'Not in a zone' },
    ...treeRows.map(({ zone, depth }) => ({
      value: `zone:${zone.id}`,
      label: `${'  '.repeat(depth)}${zone.name}`,
    })),
  ];

  const selectValue = pivot.pivot === 'zone' && pivot.zoneId ? `zone:${pivot.zoneId}` : pivot.pivot;

  const handleSelectChange = (value: string | null) => {
    if (!value || value === 'all') {
      navigate(zonePivotPath({ pivot: 'all', zoneId: null }));
      return;
    }
    if (value === 'orphans') {
      navigate(zonePivotPath({ pivot: 'orphans', zoneId: null }));
      return;
    }
    if (value.startsWith('zone:')) {
      navigate(zonePivotPath({ pivot: 'zone', zoneId: value.slice('zone:'.length) }));
    }
  };

  if (variant === 'inline') {
    return (
      <Stack gap="sm">
        <Select
          label="View"
          data={selectData}
          value={selectValue}
          onChange={handleSelectChange}
          searchable
        />
        <Button
          component={Link}
          to="/library/zones/new-from-location"
          variant="light"
          leftSection={<IconMapPin size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
          fullWidth
        >
          New zone from location
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="xs">
      <Text size="xs" tt="uppercase" c="dimmed" fw={600}>
        View
      </Text>
      <NavLink
        label="All channels"
        active={pivot.pivot === 'all'}
        onClick={() => navigate(zonePivotPath({ pivot: 'all', zoneId: null }))}
      />
      <NavLink
        label="Not in a zone"
        active={pivot.pivot === 'orphans'}
        onClick={() => navigate(zonePivotPath({ pivot: 'orphans', zoneId: null }))}
      />

      <Text size="xs" tt="uppercase" c="dimmed" fw={600} mt="sm">
        Zones
      </Text>
      {treeRows.length === 0 ? (
        <Text size="sm" c="dimmed">
          No zones yet.
        </Text>
      ) : (
        treeRows.map(({ zone, depth }) => (
          <NavLink
            key={zone.id}
            label={zone.name}
            pl={8 + depth * 12}
            active={pivot.pivot === 'zone' && pivot.zoneId === zone.id}
            onClick={() => navigate(zonePivotPath({ pivot: 'zone', zoneId: zone.id }))}
          />
        ))
      )}

      <Button
        leftSection={<IconPlus size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        fullWidth={isSidebar}
        mt="sm"
        onClick={() => navigate('/library/zones/new')}
      >
        New zone
      </Button>
      <Button
        component={Link}
        to="/library/zones/new-from-location"
        variant="light"
        leftSection={<IconMapPin size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        fullWidth={isSidebar}
      >
        New zone from location
      </Button>
    </Stack>
  );
}

export { pivotLabel };
