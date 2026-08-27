import type { SendTalkerAliasOverride } from '@core/models/channelBehaviourDefaults.ts';
import GradientSegmentedControl, {
  GRADIENT_SEGMENT_IDLE_VALUE,
  type GradientSegmentOption,
} from '../ui/GradientSegmentedControl.tsx';

export interface SendTalkerAliasSegmentProps {
  value: SendTalkerAliasOverride | typeof GRADIENT_SEGMENT_IDLE_VALUE;
  onChange: (value: SendTalkerAliasOverride) => void;
  includeDefault?: boolean;
  disabled?: boolean;
  /** `'row'` puts label/description left, control right. `'column'` puts description below. Default `'stack'`. */
  layout?: 'stack' | 'row' | 'column';
  idleOption?: GradientSegmentOption<string>;
  sharedValue?: SendTalkerAliasOverride;
  onIdle?: () => void;
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
  layout = 'stack',
  idleOption,
  sharedValue,
  onIdle,
}: SendTalkerAliasSegmentProps) {
  const data = includeDefault ? [...CHANNEL_OPTIONS] : [...BUILD_OPTIONS];
  const wireValue =
    value === GRADIENT_SEGMENT_IDLE_VALUE
      ? value
      : includeDefault
        ? value
        : value === 'default'
          ? 'on'
          : value;

  return (
    <GradientSegmentedControl
      label="Send talker alias"
      value={wireValue}
      onChange={(next) => {
        if (idleOption && next === idleOption.value) {
          onIdle?.();
          return;
        }
        onChange(next as SendTalkerAliasOverride);
      }}
      data={data}
      scheme="onOff"
      layout={layout}
      fullWidth={layout === 'stack'}
      disabled={disabled}
      idleOption={idleOption}
      sharedValue={sharedValue}
    />
  );
}
