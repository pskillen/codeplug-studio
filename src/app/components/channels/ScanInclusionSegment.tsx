import type { ScanInclusion } from '@core/models/library.ts';
import GradientSegmentedControl from '../ui/GradientSegmentedControl.tsx';

export interface ScanInclusionSegmentProps {
  value: ScanInclusion;
  onChange: (scanInclusion: ScanInclusion) => void;
}

const OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'skip', label: 'Skip scan' },
  { value: 'alwaysScan', label: 'Always scan' },
] as const;

export default function ScanInclusionSegment({ value, onChange }: ScanInclusionSegmentProps) {
  return (
    <GradientSegmentedControl
      label="Scanning"
      description="Default defers to the format build export setting. Skip and Always scan override that default."
      value={value}
      onChange={(next) => onChange(next as ScanInclusion)}
      data={[...OPTIONS]}
      scheme="three"
      fullWidth
    />
  );
}
