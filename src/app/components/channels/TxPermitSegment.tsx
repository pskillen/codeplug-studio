import type { TxPermitOverride } from '@core/models/channelBehaviourDefaults.ts';
import GradientSegmentedControl, {
  GRADIENT_SEGMENT_IDLE_VALUE,
  type GradientSegmentOption,
} from '../ui/GradientSegmentedControl.tsx';

export interface TxPermitSegmentProps {
  value: TxPermitOverride | typeof GRADIENT_SEGMENT_IDLE_VALUE;
  onChange: (value: TxPermitOverride) => void;
  /** When false, omits Default (build export override). */
  includeDefault?: boolean;
  disabled?: boolean;
  /** `'row'` puts label/description left, control right. `'column'` puts description below. Default `'stack'`. */
  layout?: 'stack' | 'row' | 'column';
  idleOption?: GradientSegmentOption<string>;
  sharedValue?: TxPermitOverride;
  onIdle?: () => void;
}

const CHANNEL_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'permitAlways', label: 'Permit always' },
  { value: 'busyLock', label: 'Busy lock' },
] as const;

const BUILD_OPTIONS = [
  { value: 'permitAlways', label: 'Permit always' },
  { value: 'busyLock', label: 'Busy lock' },
] as const;

export default function TxPermitSegment({
  value,
  onChange,
  includeDefault = true,
  disabled = false,
  layout = 'stack',
  idleOption,
  sharedValue,
  onIdle,
}: TxPermitSegmentProps) {
  const data = includeDefault ? [...CHANNEL_OPTIONS] : [...BUILD_OPTIONS];
  const wireValue =
    value === GRADIENT_SEGMENT_IDLE_VALUE
      ? value
      : includeDefault
        ? value
        : value === 'default'
          ? 'permitAlways'
          : value;

  return (
    <GradientSegmentedControl
      label="TX permit"
      description="Busy lock stops you transmitting while the frequency is in use. Permit always lets you hold TX anyway."
      value={wireValue}
      onChange={(next) => {
        if (idleOption && next === idleOption.value) {
          onIdle?.();
          return;
        }
        onChange(next as TxPermitOverride);
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
