import type { ScanInclusion } from '@core/models/library.ts';
import GradientSegmentedControl from '../ui/GradientSegmentedControl.tsx';

export interface ScanInclusionSegmentProps {
  value: ScanInclusion;
  onChange: (scanInclusion: ScanInclusion) => void;
  /** Table row layout — omits label and description. */
  compact?: boolean;
  disabled?: boolean;
}

const OPTIONS = [
  { value: 'skip', label: 'Skip scan' },
  { value: 'default', label: 'Default' },
  { value: 'alwaysScan', label: 'Always scan' },
] as const;

const COMPACT_OPTIONS = [
  { value: 'skip', label: 'Skip' },
  { value: 'default', label: 'Default' },
  { value: 'alwaysScan', label: 'Scan' },
] as const;

export default function ScanInclusionSegment({
  value,
  onChange,
  compact = false,
  disabled = false,
}: ScanInclusionSegmentProps) {
  return (
    <GradientSegmentedControl
      label={compact ? undefined : 'Scanning'}
      description={
        compact
          ? undefined
          : 'Default defers to the format build export setting. Skip and Always scan override that default.'
      }
      value={value}
      onChange={(next) => onChange(next as ScanInclusion)}
      data={compact ? [...COMPACT_OPTIONS] : [...OPTIONS]}
      scheme="three"
      fullWidth={!compact}
      size={compact ? 'xs' : undefined}
      disabled={disabled}
    />
  );
}
