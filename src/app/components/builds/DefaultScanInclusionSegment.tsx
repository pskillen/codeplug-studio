import type { DefaultScanInclusion } from '@core/models/formatBuild.ts';
import GradientSegmentedControl from '../ui/GradientSegmentedControl.tsx';

export interface DefaultScanInclusionSegmentProps {
  value: DefaultScanInclusion;
  onChange: (value: DefaultScanInclusion) => void;
  formatDefault: DefaultScanInclusion;
  disabled?: boolean;
}

const OPTIONS = [
  { value: 'scan', label: 'Scan' },
  { value: 'skip', label: 'Skip' },
] as const;

export default function DefaultScanInclusionSegment({
  value,
  onChange,
  formatDefault,
  disabled,
}: DefaultScanInclusionSegmentProps) {
  return (
    <GradientSegmentedControl
      label="Default scan behaviour"
      description={`Channels set to Default follow this choice (${value === 'skip' ? 'skip scanning' : 'include in scanning'}). Format default when unset: ${formatDefault}.`}
      value={value}
      onChange={(next) => onChange(next as DefaultScanInclusion)}
      data={[...OPTIONS]}
      scheme="onOff"
      fullWidth
      disabled={disabled}
    />
  );
}
