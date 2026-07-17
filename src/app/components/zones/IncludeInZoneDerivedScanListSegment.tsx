import type { IncludeInZoneDerivedScanListOverride } from '@core/models/zoneBehaviourDefaults.ts';
import GradientSegmentedControl from '../ui/GradientSegmentedControl.tsx';

export interface IncludeInZoneDerivedScanListSegmentProps {
  value: IncludeInZoneDerivedScanListOverride;
  onChange: (value: IncludeInZoneDerivedScanListOverride) => void;
  /** Omit Default option (library defaults page). */
  includeDefault?: boolean;
  compact?: boolean;
  disabled?: boolean;
  /** Override the field label (ignored when `compact` and no override). */
  label?: string;
}

const WITH_DEFAULT = [
  { value: 'skip', label: 'Skip' },
  { value: 'default', label: 'Default' },
  { value: 'include', label: 'Include' },
] as const;

const WITHOUT_DEFAULT = [
  { value: 'skip', label: 'Skip' },
  { value: 'include', label: 'Include' },
] as const;

export default function IncludeInZoneDerivedScanListSegment({
  value,
  onChange,
  includeDefault = true,
  compact = false,
  disabled = false,
  label,
}: IncludeInZoneDerivedScanListSegmentProps) {
  const data = includeDefault ? WITH_DEFAULT : WITHOUT_DEFAULT;
  const resolved = includeDefault
    ? value
    : value === 'default'
      ? 'include'
      : value === 'skip'
        ? 'skip'
        : 'include';

  const resolvedLabel = label ?? (compact ? undefined : 'Zone-derived scan list');

  return (
    <GradientSegmentedControl
      label={resolvedLabel}
      description={
        compact
          ? undefined
          : includeDefault
            ? 'Default defers to library zone defaults (and build overrides). Include / Skip override for this membership.'
            : 'Library default for whether zone members participate in zone-derived scan lists (DM32, Anytone, …).'
      }
      value={resolved}
      onChange={(next) => onChange(next as IncludeInZoneDerivedScanListOverride)}
      data={[...data]}
      scheme={includeDefault ? 'three' : 'onOff'}
      fullWidth={!compact}
      size={compact ? 'xs' : undefined}
      disabled={disabled}
    />
  );
}
