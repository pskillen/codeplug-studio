import { useCallback, useMemo, useState } from 'react';
import type { Channel, Zone, ZoneMemberEntry } from '@core/models/library.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import {
  resolveEffectiveZoneChannelIds,
  zoneMembershipExclusionReasons,
  type ZoneMembershipExclusionReason,
} from '@core/domain/zoneHierarchy.ts';
import ModePill from '../pills/ModePill.tsx';
import { MembershipPoolRow } from '../v2/index.ts';
import { channelModesForFilter, sortByName } from '../../lib/channels.ts';
import { formatChannelRxTxListCell } from '../../lib/formatFrequency.ts';
import {
  channelMatchesZoneMemberFilter,
  zoneMembershipExclusionLabel,
} from './zoneMemberPickerUtils.ts';
import {
  memberKeyFromEntry,
  memberKeysFromMembers,
  membersFromMemberKeys,
  type ZonePickerMemberKey,
} from './zoneMembers.ts';

export const ZONE_ADD_SECTIONS = [
  { id: 'channels', label: 'Channels' },
  { id: 'zones', label: 'Zones' },
] as const;

export type ZoneAddSectionId = (typeof ZONE_ADD_SECTIONS)[number]['id'];

function zoneMatchesFilter(zone: Zone, filterLower: string): boolean {
  if (!filterLower) return true;
  return zone.name.toLowerCase().includes(filterLower);
}

export function useZoneMemberAddPool({
  channels,
  zones,
  editingZoneId,
  members,
  onChange,
}: {
  channels: Channel[];
  zones: Zone[];
  editingZoneId: string | null;
  members: ZoneMemberEntry[];
  onChange: (members: ZoneMemberEntry[]) => void;
}) {
  const [availableChannelSelected, setAvailableChannelSelected] = useState<string[]>([]);
  const [availableZoneSelected, setAvailableZoneSelected] = useState<string[]>([]);

  const memberKeys = useMemo(() => memberKeysFromMembers(members), [members]);
  const memberKeySet = useMemo(() => new Set(memberKeys), [memberKeys]);

  const exclusionReasons = useMemo(
    () =>
      editingZoneId
        ? zoneMembershipExclusionReasons(editingZoneId, zones, members)
        : new Map<string, ZoneMembershipExclusionReason>(),
    [editingZoneId, zones, members],
  );

  const selectableZoneSelected = useMemo(
    () => availableZoneSelected.filter((id) => !exclusionReasons.has(id)),
    [availableZoneSelected, exclusionReasons],
  );

  const stagedCount = availableChannelSelected.length + selectableZoneSelected.length;

  const setMembersFromKeys = useCallback(
    (keys: ZonePickerMemberKey[]) => {
      onChange(membersFromMemberKeys(keys));
    },
    [onChange],
  );

  const addSelected = useCallback(() => {
    const toAdd: ZonePickerMemberKey[] = [
      ...availableChannelSelected.map((id) => `channel:${id}` as const),
      ...selectableZoneSelected.map((id) => `zone:${id}` as const),
    ].filter((key) => !memberKeySet.has(key));
    if (!toAdd.length) return false;
    setMembersFromKeys([...memberKeys, ...toAdd]);
    setAvailableChannelSelected([]);
    setAvailableZoneSelected([]);
    return true;
  }, [
    availableChannelSelected,
    selectableZoneSelected,
    memberKeySet,
    memberKeys,
    setMembersFromKeys,
  ]);

  const toggleChannel = useCallback((id: string) => {
    setAvailableChannelSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const toggleZone = useCallback(
    (id: string) => {
      if (exclusionReasons.has(id)) return;
      setAvailableZoneSelected((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
    },
    [exclusionReasons],
  );

  const clearStaged = useCallback(() => {
    setAvailableChannelSelected([]);
    setAvailableZoneSelected([]);
  }, []);

  const filterCandidates = useCallback(
    (filterLower: string) => {
      const availableChannels = sortByName(channels).filter(
        (ch) =>
          !memberKeySet.has(`channel:${ch.id}`) &&
          (!filterLower || channelMatchesZoneMemberFilter(ch, filterLower)),
      );
      const availableZones = [...zones]
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter(
          (zone) =>
            !memberKeySet.has(`zone:${zone.id}`) &&
            (!filterLower || zoneMatchesFilter(zone, filterLower)),
        );
      return { availableChannels, availableZones };
    },
    [channels, zones, memberKeySet],
  );

  return {
    availableChannelSelected,
    availableZoneSelected,
    selectableZoneSelected,
    stagedCount,
    exclusionReasons,
    addSelected,
    toggleChannel,
    toggleZone,
    clearStaged,
    filterCandidates,
    zones,
  };
}

export interface ZoneMemberAddPoolProps {
  pool: ReturnType<typeof useZoneMemberAddPool>;
  channels: Channel[];
  activeSectionId?: ZoneAddSectionId;
  filter?: string;
  variant?: 'overlay' | 'inline';
}

export default function ZoneMemberAddPool({
  pool,
  channels,
  activeSectionId = 'channels',
  filter = '',
  variant = 'overlay',
}: ZoneMemberAddPoolProps) {
  const filterLower = filter.trim().toLowerCase();
  const { availableChannels, availableZones } = pool.filterCandidates(filterLower);

  const renderChannelRow = (channel: Channel) => (
    <MembershipPoolRow
      key={channel.id}
      checked={pool.availableChannelSelected.includes(channel.id)}
      onCheck={() => pool.toggleChannel(channel.id)}
      label={channelDisplayLabel(channel)}
      subtitle={formatChannelRxTxListCell(channel.rxFrequency, channel.txFrequency) || undefined}
      pills={channelModesForFilter(channel)
        .slice(0, 2)
        .map((mode) => (
          <ModePill key={mode} mode={mode} size="xs" />
        ))}
    />
  );

  const renderZoneRow = (zone: Zone) => {
    const reason = pool.exclusionReasons.get(zone.id);
    const blocked = reason != null;
    const effectiveCount = resolveEffectiveZoneChannelIds(zone, pool.zones).length;
    return (
      <MembershipPoolRow
        key={zone.id}
        checked={!blocked && pool.availableZoneSelected.includes(zone.id)}
        onCheck={blocked ? undefined : () => pool.toggleZone(zone.id)}
        disabled={blocked}
        label={zone.name}
        subtitle={
          blocked ? undefined : `${effectiveCount} effective channel${effectiveCount === 1 ? '' : 's'}`
        }
        reason={blocked ? zoneMembershipExclusionLabel(reason) : undefined}
      />
    );
  };

  if (variant === 'inline') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 8,
              color: 'var(--dsv2-text-tertiary)',
            }}
          >
            Channels
          </div>
          {availableChannels.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--dsv2-text-tertiary)', margin: 0 }}>
              No channels available
            </p>
          ) : (
            availableChannels.map(renderChannelRow)
          )}
        </div>
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 8,
              color: 'var(--dsv2-text-tertiary)',
            }}
          >
            Zones
          </div>
          {availableZones.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--dsv2-text-tertiary)', margin: 0 }}>
              No zones available
            </p>
          ) : (
            availableZones.map(renderZoneRow)
          )}
        </div>
      </div>
    );
  }

  if (activeSectionId === 'zones') {
    return availableZones.length === 0 ? (
      <p style={{ fontSize: 13, color: 'var(--dsv2-text-tertiary)', margin: 0 }}>No zones available</p>
    ) : (
      availableZones.map(renderZoneRow)
    );
  }

  return availableChannels.length === 0 ? (
    <p style={{ fontSize: 13, color: 'var(--dsv2-text-tertiary)', margin: 0 }}>No channels available</p>
  ) : (
    availableChannels.map((channel) => renderChannelRow(channel))
  );
}

export { zoneMembershipExclusionLabel };
