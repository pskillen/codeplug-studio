import type { TxPermitOverride } from '@core/models/channelBehaviourDefaults.ts';
import GradientSegmentedControl from '../ui/GradientSegmentedControl.tsx';

export interface TxPermitSegmentProps {
  value: TxPermitOverride;
  onChange: (value: TxPermitOverride) => void;
  /** When false, omits Default (build export override). */
  includeDefault?: boolean;
  disabled?: boolean;
  /** `'row'` puts label/description left, control right. Default `'stack'`. */
  layout?: 'stack' | 'row';
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
}: TxPermitSegmentProps) {
  const data = includeDefault ? [...CHANNEL_OPTIONS] : [...BUILD_OPTIONS];
  const wireValue = includeDefault ? value : value === 'default' ? 'permitAlways' : value;

  return (
    <GradientSegmentedControl
      label="TX permit"
      description="Busy lock stops you transmitting while the frequency is in use. Permit always lets you hold TX anyway."
      value={wireValue}
      onChange={(next) => onChange(next as TxPermitOverride)}
      data={data}
      scheme="three"
      layout={layout}
      fullWidth={layout === 'stack'}
      disabled={disabled}
    />
  );
}
