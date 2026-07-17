import {
  ActionIcon,
  Button,
  Checkbox,
  Group,
  MultiSelect,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import type { Channel } from '@core/models/library.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import { reorderScanListMembers } from '@core/domain/membershipOrder.ts';
import SelectedItemList from '../ui/SelectedItemList.tsx';
import { sortByName } from '../../lib/channels.ts';
import { ICON_STROKE } from '../../lib/iconSizes.ts';

export interface ScanListMemberEditorProps {
  channels: Channel[];
  memberChannelIds: string[];
  onChange: (memberChannelIds: string[]) => void;
}

export default function ScanListMemberEditor({
  channels,
  memberChannelIds,
  onChange,
}: ScanListMemberEditorProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [addValue, setAddValue] = useState<string[]>([]);

  const channelsById = useMemo(() => new Map(channels.map((ch) => [ch.id, ch])), [channels]);
  const memberSet = useMemo(() => new Set(memberChannelIds), [memberChannelIds]);

  const addOptions = useMemo(
    () =>
      sortByName(channels)
        .filter((channel) => !memberSet.has(channel.id))
        .map((channel) => ({
          value: channel.id,
          label: channelDisplayLabel(channel),
        })),
    [channels, memberSet],
  );

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
      onChange(reorderScanListMembers(memberChannelIds, new Set(selected), direction));
    },
    [memberChannelIds, onChange, selected],
  );

  const addChannels = useCallback(() => {
    if (!addValue.length) return;
    const toAdd = addValue.filter((id) => !memberSet.has(id));
    if (!toAdd.length) return;
    onChange([...memberChannelIds, ...toAdd]);
    setAddValue([]);
  }, [addValue, memberChannelIds, memberSet, onChange]);

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
        renderItem={({ itemKey, selected: rowSelected, onToggleSelect, onRemove }) => {
          const channel = channelsById.get(itemKey);
          return (
            <Group key={itemKey} gap="xs" wrap="nowrap" align="flex-start">
              <Checkbox checked={rowSelected} onChange={onToggleSelect} aria-label="Select" />
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
              color="red"
              size="compact-sm"
              onClick={() => removeIds(selected)}
              disabled={!selected.length}
            >
              Remove selected
            </Button>
          </Group>
        }
      />

      <Stack gap="xs">
        <Text size="sm" fw={600}>
          Add channels
        </Text>
        <Group align="flex-end" gap="xs" wrap="nowrap">
          <MultiSelect
            style={{ flex: 1 }}
            label="Available channels"
            data={addOptions}
            value={addValue}
            searchable
            clearable
            onChange={setAddValue}
            placeholder="Select channels to add…"
          />
          <Button type="button" onClick={addChannels} disabled={!addValue.length}>
            Add
          </Button>
        </Group>
      </Stack>
    </Stack>
  );
}
