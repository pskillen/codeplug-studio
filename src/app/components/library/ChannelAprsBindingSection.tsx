import { useMemo } from 'react';
import type { AprsConfiguration, ChannelAprsBinding } from '@core/models/aprs.ts';
import type { AprsPttMode, AprsReportType } from '@core/models/libraryTypes.ts';
import type { Channel } from '@core/models/library.ts';
import { Checkbox, Select, Stack, Text } from '@mantine/core';
import {
  APRS_SLOT_NONE_VALUE,
  aprsSlotSelectOptions,
  channelAprsBindingFromChannel,
} from '../../lib/aprsBindingHelpers.ts';

export { channelAprsBindingFromChannel };

const REPORT_TYPE_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'digital', label: 'Digital' },
] satisfies { value: AprsReportType; label: string }[];

const PTT_MODE_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
] satisfies { value: AprsPttMode; label: string }[];

export interface ChannelAprsBindingSectionProps {
  aprsConfiguration: AprsConfiguration | null;
  channels: Channel[];
  value: ChannelAprsBinding;
  onChange: (value: ChannelAprsBinding) => void;
  readOnly?: boolean;
}

export default function ChannelAprsBindingSection({
  aprsConfiguration,
  channels,
  value,
  onChange,
  readOnly = false,
}: ChannelAprsBindingSectionProps) {
  const slotOptions = useMemo(
    () => aprsSlotSelectOptions(aprsConfiguration?.channelSlots ?? [], channels),
    [aprsConfiguration?.channelSlots, channels],
  );
  const slotsAvailable = (aprsConfiguration?.channelSlots.length ?? 0) > 0;

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
        Per-channel digital APRS flags for CPS export. Analog APRS is not modelled in Codeplug
        Studio.
      </Text>
      <Checkbox
        label="APRS receive enabled"
        checked={value.receiveEnabled}
        onChange={(event) => onChange({ ...value, receiveEnabled: event.currentTarget.checked })}
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
        label="Report slot"
        description={
          slotsAvailable
            ? 'APRS configuration slot used for position reports at export.'
            : 'Add channel slots on the APRS configuration page first.'
        }
        data={slotOptions}
        disabled={!slotsAvailable}
        value={value.reportSlotIndex != null ? String(value.reportSlotIndex) : APRS_SLOT_NONE_VALUE}
        onChange={(next) =>
          onChange({
            ...value,
            reportSlotIndex:
              next && next !== APRS_SLOT_NONE_VALUE ? Number.parseInt(next, 10) : null,
          })
        }
      />
    </Stack>
  );
}
