import type { ForbidTransmitOverride } from '@core/models/channelBehaviourDefaults.ts';
import GradientSegmentedControl, {
  GRADIENT_SEGMENT_IDLE_VALUE,
  type GradientSegmentOption,
} from '../ui/GradientSegmentedControl.tsx';

export interface ForbidTransmitSegmentProps {
  value: ForbidTransmitOverride | typeof GRADIENT_SEGMENT_IDLE_VALUE;
  onChange: (forbidTransmit: ForbidTransmitOverride) => void;
  /** When true, includes a Default option that defers to library + build cascade. */
  includeDefault?: boolean;
  disabled?: boolean;
  /** `'row'` puts label/description left, control right. Default `'stack'`. */
  layout?: 'stack' | 'row';
  idleOption?: GradientSegmentOption<string>;
  sharedValue?: ForbidTransmitOverride;
  onIdle?: () => void;
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
  layout = 'stack',
  idleOption,
  sharedValue,
  onIdle,
}: ForbidTransmitSegmentProps) {
  const data = includeDefault ? [...CHANNEL_OPTIONS] : [...BUILD_OPTIONS];
  const wireValue =
    value === GRADIENT_SEGMENT_IDLE_VALUE
      ? value
      : includeDefault
        ? value
        : value === 'default'
          ? 'allow'
          : value;

  return (
    <GradientSegmentedControl
      label="Transmit"
      description="RX only makes this channel receive-only — the radio will not transmit on it."
      value={wireValue}
      onChange={(next) => {
        if (idleOption && next === idleOption.value) {
          onIdle?.();
          return;
        }
        onChange(next as ForbidTransmitOverride);
      }}
      data={data}
      scheme="allowForbid"
      layout={layout}
      fullWidth={layout === 'stack'}
      disabled={disabled}
      idleOption={idleOption}
      sharedValue={sharedValue}
    />
  );
}
