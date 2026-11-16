import { Stack, Text, Title } from '@mantine/core';
import {
  compareOpenGd77Evidence,
  isOpenGd77InvalidEvidence,
} from '@integrations/radio-io/radios/opengd77/debugCompare.ts';
import type { DebugDecodedDiffProps } from './descriptors.ts';

/** Missing or invalid is "Not captured" / "Unavailable", never the word null or a guess. */
const show = (value: unknown) =>
  isOpenGd77InvalidEvidence(value)
    ? `Invalid FirmwareInfo: ${value.invalid}`
    : value === undefined
      ? 'Not captured'
      : value === null
        ? 'Unavailable'
        : JSON.stringify(value);

export function OpenGd77DecodedDiff({ first, second }: DebugDecodedDiffProps) {
  return (
    <Stack>
      <Title order={4}>Decoded evidence</Title>
      <Text size="sm">
        User Database regions are packed, so bytes are compared as stored. Regions whose address
        space is unknown are incomparable.
      </Text>
      {compareOpenGd77Evidence(first, second).map(({ field, left, right, status }) => (
        <Text key={field} size="sm">
          {field}: {status} · {show(left)} → {show(right)}
        </Text>
      ))}
    </Stack>
  );
}
