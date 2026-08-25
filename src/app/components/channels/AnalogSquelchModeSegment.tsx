import type { AnalogSquelchModeOverride } from '@core/models/channelBehaviourDefaults.ts';
import GradientSegmentedControl from '../ui/GradientSegmentedControl.tsx';

export interface AnalogSquelchModeSegmentProps {
  value: AnalogSquelchModeOverride;
  onChange: (value: AnalogSquelchModeOverride) => void;
  includeDefault?: boolean;
  disabled?: boolean;
  /** `'row'` puts label/description left, control right. Default `'stack'`. */
  layout?: 'stack' | 'row';
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
}: AnalogSquelchModeSegmentProps) {
  const data = includeDefault ? [...CHANNEL_OPTIONS] : [...BUILD_OPTIONS];
  const wireValue = includeDefault ? value : value === 'default' ? 'carrier' : value;

  return (
    <GradientSegmentedControl
      label="Analog squelch mode"
      description={
        includeDefault
          ? 'Default defers to library defaults and build export overrides.'
          : 'Override library and per-channel settings for this build.'
      }
      value={wireValue}
      onChange={(next) => onChange(next as AnalogSquelchModeOverride)}
      data={data}
      scheme="three"
      layout={layout}
      fullWidth={layout === 'stack'}
      disabled={disabled}
    />
  );
}
