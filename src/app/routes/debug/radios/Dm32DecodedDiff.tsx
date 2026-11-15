import { Stack, Text, Title } from '@mantine/core';
import { compareDm32Evidence } from '@integrations/radio-io/radios/dm32uv/debugCompare.ts';
import type { DebugDecodedDiffProps } from './descriptors.ts';

export function Dm32DecodedDiff({ first, second }: DebugDecodedDiffProps) {
  return (
    <Stack>
      <Title order={4}>Decoded evidence</Title>
      <Text size="sm">
        Missing or invalid values are unavailable. Sparse runs with different partitions may be
        incomparable.
      </Text>
      {compareDm32Evidence(first, second).map(({ field, left, right, status }) => (
        <Text key={field} size="sm">
          {field}: {status} · {left === undefined ? 'Not captured' : JSON.stringify(left)} →{' '}
          {right === undefined ? 'Not captured' : JSON.stringify(right)}
        </Text>
      ))}
    </Stack>
  );
}
