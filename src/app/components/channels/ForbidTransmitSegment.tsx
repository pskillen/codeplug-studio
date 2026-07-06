import GradientSegmentedControl from '../ui/GradientSegmentedControl.tsx';

export interface ForbidTransmitSegmentProps {
  /** `null` / `undefined` are treated as Allow TX (same as `false`). */
  value: boolean | null | undefined;
  onChange: (forbidTransmit: boolean) => void;
}

const OPTIONS = [
  { value: 'false', label: 'Allow TX' },
  { value: 'true', label: 'RX only' },
] as const;

export default function ForbidTransmitSegment({ value, onChange }: ForbidTransmitSegmentProps) {
  const wireValue = value === true ? 'true' : 'false';
  return (
    <GradientSegmentedControl
      label="Transmit"
      value={wireValue}
      onChange={(next) => onChange(next === 'true')}
      data={[...OPTIONS]}
      scheme="allowForbid"
      fullWidth
    />
  );
}
