import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconGripVertical, IconX } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Channel, Zone, ZoneMemberEntry } from '@core/models/library.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import { resolveEffectiveZoneChannelIds, zoneIdsExcludedFromMembership } from '@core/domain/zoneHierarchy.ts';
import {
  reorderZoneMembers,
  setChannelMemberIncludeInScanList,
} from '@core/domain/zoneMembership.ts';
import { memberIncludedInScanList } from '@core/domain/zoneMembers.ts';
import { BandPillForChannel } from '../pills/BandPill.tsx';
import ModePill from '../pills/ModePill.tsx';
import { channelModesForFilter, sortByName } from '../../lib/channels.ts';
import { formatChannelRxTxListCell } from '../../lib/formatFrequency.ts';
import { ICON_STROKE } from '../../lib/iconSizes.ts';
import {
  channelMatchesZoneMemberFilter,
  computeZoneMemberPickerMapFilters,
  type ZoneMemberPickerMapFilters,
} from './zoneMemberPickerUtils.ts';
import {
  entryFromMemberKey,
  memberKeyFromEntry,
  memberKeysFromMembers,
  membersFromMemberKeys,
  type ZonePickerMemberKey,
} from './zoneMembers.ts';

export type ZoneMemberEditorMapFilters = ZoneMemberPickerMapFilters;

export type { ZoneMemberPickerMapFilters } from './zoneMemberPickerUtils.ts';
export {
  channelMatchesZoneMemberFilter,
  computeZoneMemberPickerMapFilters,
} from './zoneMemberPickerUtils.ts';

export interface ZoneMemberEditorProps {
  channels: Channel[];
  zones: Zone[];
  editingZoneId: string | null;
  members: ZoneMemberEntry[];
  onChange: (members: ZoneMemberEntry[]) => void;
  onMapFiltersChange?: (filters: ZoneMemberEditorMapFilters) => void;
}

function zoneMatchesFilter(zone: Zone, filterLower: string): boolean {
  if (!filterLower) return true;
  return zone.name.toLowerCase().includes(filterLower);
}

export default function ZoneMemberEditor({
  channels,
  zones,
  editingZoneId,
  members,
  onChange,
  onMapFiltersChange,
}: ZoneMemberEditorProps) {
  const [inZoneFilter, setInZoneFilter] = useState('');
  const [availableFilter, setAvailableFilter] = useState('');
  const [hideAvailableFilteredFromMap, setHideAvailableFilteredFromMap] = useState(true);
  const [hideInZoneFilteredFromMap, setHideInZoneFilteredFromMap] = useState(true);
  const [inZoneSelected, setInZoneSelected] = useState<ZonePickerMemberKey[]>([]);
  const [availableChannelSelected, setAvailableChannelSelected] = useState<string[]>([]);
  const [availableZoneSelected, setAvailableZoneSelected] = useState<string[]>([]);

  const memberKeys = useMemo(() => memberKeysFromMembers(members), [members]);
  const memberKeySet = useMemo(() => new Set(memberKeys), [memberKeys]);
  const inZoneFilterLower = inZoneFilter.trim().toLowerCase();
  const availableFilterLower = availableFilter.trim().toLowerCase();

  const channelsById = useMemo(() => new Map(channels.map((ch) => [ch.id, ch])), [channels]);
  const zonesById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);

  const previewZone = useMemo((): Zone | null => {
    if (!editingZoneId) return null;
    const existing = zonesById.get(editingZoneId);
    return existing ? { ...existing, members } : null;
  }, [editingZoneId, members, zonesById]);

  const effectiveChannelCount = useMemo(() => {
    if (!previewZone) return 0;
    return resolveEffectiveZoneChannelIds(previewZone, zones).length;
  }, [previewZone, zones]);

  const selectedChannelIds = useMemo(() => {
    const ids: string[] = [];
    for (const raw of members) {
      const key = memberKeyFromEntry(raw);
      if (key.startsWith('channel:')) ids.push(key.slice('channel:'.length));
    }
    return ids;
  }, [members]);

  const excludedZoneIds = useMemo(
    () =>
      editingZoneId
        ? zoneIdsExcludedFromMembership(editingZoneId, zones, members)
        : new Set<string>(),
    [editingZoneId, zones, members],
  );

  const filteredInZoneKeys = useMemo(() => {
    return memberKeys.filter((key) => {
      const entry = entryFromMemberKey(key);
      if (entry.kind === 'channel') {
        const ch = channelsById.get(entry.channelId);
        return ch ? channelMatchesZoneMemberFilter(ch, inZoneFilterLower) : false;
      }
      const zone = zonesById.get(entry.zoneId);
      return zone ? zoneMatchesFilter(zone, inZoneFilterLower) : false;
    });
  }, [memberKeys, channelsById, zonesById, inZoneFilterLower]);

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

  const setMembersFromKeys = useCallback(
    (keys: ZonePickerMemberKey[]) => {
      onChange(membersFromMemberKeys(keys));
    },
    [onChange],
  );

  const toggleInZone = useCallback((key: ZonePickerMemberKey) => {
    setInZoneSelected((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  }, []);

  const addSelected = useCallback(() => {
    const toAdd: ZonePickerMemberKey[] = [
      ...availableChannelSelected.map((id) => `channel:${id}` as const),
      ...availableZoneSelected.map((id) => `zone:${id}` as const),
    ].filter((key) => !memberKeySet.has(key));
    if (!toAdd.length) return;
    setMembersFromKeys([...memberKeys, ...toAdd]);
    setAvailableChannelSelected([]);
    setAvailableZoneSelected([]);
  }, [
    availableChannelSelected,
    availableZoneSelected,
    memberKeySet,
    memberKeys,
    setMembersFromKeys,
  ]);

  const removeKeys = useCallback(
    (keys: ZonePickerMemberKey[]) => {
      if (!keys.length) return;
      const remove = new Set(keys);
      setMembersFromKeys(memberKeys.filter((key) => !remove.has(key)));
      setInZoneSelected((prev) => prev.filter((key) => !remove.has(key)));
    },
    [memberKeys, setMembersFromKeys],
  );

  const removeSelected = useCallback(() => {
    removeKeys(inZoneSelected);
  }, [inZoneSelected, removeKeys]);

  const moveSelected = useCallback(
    (direction: 'up' | 'down') => {
      if (!inZoneSelected.length) return;
      onChange(reorderZoneMembers(members, new Set(inZoneSelected), direction));
    },
    [inZoneSelected, members, onChange],
  );

  const canMoveUp = inZoneSelected.some((key) => memberKeys.indexOf(key) > 0);
  const canMoveDown = inZoneSelected.some((key) => {
    const index = memberKeys.indexOf(key);
    return index >= 0 && index < memberKeys.length - 1;
  });

  const handleIncludeInScanList = useCallback(
    (channelId: string, include: boolean) => {
      onChange(setChannelMemberIncludeInScanList(members, channelId, include));
    },
    [members, onChange],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable]')) return;
      event.preventDefault();
      moveSelected(event.key === 'ArrowUp' ? 'up' : 'down');
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moveSelected]);

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Stack gap={4}>
            <Text size="sm" fw={600}>
              In this zone
            </Text>
            <Text size="sm" c="dimmed">
              {members.length} direct member{members.length === 1 ? '' : 's'}
              {editingZoneId ? ` · ${effectiveChannelCount} channels effective` : ''} — export order
            </Text>
          </Stack>
          <TextInput
            placeholder="Filter members…"
            value={inZoneFilter}
            onChange={(e) => setInZoneFilter(e.currentTarget.value)}
            size="xs"
            maw={240}
            aria-label="Filter in-zone members"
          />
        </Group>

        <ScrollArea.Autosize mah={360} type="auto" offsetScrollbars>
          <Stack gap={6}>
            {filteredInZoneKeys.length === 0 ? (
              <Text size="sm" c="dimmed" p="xs">
                No members in zone
              </Text>
            ) : (
              filteredInZoneKeys.map((key) => (
                <InZoneMemberRow
                  key={key}
                  memberKey={key}
                  member={members.find((m) => memberKeyFromEntry(m) === key)}
                  channelsById={channelsById}
                  zones={zones}
                  selected={inZoneSelected.includes(key)}
                  onToggleSelect={() => toggleInZone(key)}
                  onRemove={() => removeKeys([key])}
                  onIncludeInScanListChange={handleIncludeInScanList}
                />
              ))
            )}
          </Stack>
        </ScrollArea.Autosize>

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
          <Button
            type="button"
            variant="light"
            size="compact-sm"
            onClick={removeSelected}
            disabled={!inZoneSelected.length}
          >
            Remove selected
          </Button>
          <Text size="xs" c="dimmed">
            Alt+↑ / Alt+↓ reorders selection
          </Text>
        </Group>
      </Stack>

      <Stack gap="xs">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Text size="sm" fw={600}>
            Other channels &amp; zones
          </Text>
          <TextInput
            placeholder="Filter…"
            value={availableFilter}
            onChange={(e) => setAvailableFilter(e.currentTarget.value)}
            size="xs"
            maw={240}
            aria-label="Filter available channels and zones"
          />
        </Group>

        <ScrollArea.Autosize mah={280} type="auto" offsetScrollbars>
          <Stack gap="md">
            <Stack gap={4}>
              <Text size="xs" fw={500} c="dimmed" tt="uppercase">
                Channels
              </Text>
              {availableChannels.length === 0 ? (
                <Text size="sm" c="dimmed" p="xs">
                  No channels available
                </Text>
              ) : (
                availableChannels.map((ch) => (
                  <AvailableChannelRow
                    key={ch.id}
                    channel={ch}
                    checked={availableChannelSelected.includes(ch.id)}
                    onToggle={() =>
                      setAvailableChannelSelected((prev) =>
                        prev.includes(ch.id) ? prev.filter((x) => x !== ch.id) : [...prev, ch.id],
                      )
                    }
                  />
                ))
              )}
            </Stack>

            <Stack gap={4}>
              <Text size="xs" fw={500} c="dimmed" tt="uppercase">
                Zones
              </Text>
              {availableZones.length === 0 ? (
                <Text size="sm" c="dimmed" p="xs">
                  No zones available
                </Text>
              ) : (
                availableZones.map((zone) => (
                  <Checkbox
                    key={zone.id}
                    label={`Zone: ${zone.name}`}
                    checked={availableZoneSelected.includes(zone.id)}
                    onChange={() =>
                      setAvailableZoneSelected((prev) =>
                        prev.includes(zone.id)
                          ? prev.filter((x) => x !== zone.id)
                          : [...prev, zone.id],
                      )
                    }
                  />
                ))
              )}
            </Stack>
          </Stack>
        </ScrollArea.Autosize>

        <Group gap="sm">
          <Button
            type="button"
            variant="light"
            onClick={addSelected}
            disabled={!availableChannelSelected.length && !availableZoneSelected.length}
          >
            Add selected
          </Button>
          <Checkbox
            label="Hide filtered entries from map"
            checked={hideAvailableFilteredFromMap}
            disabled={!availableFilterLower}
            onChange={(e) => setHideAvailableFilteredFromMap(e.currentTarget.checked)}
          />
          <Checkbox
            label="Hide filtered in-zone members from map"
            checked={hideInZoneFilteredFromMap}
            disabled={!inZoneFilterLower}
            onChange={(e) => setHideInZoneFilteredFromMap(e.currentTarget.checked)}
          />
        </Group>
      </Stack>
    </Stack>
  );
}

function InZoneMemberRow({
  memberKey,
  member,
  channelsById,
  zones,
  selected,
  onToggleSelect,
  onRemove,
  onIncludeInScanListChange,
}: {
  memberKey: ZonePickerMemberKey;
  member: ZoneMemberEntry | undefined;
  channelsById: Map<string, Channel>;
  zones: Zone[];
  selected: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  onIncludeInScanListChange: (channelId: string, include: boolean) => void;
}) {
  const entry = member ? member : entryFromMemberKey(memberKey);

  if (entry.kind === 'zone') {
    const zone = zones.find((z) => z.id === entry.zoneId);
    if (!zone) return null;
    const effectiveCount = resolveEffectiveZoneChannelIds(zone, zones).length;
    return (
      <Paper withBorder p="xs" radius="sm">
        <Group gap="sm" wrap="nowrap" justify="space-between">
          <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <Checkbox checked={selected} onChange={onToggleSelect} aria-label={`Select ${zone.name}`} />
            <IconGripVertical size={14} stroke={ICON_STROKE} style={{ opacity: 0.35, flexShrink: 0 }} />
            <Stack gap={0} style={{ minWidth: 0 }}>
              <Text size="sm" fw={500} truncate>
                Zone: {zone.name}
              </Text>
              <Text size="xs" c="dimmed">
                {effectiveCount} channel{effectiveCount === 1 ? '' : 's'} effective
              </Text>
            </Stack>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Text component={Link} to={`/library/zones/${zone.id}`} size="xs">
              Open zone
            </Text>
            <ActionIcon variant="subtle" color="red" size="sm" onClick={onRemove} aria-label="Remove">
              <IconX size={14} stroke={ICON_STROKE} />
            </ActionIcon>
          </Group>
        </Group>
      </Paper>
    );
  }

  const channel = channelsById.get(entry.channelId);
  if (!channel) return null;
  const includeInScan = memberIncludedInScanList(entry);

  return (
    <Paper withBorder p="xs" radius="sm">
      <Group gap="sm" wrap="nowrap" justify="space-between" align="flex-start">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Checkbox
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${channelDisplayLabel(channel)}`}
          />
          <IconGripVertical size={14} stroke={ICON_STROKE} style={{ opacity: 0.35, flexShrink: 0 }} />
          <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
            <Group gap="xs" wrap="wrap">
              <Text size="sm" fw={500}>
                {channelDisplayLabel(channel)}
              </Text>
              <BandPillForChannel channel={channel} size="xs" />
              {channelModesForFilter(channel).map((mode) => (
                <ModePill key={mode} mode={mode} size="xs" />
              ))}
              {channel.scanSkip ? (
                <Badge size="xs" variant="light" color="gray">
                  Skip scan
                </Badge>
              ) : null}
            </Group>
            <Text size="xs" c="dimmed">
              {formatChannelRxTxListCell(channel.rxFrequency, channel.txFrequency) || '—'}
            </Text>
          </Stack>
        </Group>
        <Group gap="xs" wrap="nowrap" align="center">
          <Tooltip label="Include this channel in zone-derived scan lists at export">
            <Checkbox
              label="Scan list"
              size="xs"
              checked={includeInScan}
              onChange={(e) => onIncludeInScanListChange(channel.id, e.currentTarget.checked)}
            />
          </Tooltip>
          <Text component={Link} to={`/library/channels/${channel.id}`} size="xs">
            Open
          </Text>
          <ActionIcon variant="subtle" color="red" size="sm" onClick={onRemove} aria-label="Remove">
            <IconX size={14} stroke={ICON_STROKE} />
          </ActionIcon>
        </Group>
      </Group>
    </Paper>
  );
}

function AvailableChannelRow({
  channel,
  checked,
  onToggle,
}: {
  channel: Channel;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Group gap="sm" wrap="nowrap">
      <Checkbox
        checked={checked}
        onChange={onToggle}
        aria-label={`Select ${channelDisplayLabel(channel)}`}
      />
      <Text size="sm" style={{ flex: 1, minWidth: 0 }} truncate>
        {channelDisplayLabel(channel)}
      </Text>
      <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
        {formatChannelRxTxListCell(channel.rxFrequency, channel.txFrequency) || '—'}
      </Text>
      {channelModesForFilter(channel).slice(0, 2).map((mode) => (
        <ModePill key={mode} mode={mode} size="xs" />
      ))}
    </Group>
  );
}
