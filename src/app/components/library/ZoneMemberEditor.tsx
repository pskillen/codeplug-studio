import { Badge, Checkbox, Group, Stack, Text } from '@mantine/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Channel, Zone, ZoneMemberEntry } from '@core/models/library.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import {
  resolveEffectiveZoneChannelIds,
  zoneMembershipExclusionReasons,
  type ZoneMembershipExclusionReason,
} from '@core/domain/zoneHierarchy.ts';
import {
  reorderZoneMembers,
  setChannelMemberIncludeInScanList,
} from '@core/domain/zoneMembership.ts';
import type { IncludeInZoneDerivedScanListOverride } from '@core/models/zoneBehaviourDefaults.ts';
import IncludeInZoneDerivedScanListSegment from '../zones/IncludeInZoneDerivedScanListSegment.tsx';
import { BandPillForChannel } from '../pills/BandPill.tsx';
import ModePill from '../pills/ModePill.tsx';
import type { SelectedItemDragHandleProps } from '../ui/SelectedItemDragHandle.tsx';
import {
  ShuttleAddBar,
  ShuttleListPanel,
  ShuttlePoolHeader,
  ShuttlePoolPanel,
  ShuttleRow,
} from '../v2/index.ts';
import MembershipSortMenu from './MembershipSortMenu.tsx';
import { sortZoneMembersByMode } from '@core/domain/membershipSort.ts';
import { channelModesForFilter, sortByName } from '../../lib/channels.ts';
import { formatChannelRxTxListCell } from '../../lib/formatFrequency.ts';
import {
  channelMatchesZoneMemberFilter,
  computeZoneMemberPickerMapFilters,
  zoneMembershipExclusionLabel,
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

export type ZoneMemberEditorMode = 'full' | 'reorder' | 'addPool' | 'scanOnly' | 'summary';

export type { ZoneMemberPickerMapFilters } from './zoneMemberPickerUtils.ts';
export {
  channelMatchesZoneMemberFilter,
  computeZoneMemberPickerMapFilters,
  zoneMembershipExclusionLabel,
} from './zoneMemberPickerUtils.ts';

export interface ZoneMemberEditorProps {
  channels: Channel[];
  zones: Zone[];
  editingZoneId: string | null;
  members: ZoneMemberEntry[];
  onChange: (members: ZoneMemberEntry[]) => void;
  onMapFiltersChange?: (filters: ZoneMemberEditorMapFilters) => void;
  /** Controls which membership UI blocks render. Default `full` (create flow). */
  mode?: ZoneMemberEditorMode;
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
  mode = 'full',
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

  const exclusionReasons = useMemo(
    () =>
      editingZoneId
        ? zoneMembershipExclusionReasons(editingZoneId, zones, members)
        : new Map<string, ZoneMembershipExclusionReason>(),
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

  /** Non-member zones shown in the add pool (includes blocked/greyed cycle-closers). */
  const availableZones = useMemo(
    () =>
      [...zones]
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter(
          (zone) =>
            !memberKeySet.has(`zone:${zone.id}`) &&
            (!availableFilterLower || zoneMatchesFilter(zone, availableFilterLower)),
        ),
    [zones, memberKeySet, availableFilterLower],
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

  const selectableZoneSelected = useMemo(
    () => availableZoneSelected.filter((id) => !exclusionReasons.has(id)),
    [availableZoneSelected, exclusionReasons],
  );

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
      ...selectableZoneSelected.map((id) => `zone:${id}` as const),
    ].filter((key) => !memberKeySet.has(key));
    if (!toAdd.length) return;
    setMembersFromKeys([...memberKeys, ...toAdd]);
    setAvailableChannelSelected([]);
    setAvailableZoneSelected([]);
  }, [
    availableChannelSelected,
    selectableZoneSelected,
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

  const showReorder = mode === 'full' || mode === 'reorder';
  const showScanControls = mode === 'full' || mode === 'scanOnly';
  const showRemove = mode === 'full' || mode === 'reorder';
  const showAddPool = mode === 'full' || mode === 'addPool';
  const inZoneReadOnly = mode === 'addPool' || mode === 'scanOnly' || mode === 'summary';

  return (
    <Stack gap="lg">
      <ShuttleListPanel
        title="In this zone"
        description={`${members.length} direct member${members.length === 1 ? '' : 's'}${
          editingZoneId ? ` · ${effectiveChannelCount} channels effective` : ''
        }${showReorder ? ' — export order' : ''}`}
        filter={{
          value: inZoneFilter,
          onChange: setInZoneFilter,
          placeholder: 'Filter members…',
          'aria-label': 'Filter in-zone members',
        }}
        itemKeys={filteredInZoneKeys}
        selectedKeys={inZoneReadOnly ? [] : inZoneSelected}
        onToggleSelect={inZoneReadOnly ? () => {} : toggleInZone}
        onRemove={showRemove ? (key) => removeKeys([key]) : () => {}}
        emptyMessage="No members in zone"
        onReorder={
          showReorder
            ? (nextKeys) => {
                if (nextKeys.length !== members.length) return;
                onChange(reorderMembersByKeys(members, nextKeys));
              }
            : undefined
        }
        reorderDisabled={inZoneFilter.trim().length > 0 || !showReorder}
        onMoveSelected={showReorder ? moveSelected : undefined}
        onRemoveSelected={showRemove ? removeSelected : undefined}
        canMoveUp={showReorder ? canMoveUp : false}
        canMoveDown={showReorder ? canMoveDown : false}
        reorderHint={
          showReorder ? (
            <Text size="xs" c="dimmed">
              {inZoneFilter.trim()
                ? 'Clear filter to drag-reorder'
                : 'Drag handles reorder · Alt+↑/↓ moves selection'}
            </Text>
          ) : null
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
            dragHandle={showReorder ? dragHandle : null}
            onIncludeInScanListChange={handleIncludeInScanList}
            showScanControls={showScanControls}
            showRemove={showRemove}
            showSelect={!inZoneReadOnly}
          />
        )}
        toolbar={
          showReorder ? (
            <MembershipSortMenu
              disabled={!members.length}
              label="Sort channels…"
              onSort={(sortMode) =>
                onChange(sortZoneMembersByMode(members, channelsById, zonesById, sortMode))
              }
            />
          ) : undefined
        }
      />

      {showAddPool ? (
        <ShuttlePoolPanel
          header={<ShuttlePoolHeader label="Other channels & zones" />}
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
              selectedKeys: selectableZoneSelected,
              onToggleSelect: (id) => {
                if (exclusionReasons.has(id)) return;
                setAvailableZoneSelected((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                );
              },
              emptyMessage: 'No zones available',
              renderItem: ({ itemKey, checked, onToggle }) => {
                const zone = zonesById.get(itemKey);
                if (!zone) return null;
                const reason = exclusionReasons.get(zone.id);
                return (
                  <AvailableZoneRow
                    key={itemKey}
                    zone={zone}
                    checked={checked}
                    onToggle={onToggle}
                    blockedReason={reason}
                  />
                );
              },
            },
          ]}
          footer={
            <>
              <ShuttleAddBar
                onAdd={addSelected}
                disabled={!availableChannelSelected.length && !selectableZoneSelected.length}
                selectedCount={
                  availableChannelSelected.length + selectableZoneSelected.length
                }
              />
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
      ) : null}
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
  showScanControls = true,
  showRemove = true,
  showSelect = true,
}: {
  memberKey: ZonePickerMemberKey;
  member: ZoneMemberEntry | undefined;
  channelsById: Map<string, Channel>;
  zones: Zone[];
  selected: boolean;
  onToggleSelect?: () => void;
  onRemove?: () => void;
  dragHandle: SelectedItemDragHandleProps | null;
  onIncludeInScanListChange: (
    channelId: string,
    include: IncludeInZoneDerivedScanListOverride,
  ) => void;
  showScanControls?: boolean;
  showRemove?: boolean;
  showSelect?: boolean;
}) {
  const entry = member ? member : entryFromMemberKey(memberKey);

  if (entry.kind === 'zone') {
    const zone = zones.find((z) => z.id === entry.zoneId);
    if (!zone) return null;
    const effectiveCount = resolveEffectiveZoneChannelIds(zone, zones).length;
    return (
      <ShuttleRow
        label={`Zone: ${zone.name}`}
        subtitle={`${effectiveCount} channel${effectiveCount === 1 ? '' : 's'} effective`}
        selected={selected}
        onToggleSelect={onToggleSelect ?? (() => {})}
        onRemove={onRemove ?? (() => {})}
        dragHandle={dragHandle}
        selectable={showSelect}
        removable={showRemove}
        trailing={
          <Text component={Link} to={`/library/zones/${zone.id}`} size="xs">
            Open zone
          </Text>
        }
      />
    );
  }

  const channel = channelsById.get(entry.channelId);
  if (!channel) return null;
  const memberOverride = entry.includeInScanList ?? 'default';

  return (
    <ShuttleRow
      label={
        <Group gap="xs" wrap="wrap">
          <span>{channelDisplayLabel(channel)}</span>
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
      }
      subtitle={formatChannelRxTxListCell(channel.rxFrequency, channel.txFrequency) || '—'}
      selected={selected}
      onToggleSelect={onToggleSelect ?? (() => {})}
      onRemove={onRemove ?? (() => {})}
      dragHandle={dragHandle}
      selectable={showSelect}
      removable={showRemove}
      trailing={
        <Group gap="sm" wrap="nowrap" align="flex-start">
          {showScanControls ? (
            <IncludeInZoneDerivedScanListSegment
              value={memberOverride}
              onChange={(next) => onIncludeInScanListChange(channel.id, next)}
              compact
              label="Include in scan list"
            />
          ) : null}
          <Text component={Link} to={`/library/channels/${channel.id}`} size="xs">
            Open
          </Text>
        </Group>
      }
    />
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

function AvailableZoneRow({
  zone,
  checked,
  onToggle,
  blockedReason,
}: {
  zone: Zone;
  checked: boolean;
  onToggle: () => void;
  blockedReason?: ZoneMembershipExclusionReason;
}) {
  const blocked = blockedReason != null;
  return (
    <Group gap="sm" wrap="nowrap" opacity={blocked ? 0.55 : 1}>
      <Checkbox
        checked={checked}
        disabled={blocked}
        onChange={onToggle}
        aria-label={
          blocked
            ? `Zone ${zone.name} unavailable: ${zoneMembershipExclusionLabel(blockedReason)}`
            : `Select zone ${zone.name}`
        }
      />
      <Text size="sm" style={{ flex: 1, minWidth: 0 }} truncate c={blocked ? 'dimmed' : undefined}>
        Zone: {zone.name}
      </Text>
      {blocked ? (
        <Badge size="xs" variant="light" color="gray">
          {zoneMembershipExclusionLabel(blockedReason)}
        </Badge>
      ) : null}
    </Group>
  );
}
