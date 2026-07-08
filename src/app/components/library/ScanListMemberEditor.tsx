import { useMemo } from 'react';
import { MultiSelect, Stack, Text } from '@mantine/core';
import type { Channel } from '@core/models/library.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import { sortByName } from '../../lib/channels.ts';

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
  const options = useMemo(
    () =>
      sortByName(channels).map((channel) => ({
        value: channel.id,
        label: channelDisplayLabel(channel),
      })),
    [channels],
  );

  return (
    <Stack gap="xs">
      <Text size="sm" fw={600}>
        Channels in this scan list
      </Text>
      <Text size="sm" c="dimmed">
        Export order follows the selection order below. Per-channel scan list assignment on a build
        is configured separately on the build Channels page.
      </Text>
      <MultiSelect
        label="Member channels"
        data={options}
        value={memberChannelIds}
        searchable
        clearable
        onChange={onChange}
        placeholder="Add channels…"
      />
    </Stack>
  );
}
