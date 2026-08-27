import { useMemo, useState } from 'react';
import { Select, Stack, Text } from '@mantine/core';
import type { Zone } from '@core/models/library.ts';
import { sortByName } from '../../lib/channels.ts';
import { modalComboboxProps } from '../../theme.ts';
import { Pill } from '../v2/index.ts';
import classes from './BulkZonePickerColumn.module.css';

export interface BulkZonePickerColumnProps {
  title: string;
  description?: string;
  searchPlaceholder?: string;
  zones: readonly Zone[];
  selectedIds: readonly string[];
  onSelectedIdsChange: (ids: string[]) => void;
  /** Zone ids that cannot be added (already in the other column). */
  blockedIds?: readonly string[];
  emptyMessage?: string;
}

export default function BulkZonePickerColumn({
  title,
  description,
  searchPlaceholder = 'Search zones',
  zones,
  selectedIds,
  onSelectedIdsChange,
  blockedIds = [],
  emptyMessage = 'No zones in this project yet.',
}: BulkZonePickerColumnProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const blocked = useMemo(() => new Set(blockedIds), [blockedIds]);
  const byId = useMemo(() => new Map(zones.map((zone) => [zone.id, zone])), [zones]);

  const selectedZones = selectedIds
    .map((id) => byId.get(id))
    .filter((zone): zone is Zone => zone != null);

  const available = useMemo(
    () =>
      sortByName(zones.filter((zone) => !selected.has(zone.id) && !blocked.has(zone.id))).map(
        (zone) => ({ value: zone.id, label: zone.name }),
      ),
    [blocked, selected, zones],
  );

  const addZone = (zoneId: string | null) => {
    if (!zoneId || selected.has(zoneId) || blocked.has(zoneId)) {
      setPendingId(null);
      return;
    }
    onSelectedIdsChange([...selectedIds, zoneId]);
    setPendingId(null);
  };

  const removeZone = (zoneId: string) => {
    onSelectedIdsChange(selectedIds.filter((id) => id !== zoneId));
  };

  return (
    <Stack gap="sm" className={classes.root}>
      <div>
        <Text size="sm" fw={600}>
          {title}
        </Text>
        {description ? (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        ) : null}
      </div>
      {zones.length === 0 ? (
        <Text size="sm" c="dimmed">
          {emptyMessage}
        </Text>
      ) : (
        <Select
          placeholder={searchPlaceholder}
          data={available}
          value={pendingId}
          onChange={addZone}
          searchable
          clearable
          nothingFoundMessage="No matching zones"
          comboboxProps={modalComboboxProps()}
          disabled={available.length === 0}
        />
      )}
      {selectedZones.length > 0 ? (
        <div className={classes.box}>
          {selectedZones.map((zone) => (
            <Pill key={zone.id} tone="neutral" onRemove={() => removeZone(zone.id)}>
              {zone.name}
            </Pill>
          ))}
        </div>
      ) : (
        <Text size="xs" c="dimmed">
          Empty — search above to add a zone.
        </Text>
      )}
    </Stack>
  );
}
