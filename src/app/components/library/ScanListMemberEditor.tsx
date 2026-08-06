import { useCallback, useMemo, useState } from 'react';
import type { Channel } from '@core/models/library.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import { sortChannelIdsByMode } from '@core/domain/membershipSort.ts';
import { reorderSelectedKeys } from '@core/domain/zoneOrder.ts';
import {
  AddMembersScreen,
  MembershipPanel,
  MembershipPoolRow,
} from '../v2/index.ts';
import {
  DataTableBulkReorderProvider,
  DataTableBulkReorderSortable,
} from '../../lib/dataTable/DataTableBulkReorder.tsx';
import MembershipSortMenu from './MembershipSortMenu.tsx';
import SortableMembershipRow, { MembershipRowList } from './SortableMembershipRow.tsx';
import { sortByName } from '../../lib/channels.ts';

export interface ScanListMemberEditorProps {
  channels: Channel[];
  memberChannelIds: string[];
  onChange: (memberChannelIds: string[]) => void;
  onAdd?: () => void;
}

function channelMatchesFilter(channel: Channel, filterLower: string): boolean {
  if (!filterLower) return true;
  return channelDisplayLabel(channel).toLowerCase().includes(filterLower);
}

export default function ScanListMemberEditor({
  channels,
  memberChannelIds,
  onChange,
  onAdd,
}: ScanListMemberEditorProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const channelsById = useMemo(() => new Map(channels.map((ch) => [ch.id, ch])), [channels]);

  const toggleSelect = useCallback((channelId: string) => {
    setSelected((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId],
    );
  }, []);

  const removeIds = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      const remove = new Set(ids);
      onChange(memberChannelIds.filter((id) => !remove.has(id)));
      setSelected((prev) => prev.filter((id) => !remove.has(id)));
    },
    [memberChannelIds, onChange],
  );

  const moveSelected = useCallback(
    (direction: 'up' | 'down') => {
      if (!selected.length) return;
      onChange(
        reorderSelectedKeys(memberChannelIds, new Set(selected), direction) as string[],
      );
    },
    [memberChannelIds, onChange, selected],
  );

  return (
    <MembershipPanel
      title="Members"
      description={`${memberChannelIds.length} channel${memberChannelIds.length === 1 ? '' : 's'} — export order`}
      addLabel="Add members"
      onAdd={onAdd}
      selectedCount={selected.length}
      onBulkMoveUp={() => moveSelected('up')}
      onBulkMoveDown={() => moveSelected('down')}
      onBulkRemove={() => removeIds(selected)}
      onClearSelection={() => setSelected([])}
      isEmpty={memberChannelIds.length === 0}
      emptyMessage="No channels in scan list"
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <MembershipSortMenu
          disabled={!memberChannelIds.length}
          label="Sort channels…"
          onSort={(mode) => onChange(sortChannelIdsByMode(memberChannelIds, channelsById, mode))}
        />
      </div>
      <DataTableBulkReorderProvider
        sortableKeys={memberChannelIds}
        orderedKeys={memberChannelIds}
        selectedKeys={selected}
        onSetOrder={onChange}
      >
        <DataTableBulkReorderSortable sortableKeys={memberChannelIds}>
          <MembershipRowList>
            {memberChannelIds.map((itemKey) => {
              const channel = channelsById.get(itemKey);
              return (
                <SortableMembershipRow
                  key={itemKey}
                  itemKey={itemKey}
                  label={channel ? channelDisplayLabel(channel) : itemKey}
                  checked={selected.includes(itemKey)}
                  onCheck={() => toggleSelect(itemKey)}
                  onRemove={() => removeIds([itemKey])}
                />
              );
            })}
          </MembershipRowList>
        </DataTableBulkReorderSortable>
      </DataTableBulkReorderProvider>
    </MembershipPanel>
  );
}

export function ScanListAddOverlay({
  open,
  listName,
  onCancel,
  onCommit,
  channels,
  memberChannelIds,
  onChange,
}: {
  open: boolean;
  listName: string;
  onCancel: () => void;
  onCommit: () => void;
  channels: Channel[];
  memberChannelIds: string[];
  onChange: (memberChannelIds: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [staged, setStaged] = useState<string[]>([]);
  const memberSet = useMemo(() => new Set(memberChannelIds), [memberChannelIds]);
  const filterLower = search.trim().toLowerCase();

  const availableChannels = useMemo(
    () =>
      sortByName(channels).filter(
        (channel) =>
          !memberSet.has(channel.id) && channelMatchesFilter(channel, filterLower),
      ),
    [channels, memberSet, filterLower],
  );

  const toggleStaged = (id: string) => {
    setStaged((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));
  };

  const commit = () => {
    const toAdd = staged.filter((id) => !memberSet.has(id));
    if (!toAdd.length) return;
    onChange([...memberChannelIds, ...toAdd]);
    setStaged([]);
    setSearch('');
    onCommit();
  };

  return (
    <AddMembersScreen
      open={open}
      title={`Add to ${listName}`}
      onCancel={() => {
        setStaged([]);
        setSearch('');
        onCancel();
      }}
      search={{ value: search, onChange: setSearch, placeholder: 'Find…' }}
      totalStaged={staged.length}
      onCommit={commit}
    >
      {availableChannels.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--dsv2-text-tertiary)', margin: 0 }}>
          No channels available
        </p>
      ) : (
        availableChannels.map((channel) => (
          <MembershipPoolRow
            key={channel.id}
            checked={staged.includes(channel.id)}
            onCheck={() => toggleStaged(channel.id)}
            label={channelDisplayLabel(channel)}
          />
        ))
      )}
    </AddMembersScreen>
  );
}
