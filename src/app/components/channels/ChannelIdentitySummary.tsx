import { Group, Paper, Text } from '@mantine/core';
import type { Channel } from '@core/models/library.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import { resolveChannelPrimaryMode } from '@core/domain/modeProfiles.ts';
import { channelModesForFilter } from '../../lib/channels.ts';
import { formatChannelRxTxListCell } from '../../lib/formatFrequency.ts';
import { BandPillForChannel } from '../pills/BandPill.tsx';
import ModePill from '../pills/ModePill.tsx';

export interface ChannelIdentitySummaryProps {
  channel: Channel;
  /** When true, blank identity fields show "New channel" instead of a UUID fallback. */
  isNew?: boolean;
}

function summaryLabel(channel: Channel, isNew: boolean): string {
  if (channel.callsign.trim() || channel.name.trim()) {
    return channelDisplayLabel(channel);
  }
  return isNew ? 'New channel' : 'Untitled channel';
}

export default function ChannelIdentitySummary({
  channel,
  isNew = false,
}: ChannelIdentitySummaryProps) {
  const label = summaryLabel(channel, isNew);
  const modes = channelModesForFilter(channel);
  const primary = modes.length > 1 ? resolveChannelPrimaryMode(channel) : null;
  const rxTx = formatChannelRxTxListCell(channel.rxFrequency, channel.txFrequency);

  return (
    <Paper withBorder p="xs" radius="sm" my="sm" aria-label="Channel identity summary">
      <Group gap="xs" wrap="wrap" align="center">
        <Text size="sm" fw={600}>
          {label}
        </Text>
        <BandPillForChannel channel={channel} size="xs" />
        {modes.map((mode) => (
          <ModePill key={mode} mode={mode} size="xs" primary={mode === primary} />
        ))}
        {rxTx ? (
          <Text size="sm" c="dimmed" style={{ marginInlineStart: 'auto' }}>
            {rxTx}
          </Text>
        ) : null}
      </Group>
    </Paper>
  );
}
