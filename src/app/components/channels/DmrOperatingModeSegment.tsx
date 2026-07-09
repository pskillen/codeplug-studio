import type { DmrOperatingMode } from '@core/models/libraryTypes.ts';
import { inferDmrOperatingMode } from '@core/domain/dmrOperatingMode.ts';
import GradientSegmentedControl from '../ui/GradientSegmentedControl.tsx';

export interface DmrOperatingModeSegmentProps {
  value: DmrOperatingMode | null;
  onChange: (dmrMode: DmrOperatingMode | null) => void;
  rxFrequency: number | null;
  txFrequency: number | null;
  disabled?: boolean;
}

const OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'dmo-simplex', label: 'DMO' },
  { value: 'repeater', label: 'Repeater' },
] as const;

function inferredLabel(rxFrequency: number | null, txFrequency: number | null): string {
  const inferred = inferDmrOperatingMode({ rxFrequency, txFrequency });
  return inferred === 'repeater' ? 'Repeater (split RX/TX)' : 'DMO / simplex (equal RX/TX)';
}

export default function DmrOperatingModeSegment({
  value,
  onChange,
  rxFrequency,
  txFrequency,
  disabled = false,
}: DmrOperatingModeSegmentProps) {
  const inferred = inferredLabel(rxFrequency, txFrequency);

  return (
    <GradientSegmentedControl
      label="DMR operating mode"
      description={
        value == null
          ? `Auto uses frequencies: default is ${inferred}.`
          : 'Explicit mode overrides frequency inference at export.'
      }
      value={value ?? 'auto'}
      onChange={(next) => onChange(next === 'auto' ? null : (next as DmrOperatingMode))}
      data={[...OPTIONS]}
      scheme="three"
      fullWidth
      disabled={disabled}
    />
  );
}
