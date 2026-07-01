import { MultiSelect } from '@mantine/core';
import { CHANNEL_MODES, type ChannelMode } from '../../lib/channelModes.ts';

export interface ChannelModesMultiSelectProps {
  value: ChannelMode[];
  onChange: (modes: ChannelMode[]) => void;
  label?: string;
  description?: string;
}

/** Multi-select for which RF modes a channel supports (drives `modeProfiles[]`). */
export default function ChannelModesMultiSelect({
  value,
  onChange,
  label = 'Modes',
  description = 'Select every mode this channel supports. Each mode gets its own profile below.',
}: ChannelModesMultiSelectProps) {
  const data = CHANNEL_MODES.filter((m) => m.id !== 'other').map((m) => ({
    value: m.id,
    label: m.label,
  }));

  return (
    <MultiSelect
      label={label}
      description={description}
      data={data}
      value={value}
      onChange={(selected) => onChange(selected as ChannelMode[])}
      searchable
      clearable
    />
  );
}
