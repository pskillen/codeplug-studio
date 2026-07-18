import { ActionIcon, Badge, Checkbox, Group, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Channel, Zone, ZoneMemberEntry } from '@core/models/library.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import {
  resolveEffectiveZoneChannelIds,
  zoneIdsExcludedFromMembership,
} from '@core/domain/zoneHierarchy.ts';
import {
  reorderZoneMembers,
  setChannelMemberIncludeInScanList,
} from '@core/domain/zoneMembership.ts';
import type { IncludeInZoneDerivedScanListOverride } from '@core/models/zoneBehaviourDefaults.ts';
import IncludeInZoneDerivedScanListSegment from '../zones/IncludeInZoneDerivedScanListSegment.tsx';
import { BandPillForChannel } from '../pills/BandPill.tsx';
import ModePill from '../pills/ModePill.tsx';
import AvailableItemPicker from '../ui/AvailableItemPicker.tsx';
import type { SelectedItemDragHandleProps } from '../ui/SelectedItemDragHandle.tsx';
import SelectedItemDragHandle from '../ui/SelectedItemDragHandle.tsx';
import SelectedItemList from '../ui/SelectedItemList.tsx';
import { PageSection } from '../ui/index.ts';
import MembershipSortMenu from './MembershipSortMenu.tsx';
import { sortZoneMembersByMode } from '@core/domain/membershipSort.ts';
import { channelModesForFilter, sortByName } from '../../lib/channels.ts';
import { formatChannelRxTxListCell } from '../../lib/formatFrequency.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
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
  reorderMembersByKeys,
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
    (channelId: string, include: IncludeInZoneDerivedScanListOverride) => {
      onChange(setChannelMemberIncludeInScanList(members, channelId, include));
    },
    [members, onChange],
  );

  return (
    <Stack gap="lg">
      <PageSection>
        <SelectedItemList
          title="In this zone"
          description={`${members.length} direct member${members.length === 1 ? '' : 's'}${
            editingZoneId ? ` · ${effectiveChannelCount} channels effective` : ''
          } — export order`}
          filter={{
            value: inZoneFilter,
            onChange: setInZoneFilter,
            placeholder: 'Filter members…',
            'aria-label': 'Filter in-zone members',
          }}
          itemKeys={filteredInZoneKeys}
          selectedKeys={inZoneSelected}
          onToggleSelect={toggleInZone}
          onRemove={(key) => removeKeys([key])}
          emptyMessage="No members in zone"
          onReorder={(nextKeys) => {
            if (nextKeys.length !== members.length) return;
            onChange(reorderMembersByKeys(members, nextKeys));
          }}
          reorderDisabled={inZoneFilter.trim().length > 0}
          onMoveSelected={moveSelected}
          onRemoveSelected={removeSelected}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          reorderHint={
            <Text size="xs" c="dimmed">
              {inZoneFilter.trim()
                ? 'Clear filter to drag-reorder'
                : 'Drag handles reorder · Alt+↑/↓ moves selection'}
            </Text>
          }
          renderItem={({ itemKey, selected, onToggleSelect, onRemove, dragHandle }) => (
            <InZoneMemberRow
              key={itemKey}
              memberKey={itemKey}
              member={members.find((m) => memberKeyFromEntry(m) === itemKey)}
              channelsById={channelsById}
              zones={zones}
              selected={selected}
              onToggleSelect={onToggleSelect}
              onRemove={onRemove}
              dragHandle={dragHandle}
              onIncludeInScanListChange={handleIncludeInScanList}
            />
          )}
          toolbar={
            <MembershipSortMenu
              disabled={!members.length}
              label="Sort channels…"
              onSort={(mode) =>
                onChange(sortZoneMembersByMode(members, channelsById, zonesById, mode))
              }
            />
          }
        />
      </PageSection>

      <PageSection>
        <AvailableItemPicker
          title="Other channels & zones"
          filter={{
            value: availableFilter,
            onChange: setAvailableFilter,
            placeholder: 'Filter…',
            'aria-label': 'Filter available channels and zones',
          }}
          sections={[
            {
              id: 'channels',
              title: 'Channels',
              itemKeys: availableChannels.map((ch) => ch.id),
              selectedKeys: availableChannelSelected,
              onToggleSelect: (id) =>
                setAvailableChannelSelected((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                ),
              emptyMessage: 'No channels available',
              renderItem: ({ itemKey, checked, onToggle }) => {
                const channel = channelsById.get(itemKey);
                if (!channel) return null;
                return (
                  <AvailableChannelRow
                    key={itemKey}
                    channel={channel}
                    checked={checked}
                    onToggle={onToggle}
                  />
                );
              },
            },
            {
              id: 'zones',
              title: 'Zones',
              itemKeys: availableZones.map((zone) => zone.id),
              selectedKeys: availableZoneSelected,
              onToggleSelect: (id) =>
                setAvailableZoneSelected((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                ),
              emptyMessage: 'No zones available',
              renderItem: ({ itemKey, checked, onToggle }) => {
                const zone = zonesById.get(itemKey);
                if (!zone) return null;
                return (
                  <Checkbox
                    key={itemKey}
                    label={`Zone: ${zone.name}`}
                    checked={checked}
                    onChange={onToggle}
                  />
                );
              },
            },
          ]}
          onAddSelected={addSelected}
          addDisabled={!availableChannelSelected.length && !availableZoneSelected.length}
          footer={
            <>
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
            </>
          }
        />
      </PageSection>
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
  dragHandle,
  onIncludeInScanListChange,
}: {
  memberKey: ZonePickerMemberKey;
  member: ZoneMemberEntry | undefined;
  channelsById: Map<string, Channel>;
  zones: Zone[];
  selected: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  dragHandle: SelectedItemDragHandleProps | null;
  onIncludeInScanListChange: (
    channelId: string,
    include: IncludeInZoneDerivedScanListOverride,
  ) => void;
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
            <Checkbox
              checked={selected}
              onChange={onToggleSelect}
              aria-label={`Select ${zone.name}`}
            />
            <SelectedItemDragHandle dragHandle={dragHandle} />
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
            <Tooltip label="Remove from zone">
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                onClick={onRemove}
                aria-label={`Remove ${zone.name} from zone`}
              >
                <IconTrash size={ICON_SIZE_NAV} stroke={ICON_STROKE} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Paper>
    );
  }

  const channel = channelsById.get(entry.channelId);
  if (!channel) return null;
  const memberOverride = entry.includeInScanList ?? 'default';

  return (
    <Paper withBorder p="xs" radius="sm">
      <Group gap="sm" wrap="nowrap" justify="space-between" align="flex-start">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Checkbox
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${channelDisplayLabel(channel)}`}
          />
          <SelectedItemDragHandle dragHandle={dragHandle} />
          <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
            <Group gap="xs" wrap="wrap">
              <Text size="sm" fw={500}>
                {channelDisplayLabel(channel)}
              </Text>
              <BandPillForChannel channel={channel} size="xs" />
              {channelModesForFilter(channel).map((mode) => (
                <ModePill key={mode} mode={mode} size="xs" />
              ))}
              {channel.scanInclusion === 'skip' ? (
                <Badge size="xs" variant="light" color="gray">
                  Skip scan
                </Badge>
              ) : null}
              {channel.scanInclusion === 'alwaysScan' ? (
                <Badge size="xs" variant="light" color="teal">
                  Always scan
                </Badge>
              ) : null}
            </Group>
            <Text size="xs" c="dimmed">
              {formatChannelRxTxListCell(channel.rxFrequency, channel.txFrequency) || '—'}
            </Text>
          </Stack>
        </Group>
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <Tooltip label="Include this channel in zone-derived scan lists at export">
            <div>
              <IncludeInZoneDerivedScanListSegment
                value={memberOverride}
                onChange={(next) => onIncludeInScanListChange(channel.id, next)}
                compact
                label="Include in scan list"
              />
            </div>
          </Tooltip>
          <Group gap="xs" wrap="nowrap" align="center" mt={4}>
            <Text component={Link} to={`/library/channels/${channel.id}`} size="xs">
              Open
            </Text>
            <Tooltip label="Remove from zone">
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                onClick={onRemove}
                aria-label={`Remove ${channelDisplayLabel(channel)} from zone`}
              >
                <IconTrash size={ICON_SIZE_NAV} stroke={ICON_STROKE} />
              </ActionIcon>
            </Tooltip>
          </Group>
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
      {channelModesForFilter(channel)
        .slice(0, 2)
        .map((mode) => (
          <ModePill key={mode} mode={mode} size="xs" />
        ))}
    </Group>
  );
}
