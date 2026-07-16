import type { SendTalkerAliasOverride } from '@core/models/channelBehaviourDefaults.ts';
import GradientSegmentedControl from '../ui/GradientSegmentedControl.tsx';

export interface SendTalkerAliasSegmentProps {
  value: SendTalkerAliasOverride;
  onChange: (value: SendTalkerAliasOverride) => void;
  includeDefault?: boolean;
  disabled?: boolean;
}

const CHANNEL_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
] as const;

const BUILD_OPTIONS = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
] as const;

export default function SendTalkerAliasSegment({
  value,
  onChange,
  includeDefault = true,
  disabled = false,
}: SendTalkerAliasSegmentProps) {
  const data = includeDefault ? [...CHANNEL_OPTIONS] : [...BUILD_OPTIONS];
  const wireValue = includeDefault ? value : value === 'default' ? 'on' : value;

  return (
    <GradientSegmentedControl
      label="Send talker alias"
      value={wireValue}
      onChange={(next) => onChange(next as SendTalkerAliasOverride)}
      data={data}
      scheme="onOff"
      fullWidth
      disabled={disabled}
    />
  );
}
