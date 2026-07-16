import type { ForbidTransmitOverride } from '@core/models/channelBehaviourDefaults.ts';
import GradientSegmentedControl from '../ui/GradientSegmentedControl.tsx';

export interface ForbidTransmitSegmentProps {
  value: ForbidTransmitOverride;
  onChange: (forbidTransmit: ForbidTransmitOverride) => void;
  /** When true, includes a Default option that defers to library + build cascade. */
  includeDefault?: boolean;
  disabled?: boolean;
}

const CHANNEL_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'allow', label: 'Allow TX' },
  { value: 'forbid', label: 'RX only' },
] as const;

const BUILD_OPTIONS = [
  { value: 'allow', label: 'Allow TX' },
  { value: 'forbid', label: 'RX only' },
] as const;

export default function ForbidTransmitSegment({
  value,
  onChange,
  includeDefault = true,
  disabled = false,
}: ForbidTransmitSegmentProps) {
  const data = includeDefault ? [...CHANNEL_OPTIONS] : [...BUILD_OPTIONS];
  const wireValue = includeDefault ? value : value === 'default' ? 'allow' : value;

  return (
    <GradientSegmentedControl
      label="Transmit"
      value={wireValue}
      onChange={(next) => onChange(next as ForbidTransmitOverride)}
      data={data}
      scheme="allowForbid"
      fullWidth
      disabled={disabled}
    />
  );
}
