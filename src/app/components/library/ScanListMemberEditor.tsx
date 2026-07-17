import { ActionIcon, Checkbox, Group, Stack, Text, Tooltip } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import type { Channel } from '@core/models/library.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import { reorderScanListMembers } from '@core/domain/membershipOrder.ts';
import AvailableItemPicker from '../ui/AvailableItemPicker.tsx';
import SelectedItemDragHandle from '../ui/SelectedItemDragHandle.tsx';
import SelectedItemList from '../ui/SelectedItemList.tsx';
import MembershipSortMenu from './MembershipSortMenu.tsx';
import { sortChannelIdsByMode } from '@core/domain/membershipSort.ts';
import { sortByName } from '../../lib/channels.ts';
import { ICON_STROKE } from '../../lib/iconSizes.ts';

export interface ScanListMemberEditorProps {
  channels: Channel[];
  memberChannelIds: string[];
  onChange: (memberChannelIds: string[]) => void;
}

function channelMatchesFilter(channel: Channel, filterLower: string): boolean {
  if (!filterLower) return true;
  return channelDisplayLabel(channel).toLowerCase().includes(filterLower);
}

export default function ScanListMemberEditor({
  channels,
  memberChannelIds,
  onChange,
}: ScanListMemberEditorProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [availableFilter, setAvailableFilter] = useState('');
  const [availableSelected, setAvailableSelected] = useState<string[]>([]);

  const channelsById = useMemo(() => new Map(channels.map((ch) => [ch.id, ch])), [channels]);
  const memberSet = useMemo(() => new Set(memberChannelIds), [memberChannelIds]);
  const availableFilterLower = availableFilter.trim().toLowerCase();

  const availableChannels = useMemo(
    () =>
      sortByName(channels).filter(
        (channel) =>
          !memberSet.has(channel.id) && channelMatchesFilter(channel, availableFilterLower),
      ),
    [channels, memberSet, availableFilterLower],
  );

  const toggleSelect = useCallback((channelId: string) => {
    setSelected((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId],
    );
  }, []);

  const toggleAvailable = useCallback((channelId: string) => {
    setAvailableSelected((prev) =>
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
      onChange(reorderScanListMembers(memberChannelIds, new Set(selected), direction));
    },
    [memberChannelIds, onChange, selected],
  );

  const addSelected = useCallback(() => {
    const toAdd = availableSelected.filter((id) => !memberSet.has(id));
    if (!toAdd.length) return;
    onChange([...memberChannelIds, ...toAdd]);
    setAvailableSelected([]);
  }, [availableSelected, memberChannelIds, memberSet, onChange]);

  const canMoveUp = selected.some((id) => memberChannelIds.indexOf(id) > 0);
  const canMoveDown = selected.some((id) => {
    const index = memberChannelIds.indexOf(id);
    return index >= 0 && index < memberChannelIds.length - 1;
  });

  return (
    <Stack gap="md">
      <SelectedItemList
        title="Channels in this scan list"
        description={`${memberChannelIds.length} channel${
          memberChannelIds.length === 1 ? '' : 's'
        } — export order`}
        itemKeys={memberChannelIds}
        selectedKeys={selected}
        onToggleSelect={toggleSelect}
        onRemove={(id) => removeIds([id])}
        emptyMessage="No channels in scan list"
        onReorder={onChange}
        onMoveSelected={moveSelected}
        onRemoveSelected={() => removeIds(selected)}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        renderItem={({ itemKey, selected: rowSelected, onToggleSelect, onRemove, dragHandle }) => {
          const channel = channelsById.get(itemKey);
          return (
            <Group key={itemKey} gap="xs" wrap="nowrap" align="flex-start">
              <Checkbox checked={rowSelected} onChange={onToggleSelect} aria-label="Select" />
              <SelectedItemDragHandle dragHandle={dragHandle} />
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={500} truncate>
                  {channel ? channelDisplayLabel(channel) : itemKey}
                </Text>
              </Stack>
              <Tooltip label="Remove">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={onRemove}
                  aria-label="Remove"
                >
                  <IconX size={14} stroke={ICON_STROKE} />
                </ActionIcon>
              </Tooltip>
            </Group>
          );
        }}
        toolbar={
          <MembershipSortMenu
            disabled={!memberChannelIds.length}
            onSort={(mode) => onChange(sortChannelIdsByMode(memberChannelIds, channelsById, mode))}
          />
        }
      />

      <AvailableItemPicker
        title="Other channels"
        description="Stage channels to add to this scan list"
        filter={{
          value: availableFilter,
          onChange: setAvailableFilter,
          placeholder: 'Filter…',
          'aria-label': 'Filter available channels',
        }}
        sections={[
          {
            id: 'channels',
            title: 'Channels',
            itemKeys: availableChannels.map((channel) => channel.id),
            selectedKeys: availableSelected,
            onToggleSelect: toggleAvailable,
            emptyMessage: 'No channels available',
            renderItem: ({ itemKey, checked, onToggle }) => {
              const channel = channelsById.get(itemKey);
              if (!channel) return null;
              return (
                <Group key={itemKey} gap="xs" wrap="nowrap">
                  <Checkbox
                    checked={checked}
                    onChange={onToggle}
                    aria-label={`Select ${channelDisplayLabel(channel)}`}
                  />
                  <Text size="sm" truncate>
                    {channelDisplayLabel(channel)}
                  </Text>
                </Group>
              );
            },
          },
        ]}
        onAddSelected={addSelected}
        addDisabled={!availableSelected.length}
      />
    </Stack>
  );
}
