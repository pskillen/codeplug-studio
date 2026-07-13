import { useMemo } from 'react';
import type { ChannelAprsBinding } from '@core/models/aprs.ts';
import type { AprsPttMode, AprsReportType } from '@core/models/libraryTypes.ts';
import type { Channel } from '@core/models/library.ts';
import { CHANNEL_APRS_OFF } from '@core/domain/aprs/defaults.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import { Checkbox, Select, Stack, Text } from '@mantine/core';
import { sortByName } from '../../lib/channels.ts';

const REPORT_TYPE_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'digital', label: 'Digital' },
] satisfies { value: AprsReportType; label: string }[];

const PTT_MODE_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
] satisfies { value: AprsPttMode; label: string }[];

const NONE_CHANNEL_VALUE = '';

export interface ChannelAprsBindingSectionProps {
  channels: Channel[];
  value: ChannelAprsBinding;
  onChange: (value: ChannelAprsBinding) => void;
  readOnly?: boolean;
}

export function channelAprsBindingFromChannel(channel: Channel): ChannelAprsBinding {
  return channel.aprs ?? { ...CHANNEL_APRS_OFF };
}

export default function ChannelAprsBindingSection({
  channels,
  value,
  onChange,
  readOnly = false,
}: ChannelAprsBindingSectionProps) {
  const channelOptions = useMemo(
    () => [
      { value: NONE_CHANNEL_VALUE, label: 'None' },
      ...sortByName(channels).map((channel) => ({
        value: channel.id,
        label: channelDisplayLabel(channel),
      })),
    ],
    [channels],
  );

  if (readOnly) {
    return (
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          Digital APRS is available on DMR channels only.
        </Text>
        <Text size="sm">Report type: Off</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Per-channel digital APRS flags for CPS export. Analog APRS is not modelled in Codeplug Studio.
      </Text>
      <Checkbox
        label="APRS receive enabled"
        checked={value.receiveEnabled}
        onChange={(event) =>
          onChange({ ...value, receiveEnabled: event.currentTarget.checked })
        }
      />
      <Select
        label="Report type"
        data={REPORT_TYPE_OPTIONS}
        value={value.reportType}
        onChange={(next) =>
          onChange({ ...value, reportType: (next as AprsReportType | null) ?? 'off' })
        }
      />
      <Select
        label="Digital APRS PTT mode"
        data={PTT_MODE_OPTIONS}
        value={value.digitalPttMode}
        onChange={(next) =>
          onChange({ ...value, digitalPttMode: (next as AprsPttMode | null) ?? 'off' })
        }
      />
      <Select
        label="Report channel"
        description="Library channel whose APRS slot index is written at export."
        data={channelOptions}
        searchable
        clearable
        value={value.reportChannelRef?.id ?? NONE_CHANNEL_VALUE}
        onChange={(next) =>
          onChange({
            ...value,
            reportChannelRef:
              next && next !== NONE_CHANNEL_VALUE ? { kind: 'channel', id: next } : null,
          })
        }
      />
    </Stack>
  );
}
