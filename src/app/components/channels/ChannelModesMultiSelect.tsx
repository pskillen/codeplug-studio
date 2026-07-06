import { ImageCheckboxGroup } from '../ui/index.ts';
import { CHANNEL_MODES, modeLabel, type ChannelMode } from '../../lib/channelModes.ts';
import ModePill from '../pills/ModePill.tsx';

export interface ChannelModesMultiSelectProps {
  value: ChannelMode[];
  onChange: (modes: ChannelMode[]) => void;
  label?: string;
  description?: string;
}

function modeCategoryLabel(category: (typeof CHANNEL_MODES)[number]['category']): string {
  if (category === 'analog') return 'Analog';
  if (category === 'digital') return 'Digital';
  return 'Other';
}

const MODE_OPTIONS = CHANNEL_MODES.filter((m) => m.id !== 'other').map((mode) => ({
  value: mode.id,
  title: modeLabel(mode.id),
  description: modeCategoryLabel(mode.category),
  media: <ModePill mode={mode.id} size="xs" />,
}));

/** Card grid for which RF modes a channel supports (drives `modeProfiles[]`). */
export default function ChannelModesMultiSelect({
  value,
  onChange,
  label = 'Modes',
  description = 'Select every mode this channel supports. Each mode gets its own profile below.',
}: ChannelModesMultiSelectProps) {
  return (
    <ImageCheckboxGroup
      label={label}
      description={description}
      value={value}
      onChange={onChange}
      options={MODE_OPTIONS}
      cols={{ base: 2, sm: 3 }}
    />
  );
}
