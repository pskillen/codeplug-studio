import {
  Button,
  Checkbox,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import type { Channel } from '@core/models/library.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { sortByName } from '../../lib/channels.ts';

export interface ZoneMemberPickerProps {
  channels: Channel[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

function moveSelectedBlock(
  ids: string[],
  selected: Set<string>,
  direction: 'up' | 'down',
): string[] {
  const next = [...ids];
  const indices = next
    .map((id, index) => ({ id, index }))
    .filter(({ id }) => selected.has(id))
    .map(({ index }) => index);

  if (direction === 'up') {
    for (const index of indices.sort((a, b) => a - b)) {
      if (index === 0) continue;
      const above = index - 1;
      if (selected.has(next[above])) continue;
      [next[above], next[index]] = [next[index], next[above]];
    }
  } else {
    for (const index of indices.sort((a, b) => b - a)) {
      if (index >= next.length - 1) continue;
      const below = index + 1;
      if (selected.has(next[below])) continue;
      [next[below], next[index]] = [next[index], next[below]];
    }
  }

  return next;
}

function ChannelList({
  items,
  checked,
  onToggle,
  emptyLabel,
}: {
  items: Channel[];
  checked: Set<string>;
  onToggle: (id: string) => void;
  emptyLabel: string;
}) {
  if (!items.length) {
    return (
      <Text size="sm" c="dimmed" p="xs">
        {emptyLabel}
      </Text>
    );
  }

  return (
    <Stack gap={4} p="xs">
      {items.map((ch) => (
        <Checkbox
          key={ch.id}
          label={ch.name}
          checked={checked.has(ch.id)}
          onChange={() => onToggle(ch.id)}
        />
      ))}
    </Stack>
  );
}

export default function ZoneMemberPicker({
  channels,
  selectedIds,
  onChange,
}: ZoneMemberPickerProps) {
  const [availableFilter, setAvailableFilter] = useState('');
  const [inZoneFilter, setInZoneFilter] = useState('');
  const [availableSelected, setAvailableSelected] = useState<string[]>([]);
  const [inZoneSelected, setInZoneSelected] = useState<string[]>([]);

  const selectedSet = new Set(selectedIds);
  const availableFilterLower = availableFilter.trim().toLowerCase();
  const inZoneFilterLower = inZoneFilter.trim().toLowerCase();

  const availableChannels = useMemo(
    () =>
      sortByName(channels).filter(
        (ch) =>
          !selectedSet.has(ch.id) &&
          (!availableFilterLower || ch.name.toLowerCase().includes(availableFilterLower)),
      ),
    [channels, selectedIds, availableFilterLower],
  );

  const inZoneChannels = useMemo(
    () =>
      selectedIds
        .map((id) => channels.find((ch) => ch.id === id))
        .filter((ch): ch is Channel => ch != null)
        .filter((ch) => !inZoneFilterLower || ch.name.toLowerCase().includes(inZoneFilterLower)),
    [channels, selectedIds, inZoneFilterLower],
  );

  const toggleAvailable = (id: string) => {
    setAvailableSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleInZone = (id: string) => {
    setInZoneSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const addSelected = () => {
    const toAdd = availableSelected.filter((id) => !selectedSet.has(id));
    if (!toAdd.length) return;
    onChange([...selectedIds, ...toAdd]);
    setAvailableSelected([]);
  };

  const removeSelected = () => {
    if (!inZoneSelected.length) return;
    const remove = new Set(inZoneSelected);
    onChange(selectedIds.filter((id) => !remove.has(id)));
    setInZoneSelected([]);
  };

  const moveSelected = (direction: 'up' | 'down') => {
    if (!inZoneSelected.length) return;
    onChange(moveSelectedBlock(selectedIds, new Set(inZoneSelected), direction));
  };

  const canMoveUp = inZoneSelected.some((id) => selectedIds.indexOf(id) > 0);
  const canMoveDown = inZoneSelected.some((id) => {
    const index = selectedIds.indexOf(id);
    return index >= 0 && index < selectedIds.length - 1;
  });

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        {selectedIds.length} member{selectedIds.length === 1 ? '' : 's'}
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Stack gap="xs">
          <TextInput
            label="Filter available"
            placeholder="Search by name…"
            value={availableFilter}
            onChange={(e) => setAvailableFilter(e.currentTarget.value)}
          />
          <Text size="sm" fw={500}>
            Available
          </Text>
          <ScrollArea
            h={240}
            type="auto"
            offsetScrollbars
            style={{
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 'var(--mantine-radius-sm)',
            }}
          >
            <ChannelList
              items={availableChannels}
              checked={new Set(availableSelected)}
              onToggle={toggleAvailable}
              emptyLabel="No channels available"
            />
          </ScrollArea>
        </Stack>

        <Stack gap="xs" justify="center">
          <Button
            type="button"
            variant="light"
            onClick={addSelected}
            disabled={!availableSelected.length}
            rightSection={<IconArrowRight size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
          >
            Add
          </Button>
          <Button
            type="button"
            variant="light"
            onClick={removeSelected}
            disabled={!inZoneSelected.length}
            leftSection={<IconArrowLeft size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
          >
            Remove
          </Button>
        </Stack>

        <Stack gap="xs">
          <TextInput
            label="Filter in zone"
            placeholder="Search by name…"
            value={inZoneFilter}
            onChange={(e) => setInZoneFilter(e.currentTarget.value)}
          />
          <Text size="sm" fw={500}>
            In zone (export order)
          </Text>
          <ScrollArea
            h={240}
            type="auto"
            offsetScrollbars
            style={{
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 'var(--mantine-radius-sm)',
            }}
          >
            <ChannelList
              items={inZoneChannels}
              checked={new Set(inZoneSelected)}
              onToggle={toggleInZone}
              emptyLabel="No channels in zone"
            />
          </ScrollArea>
          <Group gap="xs">
            <Button
              type="button"
              variant="default"
              size="compact-sm"
              onClick={() => moveSelected('up')}
              disabled={!canMoveUp}
            >
              Move up
            </Button>
            <Button
              type="button"
              variant="default"
              size="compact-sm"
              onClick={() => moveSelected('down')}
              disabled={!canMoveDown}
            >
              Move down
            </Button>
          </Group>
        </Stack>
      </SimpleGrid>
    </Stack>
  );
}

/** Map ordered picker ids to zone member refs. */
export function zoneMembersFromSelectedIds(selectedIds: string[]): { kind: 'channel'; id: string }[] {
  return selectedIds.map((id) => ({ kind: 'channel' as const, id }));
}
