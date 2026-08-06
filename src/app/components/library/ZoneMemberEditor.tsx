import { Badge, Stack } from '@mantine/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Channel, Zone, ZoneMemberEntry } from '@core/models/library.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import { resolveEffectiveZoneChannelIds } from '@core/domain/zoneHierarchy.ts';
import {
  reorderZoneMembers,
  setChannelMemberIncludeInScanList,
} from '@core/domain/zoneMembership.ts';
import type { IncludeInZoneDerivedScanListOverride } from '@core/models/zoneBehaviourDefaults.ts';
import { reorderSelectedKeys } from '@core/domain/zoneOrder.ts';
import { sortZoneMembersByMode } from '@core/domain/membershipSort.ts';
import { BandPillForChannel } from '../pills/BandPill.tsx';
import ModePill from '../pills/ModePill.tsx';
import {
  AddMembersScreen,
  Button,
  MembershipPanel,
  MembershipRow,
  Pill,
  SegmentedControl,
} from '../v2/index.ts';
import {
  DataTableBulkReorderProvider,
  DataTableBulkReorderSortable,
} from '../../lib/dataTable/DataTableBulkReorder.tsx';
import MembershipSortMenu from './MembershipSortMenu.tsx';
import SortableMembershipRow, { MembershipRowList } from './SortableMembershipRow.tsx';
import ZoneMemberAddPool, {
  useZoneMemberAddPool,
  ZONE_ADD_SECTIONS,
  type ZoneAddSectionId,
} from './ZoneMemberAddPool.tsx';
import { channelModesForFilter } from '../../lib/channels.ts';
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

export type ZoneMemberEditorMode =
  | 'members'
  | 'scanning'
  | 'summary'
  | 'full'
  | 'pool'
  /** @deprecated Use `members`. */
  | 'reorder'
  /** @deprecated Use `scanning`. */
  | 'scanOnly'
  /** @deprecated Use `pool`. */
  | 'addPool';

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
  mode?: ZoneMemberEditorMode;
  /** When set, member panel shows Add and pool is parent-owned (overlay). */
  onAdd?: () => void;
}

function resolveMode(mode: ZoneMemberEditorMode = 'full'): 'members' | 'scanning' | 'summary' | 'full' | 'pool' {
  switch (mode) {
    case 'reorder':
      return 'members';
    case 'scanOnly':
      return 'scanning';
    case 'addPool':
      return 'pool';
    default:
      return mode;
  }
}

function zoneMatchesFilter(zone: Zone, filterLower: string): boolean {
  if (!filterLower) return true;
  return zone.name.toLowerCase().includes(filterLower);
}

type ScanUiValue = 'auto' | 'force' | 'skip';

function scanUiValue(value: IncludeInZoneDerivedScanListOverride): ScanUiValue {
  if (value === 'skip') return 'skip';
  if (value === 'include') return 'force';
  return 'auto';
}

function scanUiToModel(value: ScanUiValue): IncludeInZoneDerivedScanListOverride {
  if (value === 'skip') return 'skip';
  if (value === 'force') return 'include';
  return 'default';
}

const SCAN_SEGMENT_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'force', label: 'Force' },
  { value: 'skip', label: 'Skip' },
] as const;

export default function ZoneMemberEditor({
  channels,
  zones,
  editingZoneId,
  members,
  onChange,
  onMapFiltersChange,
  mode = 'full',
  onAdd,
}: ZoneMemberEditorProps) {
  const resolvedMode = resolveMode(mode);
  const [inZoneFilter, setInZoneFilter] = useState('');
  const [hideAvailableFilteredFromMap, setHideAvailableFilteredFromMap] = useState(true);
  const [hideInZoneFilteredFromMap, setHideInZoneFilteredFromMap] = useState(true);
  const [inZoneSelected, setInZoneSelected] = useState<ZonePickerMemberKey[]>([]);

  const addPool = useZoneMemberAddPool({ channels, zones, editingZoneId, members, onChange });

  const memberKeys = useMemo(() => memberKeysFromMembers(members), [members]);
  const inZoneFilterLower = inZoneFilter.trim().toLowerCase();
  const filterActive = inZoneFilterLower.length > 0;

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

  const mapFilters = useMemo(
    () =>
      computeZoneMemberPickerMapFilters(
        channels,
        selectedChannelIds,
        '',
        inZoneFilter,
        hideAvailableFilteredFromMap,
        hideInZoneFilteredFromMap,
        members,
        zones,
      ),
    [
      channels,
      selectedChannelIds,
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

  const toggleInZone = useCallback((key: ZonePickerMemberKey) => {
    setInZoneSelected((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  }, []);

  const removeKeys = useCallback(
    (keys: ZonePickerMemberKey[]) => {
      if (!keys.length) return;
      const remove = new Set(keys);
      onChange(membersFromMemberKeys(memberKeys.filter((key) => !remove.has(key))));
      setInZoneSelected((prev) => prev.filter((key) => !remove.has(key)));
    },
    [memberKeys, onChange],
  );

  const moveSelected = useCallback(
    (direction: 'up' | 'down') => {
      if (!inZoneSelected.length || filterActive) return;
      onChange(
        membersFromMemberKeys(
          reorderSelectedKeys(memberKeys, new Set(inZoneSelected), direction) as ZonePickerMemberKey[],
        ),
      );
    },
    [filterActive, inZoneSelected, memberKeys, onChange],
  );

  const handleIncludeInScanList = useCallback(
    (channelId: string, include: IncludeInZoneDerivedScanListOverride) => {
      onChange(setChannelMemberIncludeInScanList(members, channelId, include));
    },
    [members, onChange],
  );

  const channelMembers = useMemo(
    () =>
      members.filter((m): m is Extract<ZoneMemberEntry, { kind: 'channel' }> => m.kind === 'channel'),
    [members],
  );

  const renderMemberRow = (
    memberKey: ZonePickerMemberKey,
    options: {
      showSelect?: boolean;
      showRemove?: boolean;
      showDrag?: boolean;
      showOpenLink?: boolean;
    },
  ) => {
    const entry = members.find((m) => memberKeyFromEntry(m) === memberKey) ?? entryFromMemberKey(memberKey);
    const selected = inZoneSelected.includes(memberKey);

    if (entry.kind === 'zone') {
      const zone = zones.find((z) => z.id === entry.zoneId);
      if (!zone) return null;
      const effectiveCount = resolveEffectiveZoneChannelIds(zone, zones).length;
      return (
        <SortableMembershipRow
          key={memberKey}
          itemKey={memberKey}
          disabled={filterActive || options.showDrag === false}
          dragHandle={options.showDrag !== false}
          label={`Zone: ${zone.name}`}
          pills={<Pill tone="neutral">Nested zone</Pill>}
          subtitle={`${effectiveCount} effective channel${effectiveCount === 1 ? '' : 's'}`}
          checked={options.showSelect ? selected : undefined}
          onCheck={options.showSelect ? () => toggleInZone(memberKey) : undefined}
          onRemove={options.showRemove ? () => removeKeys([memberKey]) : undefined}
          trailing={
            options.showOpenLink ? (
              <Link to={`/library/zones/${zone.id}`} style={{ fontSize: 11.5 }}>
                Open zone
              </Link>
            ) : undefined
          }
        />
      );
    }

    const channel = channelsById.get(entry.channelId);
    if (!channel) return null;

    return (
      <SortableMembershipRow
        key={memberKey}
        itemKey={memberKey}
        disabled={filterActive || options.showDrag === false}
        dragHandle={options.showDrag !== false}
        label={channelDisplayLabel(channel)}
        pills={
          <>
            <BandPillForChannel channel={channel} size="xs" />
            {channelModesForFilter(channel).map((m) => (
              <ModePill key={m} mode={m} size="xs" />
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
          </>
        }
        subtitle={formatChannelRxTxListCell(channel.rxFrequency, channel.txFrequency) || '—'}
        checked={options.showSelect ? selected : undefined}
        onCheck={options.showSelect ? () => toggleInZone(memberKey) : undefined}
        onRemove={options.showRemove ? () => removeKeys([memberKey]) : undefined}
        trailing={
          options.showOpenLink ? (
            <Link to={`/library/channels/${channel.id}`} style={{ fontSize: 11.5 }}>
              Open
            </Link>
          ) : undefined
        }
      />
    );
  };

  if (resolvedMode === 'pool') {
    return (
      <ZoneMemberAddPool
        pool={addPool}
        channels={channels}
        variant="inline"
      />
    );
  }

  if (resolvedMode === 'scanning') {
    return (
      <MembershipRowList>
        {channelMembers.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--dsv2-text-tertiary)', margin: 0 }}>
            No direct channel members — add channels to configure scanning behaviour.
          </p>
        ) : (
          channelMembers.map((entry) => {
            const channel = channelsById.get(entry.channelId);
            if (!channel) return null;
            const memberOverride = entry.includeInScanList ?? 'default';
            return (
              <MembershipRow
                key={entry.channelId}
                dragHandle={false}
                label={channelDisplayLabel(channel)}
                trailing={
                  <SegmentedControl
                    options={[...SCAN_SEGMENT_OPTIONS]}
                    value={scanUiValue(memberOverride)}
                    onChange={(value) =>
                      handleIncludeInScanList(channel.id, scanUiToModel(value as ScanUiValue))
                    }
                  />
                }
              />
            );
          })
        )}
      </MembershipRowList>
    );
  }

  if (resolvedMode === 'summary') {
    return (
      <MembershipRowList>
        {memberKeys.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--dsv2-text-tertiary)', margin: 0 }}>No members in zone</p>
        ) : (
          memberKeys.map((key) =>
            renderMemberRow(key, { showSelect: false, showRemove: false, showDrag: false }),
          )
        )}
      </MembershipRowList>
    );
  }

  const membersDescription = `${members.length} direct member${members.length === 1 ? '' : 's'}${
    editingZoneId ? ` · ${effectiveChannelCount} channels effective` : ''
  } — drag to reorder, or use Sort channels…`;

  const showInlinePool = resolvedMode === 'full' && !onAdd;

  return (
    <Stack gap="lg">
      <MembershipPanel
        title="Members"
        description={membersDescription}
        addLabel="Add members"
        onAdd={onAdd}
        search={{
          value: inZoneFilter,
          onChange: setInZoneFilter,
          placeholder: 'Find in list…',
        }}
        selectedCount={inZoneSelected.length}
        onBulkMoveUp={() => moveSelected('up')}
        onBulkMoveDown={() => moveSelected('down')}
        onBulkRemove={() => removeKeys(inZoneSelected)}
        onClearSelection={() => setInZoneSelected([])}
        isEmpty={filteredInZoneKeys.length === 0}
        emptyMessage="No members in zone"
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <MembershipSortMenu
            disabled={!members.length || filterActive}
            label="Sort channels…"
            onSort={(sortMode) =>
              onChange(sortZoneMembersByMode(members, channelsById, zonesById, sortMode))
            }
          />
        </div>
        <DataTableBulkReorderProvider
          sortableKeys={filterActive ? [] : memberKeys}
          orderedKeys={memberKeys}
          selectedKeys={inZoneSelected}
          disabled={filterActive}
          onSetOrder={(nextKeys) => {
            if (nextKeys.length !== members.length) return;
            onChange(reorderMembersByKeys(members, nextKeys as ZonePickerMemberKey[]));
          }}
        >
          <DataTableBulkReorderSortable
            sortableKeys={filterActive ? [] : memberKeys}
            disabled={filterActive}
          >
            <MembershipRowList>
              {filteredInZoneKeys.map((key) =>
                renderMemberRow(key, {
                  showSelect: true,
                  showRemove: true,
                  showDrag: true,
                  showOpenLink: true,
                }),
              )}
            </MembershipRowList>
          </DataTableBulkReorderSortable>
        </DataTableBulkReorderProvider>
      </MembershipPanel>

      {showInlinePool ? (
        <>
          <ZoneMemberAddPool pool={addPool} channels={channels} variant="inline" />
          <Button
            variant="secondary"
            size="sm"
            disabled={addPool.stagedCount === 0}
            onClick={() => addPool.addSelected()}
          >
            Add selected ({addPool.stagedCount})
          </Button>
        </>
      ) : null}
    </Stack>
  );
}

/** Add-members overlay for zone edit workspace (E2). */
export function ZoneMemberAddOverlay({
  open,
  zoneName,
  onCancel,
  onCommit,
  channels,
  zones,
  editingZoneId,
  members,
  onChange,
}: {
  open: boolean;
  zoneName: string;
  onCancel: () => void;
  onCommit: () => void;
  channels: Channel[];
  zones: Zone[];
  editingZoneId: string;
  members: ZoneMemberEntry[];
  onChange: (members: ZoneMemberEntry[]) => void;
}) {
  const [activeSectionId, setActiveSectionId] = useState<ZoneAddSectionId>('channels');
  const [search, setSearch] = useState('');
  const pool = useZoneMemberAddPool({ channels, zones, editingZoneId, members, onChange });
  const { availableChannels, availableZones } = pool.filterCandidates(search.trim().toLowerCase());

  const sections = ZONE_ADD_SECTIONS.map((section) => ({
    ...section,
    count: section.id === 'channels' ? availableChannels.length : availableZones.length,
  }));

  return (
    <AddMembersScreen
      open={open}
      title={`Add to ${zoneName}`}
      onCancel={() => {
        pool.clearStaged();
        setSearch('');
        onCancel();
      }}
      sections={sections}
      activeSectionId={activeSectionId}
      onSectionChange={(id) => setActiveSectionId(id as ZoneAddSectionId)}
      search={{ value: search, onChange: setSearch, placeholder: 'Find…' }}
      totalStaged={pool.stagedCount}
      onCommit={() => {
        if (pool.addSelected()) {
          setSearch('');
          onCommit();
        }
      }}
    >
      <ZoneMemberAddPool
        pool={pool}
        channels={channels}
        variant="overlay"
        activeSectionId={activeSectionId}
        filter={search}
      />
    </AddMembersScreen>
  );
}
