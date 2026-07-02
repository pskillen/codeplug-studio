import { Input, SegmentedControl, Stack } from '@mantine/core';

export interface ForbidTransmitSegmentProps {
  value: boolean;
  onChange: (forbidTransmit: boolean) => void;
}

const OPTIONS = [
  { value: 'false', label: 'Allow TX' },
  { value: 'true', label: 'RX only' },
] as const;

export default function ForbidTransmitSegment({ value, onChange }: ForbidTransmitSegmentProps) {
  return (
    <Stack gap={4}>
      <Input.Label>Transmit</Input.Label>
      <SegmentedControl
        value={String(value)}
        onChange={(next) => onChange(next === 'true')}
        data={[...OPTIONS]}
        fullWidth
      />
    </Stack>
  );
}
