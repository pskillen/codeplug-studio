import type { ScanInclusion } from '@core/models/library.ts';
import GradientSegmentedControl, {
  GRADIENT_SEGMENT_IDLE_VALUE,
  type GradientSegmentOption,
} from '../ui/GradientSegmentedControl.tsx';

export interface ScanInclusionSegmentProps {
  value: ScanInclusion | typeof GRADIENT_SEGMENT_IDLE_VALUE;
  onChange: (scanInclusion: ScanInclusion) => void;
  /** Table row layout — omits label and description. */
  compact?: boolean;
  disabled?: boolean;
  /** `'row'` puts label/description left, control right. `'column'` puts description below. Default `'stack'`; ignored when `compact`. */
  layout?: 'stack' | 'row' | 'column';
  idleOption?: GradientSegmentOption<string>;
  sharedValue?: ScanInclusion;
  onIdle?: () => void;
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
  layout = 'stack',
  idleOption,
  sharedValue,
  onIdle,
}: ScanInclusionSegmentProps) {
  return (
    <GradientSegmentedControl
      label={compact ? undefined : 'Scanning'}
      description={
        compact
          ? undefined
          : 'Default uses the scan setting on export. Skip and Always scan set this channel.'
      }
      value={value}
      onChange={(next) => {
        if (idleOption && next === idleOption.value) {
          onIdle?.();
          return;
        }
        onChange(next as ScanInclusion);
      }}
      data={compact ? [...COMPACT_OPTIONS] : [...OPTIONS]}
      scheme="three"
      layout={compact ? 'stack' : layout}
      fullWidth={compact ? false : layout === 'stack'}
      size={compact ? 'xs' : undefined}
      disabled={disabled}
      idleOption={compact ? undefined : idleOption}
      sharedValue={compact ? undefined : sharedValue}
    />
  );
}
