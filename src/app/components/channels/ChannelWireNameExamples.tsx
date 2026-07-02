import { Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import {
  CHANNEL_WIRE_NAME_PREVIEW_LIMIT,
  channelWireNamePreviewExamples,
} from '@core/import-export/channelExpansion/channelWireNamePreview.ts';

export interface ChannelWireNameExamplesProps {
  callsign: string;
  name: string;
  abbreviation: string;
}

export default function ChannelWireNameExamples({
  callsign,
  name,
  abbreviation,
}: ChannelWireNameExamplesProps) {
  const examples = useMemo(
    () =>
      channelWireNamePreviewExamples({
        callsign,
        name,
        abbreviation: abbreviation.trim() || undefined,
      }),
    [abbreviation, callsign, name],
  );

  const hasAnyName = callsign.trim() || name.trim();
  if (!hasAnyName) return null;

  return (
    <Stack gap={4}>
      <Text size="xs" c="dimmed">
        Export wire names (informational) — how each name style would appear on a CPS channel row,
        then after automatic shortening to {CHANNEL_WIRE_NAME_PREVIEW_LIMIT} characters (typical
        OpenGD77 limit). When set, your abbreviation is tried before dictionary shortening (disable
        per export on the build export page).
      </Text>
      <Stack gap={2}>
        {examples.map((row) => (
          <Text key={row.mode} size="xs" c="dimmed" ff="monospace">
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
