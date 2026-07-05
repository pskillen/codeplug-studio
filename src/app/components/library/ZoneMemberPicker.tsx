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
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Channel, Zone, ZoneMemberEntry } from '@core/models/library.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import { zoneIdsExcludedFromMembership } from '@core/domain/zoneHierarchy.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { sortByName } from '../../lib/channels.ts';
import {
  channelMatchesZoneMemberFilter,
  computeZoneMemberPickerMapFilters,
  type ZoneMemberPickerMapFilters,
} from './zoneMemberPickerUtils.ts';
import {
  entryFromMemberKey,
  memberKeysFromMembers,
  membersFromMemberKeys,
  type ZonePickerMemberKey,
} from './zoneMembers.ts';

export type { ZoneMemberPickerMapFilters } from './zoneMemberPickerUtils.ts';
export {
  channelMatchesZoneMemberFilter,
  computeZoneMemberPickerMapFilters,
} from './zoneMemberPickerUtils.ts';

export interface ZoneMemberPickerProps {
  channels: Channel[];
  zones: Zone[];
  editingZoneId: string | null;
  members: ZoneMemberEntry[];
  onChange: (members: ZoneMemberEntry[]) => void;
  onMapFiltersChange?: (filters: ZoneMemberPickerMapFilters) => void;
}

function moveSelectedBlock(
  keys: ZonePickerMemberKey[],
  selected: Set<ZonePickerMemberKey>,
  direction: 'up' | 'down',
): ZonePickerMemberKey[] {
  const next = [...keys];
  const indices = next
    .map((key, index) => ({ key, index }))
    .filter(({ key }) => selected.has(key))
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

function zoneMatchesFilter(zone: Zone, filterLower: string): boolean {
  if (!filterLower) return true;
  return zone.name.toLowerCase().includes(filterLower);
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
          label={channelDisplayLabel(ch)}
          checked={checked.has(ch.id)}
          onChange={() => onToggle(ch.id)}
        />
      ))}
    </Stack>
  );
}

function ZoneList({
  items,
  checked,
  onToggle,
  emptyLabel,
}: {
  items: Zone[];
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
      {items.map((zone) => (
        <Checkbox
          key={zone.id}
          label={
            <Group gap={4} wrap="nowrap">
              <Text size="sm">Zone: {zone.name}</Text>
              <Text component={Link} to={`/library/zones/${zone.id}`} size="xs" c="dimmed">
                edit
              </Text>
            </Group>
          }
          checked={checked.has(zone.id)}
          onChange={() => onToggle(zone.id)}
        />
      ))}
    </Stack>
  );
}

function InZoneMemberList({
  memberKeys,
  channels,
  zones,
  checked,
  onToggle,
  filterLower,
  emptyLabel,
}: {
  memberKeys: ZonePickerMemberKey[];
  channels: Channel[];
  zones: Zone[];
  checked: Set<ZonePickerMemberKey>;
  onToggle: (key: ZonePickerMemberKey) => void;
  filterLower: string;
  emptyLabel: string;
}) {
  const rows = memberKeys
    .map((key) => {
      const entry = entryFromMemberKey(key);
      if (entry.kind === 'channel') {
        const ch = channels.find((row) => row.id === entry.channelId);
        if (!ch) return null;
        if (filterLower && !channelMatchesZoneMemberFilter(ch, filterLower)) return null;
        return { key, label: channelDisplayLabel(ch) };
      }
      const zone = zones.find((row) => row.id === entry.zoneId);
      if (!zone) return null;
      if (filterLower && !zoneMatchesFilter(zone, filterLower)) return null;
      return {
        key,
        label: (
          <Group gap={4} wrap="nowrap">
            <Text size="sm">Zone: {zone.name}</Text>
            <Text component={Link} to={`/library/zones/${zone.id}`} size="xs" c="dimmed">
              edit
            </Text>
          </Group>
        ),
      };
    })
    .filter((row): row is { key: ZonePickerMemberKey; label: ReactNode } => row != null);

  if (!rows.length) {
    return (
      <Text size="sm" c="dimmed" p="xs">
        {emptyLabel}
      </Text>
    );
  }

  return (
    <Stack gap={4} p="xs">
      {rows.map((row) => (
        <Checkbox
          key={row.key}
          label={row.label}
          checked={checked.has(row.key)}
          onChange={() => onToggle(row.key)}
        />
      ))}
    </Stack>
  );
}

export default function ZoneMemberPicker({
  channels,
  zones,
  editingZoneId,
  members,
  onChange,
  onMapFiltersChange,
}: ZoneMemberPickerProps) {
  const [availableFilter, setAvailableFilter] = useState('');
  const [inZoneFilter, setInZoneFilter] = useState('');
  const [hideAvailableFilteredFromMap, setHideAvailableFilteredFromMap] = useState(true);
  const [hideInZoneFilteredFromMap, setHideInZoneFilteredFromMap] = useState(true);
  const [availableChannelSelected, setAvailableChannelSelected] = useState<string[]>([]);
  const [availableZoneSelected, setAvailableZoneSelected] = useState<string[]>([]);
  const [inZoneSelected, setInZoneSelected] = useState<ZonePickerMemberKey[]>([]);

  const memberKeys = useMemo(() => memberKeysFromMembers(members), [members]);
  const memberKeySet = useMemo(() => new Set(memberKeys), [memberKeys]);
  const availableFilterLower = availableFilter.trim().toLowerCase();
  const inZoneFilterLower = inZoneFilter.trim().toLowerCase();
  const selectedChannelIds = useMemo(
    () => zoneMemberIdsFromMembers(members, channels),
    [members, channels],
  );

  const excludedZoneIds = useMemo(
    () => (editingZoneId ? zoneIdsExcludedFromMembership(editingZoneId, zones) : new Set<string>()),
    [editingZoneId, zones],
  );

  const availableChannels = useMemo(
    () =>
      sortByName(channels).filter(
        (ch) =>
          !memberKeySet.has(`channel:${ch.id}`) &&
          (!availableFilterLower || channelMatchesZoneMemberFilter(ch, availableFilterLower)),
      ),
    [channels, memberKeySet, availableFilterLower],
  );

  const availableZones = useMemo(
    () =>
      [...zones]
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter(
          (zone) =>
            !excludedZoneIds.has(zone.id) &&
            !memberKeySet.has(`zone:${zone.id}`) &&
            (!availableFilterLower || zoneMatchesFilter(zone, availableFilterLower)),
        ),
    [zones, excludedZoneIds, memberKeySet, availableFilterLower],
  );

  const mapFilters = useMemo(
    () =>
      computeZoneMemberPickerMapFilters(
        channels,
        selectedChannelIds,
        availableFilter,
        inZoneFilter,
        hideAvailableFilteredFromMap,
        hideInZoneFilteredFromMap,
        members,
        zones,
      ),
    [
      channels,
      selectedChannelIds,
      availableFilter,
      inZoneFilter,
      hideAvailableFilteredFromMap,
      hideInZoneFilteredFromMap,
      members,
      zones,
    ],
  );

  useEffect(() => {
    onMapFiltersChange?.(mapFilters);
  }, [mapFilters, onMapFiltersChange]);

  const setMembersFromKeys = (keys: ZonePickerMemberKey[]) => {
    onChange(membersFromMemberKeys(keys));
  };

  const addSelected = () => {
    const toAdd: ZonePickerMemberKey[] = [
      ...availableChannelSelected.map((id) => `channel:${id}` as const),
      ...availableZoneSelected.map((id) => `zone:${id}` as const),
    ].filter((key) => !memberKeySet.has(key));
    if (!toAdd.length) return;
    setMembersFromKeys([...memberKeys, ...toAdd]);
    setAvailableChannelSelected([]);
    setAvailableZoneSelected([]);
  };

  const removeSelected = () => {
    if (!inZoneSelected.length) return;
    const remove = new Set(inZoneSelected);
    setMembersFromKeys(memberKeys.filter((key) => !remove.has(key)));
    setInZoneSelected([]);
  };

  const moveSelected = (direction: 'up' | 'down') => {
    if (!inZoneSelected.length) return;
    setMembersFromKeys(moveSelectedBlock(memberKeys, new Set(inZoneSelected), direction));
  };

  const canMoveUp = inZoneSelected.some((key) => memberKeys.indexOf(key) > 0);
  const canMoveDown = inZoneSelected.some((key) => {
    const index = memberKeys.indexOf(key);
    return index >= 0 && index < memberKeys.length - 1;
  });

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        {members.length} direct member{members.length === 1 ? '' : 's'}
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Stack gap="xs">
          <TextInput
            label="Filter available"
            placeholder="Search channels or zones…"
            value={availableFilter}
            onChange={(e) => setAvailableFilter(e.currentTarget.value)}
          />
          <Text size="sm" fw={500}>
            Available channels
          </Text>
          <ScrollArea
            h={160}
            type="auto"
            offsetScrollbars
            style={{
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 'var(--mantine-radius-sm)',
            }}
          >
            <ChannelList
              items={availableChannels}
              checked={new Set(availableChannelSelected)}
              onToggle={(id) =>
                setAvailableChannelSelected((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                )
              }
              emptyLabel="No channels available"
            />
          </ScrollArea>
          <Text size="sm" fw={500}>
            Available zones
          </Text>
          <ScrollArea
            h={120}
            type="auto"
            offsetScrollbars
            style={{
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 'var(--mantine-radius-sm)',
            }}
          >
            <ZoneList
              items={availableZones}
              checked={new Set(availableZoneSelected)}
              onToggle={(id) =>
                setAvailableZoneSelected((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                )
              }
              emptyLabel="No zones available"
            />
          </ScrollArea>
          <Checkbox
            label="Hide filtered entries from map"
            checked={hideAvailableFilteredFromMap}
            disabled={!availableFilterLower}
            onChange={(e) => setHideAvailableFilteredFromMap(e.currentTarget.checked)}
          />
        </Stack>

        <Stack gap="xs" justify="center">
          <Button
            type="button"
            variant="light"
            onClick={addSelected}
            disabled={!availableChannelSelected.length && !availableZoneSelected.length}
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
            placeholder="Search members…"
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
            <InZoneMemberList
              memberKeys={memberKeys}
              channels={channels}
              zones={zones}
              checked={new Set(inZoneSelected)}
              onToggle={(key) =>
                setInZoneSelected((prev) =>
                  prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
                )
              }
              filterLower={inZoneFilterLower}
              emptyLabel="No members in zone"
            />
          </ScrollArea>
          <Checkbox
            label="Hide filtered entries from map"
            checked={hideInZoneFilteredFromMap}
            disabled={!inZoneFilterLower}
            onChange={(e) => setHideInZoneFilteredFromMap(e.currentTarget.checked)}
          />
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

function zoneMemberIdsFromMembers(members: ZoneMemberEntry[], channels: Channel[]): string[] {
  const channelIds = new Set(channels.map((ch) => ch.id));
  const ids: string[] = [];
  for (const member of members) {
    const key = memberKeyFromEntry(member);
    if (key.startsWith('channel:')) {
      const id = key.slice('channel:'.length);
      if (channelIds.has(id)) ids.push(id);
    }
  }
  return ids;
}
