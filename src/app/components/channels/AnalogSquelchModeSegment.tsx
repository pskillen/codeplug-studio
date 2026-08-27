import type { AnalogSquelchModeOverride } from '@core/models/channelBehaviourDefaults.ts';
import GradientSegmentedControl, {
  GRADIENT_SEGMENT_IDLE_VALUE,
  type GradientSegmentOption,
} from '../ui/GradientSegmentedControl.tsx';

export interface AnalogSquelchModeSegmentProps {
  value: AnalogSquelchModeOverride | typeof GRADIENT_SEGMENT_IDLE_VALUE;
  onChange: (value: AnalogSquelchModeOverride) => void;
  includeDefault?: boolean;
  disabled?: boolean;
  /** `'row'` puts label/description left, control right. `'column'` puts description below. Default `'stack'`. */
  layout?: 'stack' | 'row' | 'column';
  idleOption?: GradientSegmentOption<string>;
  sharedValue?: AnalogSquelchModeOverride;
  onIdle?: () => void;
}

const CHANNEL_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'carrier', label: 'Carrier' },
  { value: 'tone', label: 'Tone' },
] as const;

const BUILD_OPTIONS = [
  { value: 'carrier', label: 'Carrier' },
  { value: 'tone', label: 'Tone' },
] as const;

export default function AnalogSquelchModeSegment({
  value,
  onChange,
  includeDefault = true,
  disabled = false,
  layout = 'stack',
  idleOption,
  sharedValue,
  onIdle,
}: AnalogSquelchModeSegmentProps) {
  const data = includeDefault ? [...CHANNEL_OPTIONS] : [...BUILD_OPTIONS];
  const wireValue =
    value === GRADIENT_SEGMENT_IDLE_VALUE
      ? value
      : includeDefault
        ? value
        : value === 'default'
          ? 'carrier'
          : value;

  return (
    <GradientSegmentedControl
      label="Analog squelch mode"
      description={
        includeDefault
          ? 'Default uses the analog squelch setting on export. Carrier opens on signal; Tone waits for the RX CTCSS or DCS.'
          : 'Sets analog squelch for this build’s export, instead of each channel’s own setting.'
      }
      value={wireValue}
      onChange={(next) => {
        if (idleOption && next === idleOption.value) {
          onIdle?.();
          return;
        }
        onChange(next as AnalogSquelchModeOverride);
      }}
      data={data}
      scheme="three"
      layout={layout}
      fullWidth={layout === 'stack'}
      disabled={disabled}
      idleOption={idleOption}
      sharedValue={sharedValue}
    />
  );
}
