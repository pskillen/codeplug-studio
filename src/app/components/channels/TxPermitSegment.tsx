import type { TxPermitOverride } from '@core/models/channelBehaviourDefaults.ts';
import GradientSegmentedControl from '../ui/GradientSegmentedControl.tsx';

export interface TxPermitSegmentProps {
  value: TxPermitOverride;
  onChange: (value: TxPermitOverride) => void;
  /** When false, omits Default (build export override). */
  includeDefault?: boolean;
  disabled?: boolean;
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
}: TxPermitSegmentProps) {
  const data = includeDefault ? [...CHANNEL_OPTIONS] : [...BUILD_OPTIONS];
  const wireValue = includeDefault ? value : value === 'default' ? 'permitAlways' : value;

  return (
    <GradientSegmentedControl
      label="TX permit"
      description={
        includeDefault
          ? 'Default defers to library defaults and build export overrides.'
          : 'Override library and per-channel settings for this build.'
      }
      value={wireValue}
      onChange={(next) => onChange(next as TxPermitOverride)}
      data={data}
      scheme="three"
      fullWidth
      disabled={disabled}
    />
  );
}
