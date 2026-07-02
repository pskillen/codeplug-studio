import { Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import {
  talkGroupWireNamePreviewExamples,
  TALK_GROUP_WIRE_NAME_PREVIEW_LIMIT,
} from '@core/import-export/channelExpansion/talkGroupWireNamePreview.ts';

export interface TalkGroupWireNameExamplesProps {
  name: string;
  abbreviation: string;
  digitalId: number;
}

export default function TalkGroupWireNameExamples({
  name,
  abbreviation,
  digitalId,
}: TalkGroupWireNameExamplesProps) {
  const examples = useMemo(
    () =>
      talkGroupWireNamePreviewExamples({
        name,
        abbreviation: abbreviation.trim() || undefined,
        digitalId: digitalId || 0,
      }),
    [abbreviation, digitalId, name],
  );

  if (!name.trim()) return null;

  return (
    <Stack gap={4}>
      <Text size="xs" c="dimmed">
        Export wire names (informational) — sample multi-talkgroup channel suffix with callsign
        GB7GL, then after automatic shortening to {TALK_GROUP_WIRE_NAME_PREVIEW_LIMIT} characters
        (typical OpenGD77 limit). When set, your abbreviation is tried before dictionary shortening
        on DM32-style expanded rows (disable per export on the build export page when that format
        ships).
      </Text>
      <Stack gap={2}>
        {examples.map((row) => (
          <Text key={row.label} size="xs" c="dimmed" ff="monospace">
            <Text span fw={500} c="dimmed">
              {row.label}:
            </Text>{' '}
            {row.composed || '—'}
            {row.limited !== row.composed ? (
              <>
                {' '}
                →{' '}
                <Text span c="gray.6">
                  {row.limited}
                </Text>
              </>
            ) : null}
          </Text>
        ))}
      </Stack>
    </Stack>
  );
}
