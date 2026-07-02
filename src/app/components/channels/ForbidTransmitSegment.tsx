import { Input, SegmentedControl, Stack } from '@mantine/core';

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
  const isRxOnly = value === true;
  return (
    <Stack gap={4}>
      <Input.Label>Transmit</Input.Label>
      <SegmentedControl
        value={isRxOnly ? 'true' : 'false'}
        onChange={(next) => onChange(next === 'true')}
        data={[...OPTIONS]}
        fullWidth
      />
    </Stack>
  );
}
