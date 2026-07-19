import { List, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import type { FormatId } from '@core/import-export/types.ts';
import {
  listPowerLadderHints,
  type PowerLadderProfileKey,
} from '@core/import-export/powerLadderHints.ts';
import { useFormatBuilds } from '../../state/useFormatBuilds.ts';

export interface PowerLadderHintsProps {
  /** Library channel power percent, or null for radio default. */
  power: number | null;
}

function formatHintLine(wire: string, approxWatts?: string): string {
  if (approxWatts) return `${wire} ≈ ${approxWatts}`;
  return wire;
}

/**
 * Read-only cheat sheet: how the current power percent maps on configured
 * export profiles (or all shipped ladders when the project has no builds).
 */
export default function PowerLadderHints({ power }: PowerLadderHintsProps) {
  const { builds } = useFormatBuilds();

  const buildProfiles = useMemo((): PowerLadderProfileKey[] => {
    return builds.map((build) => ({
      formatId: build.formatId as FormatId,
      profileId: build.profileId,
    }));
  }, [builds]);

  const rows = useMemo(
    () => listPowerLadderHints(power, buildProfiles),
    [power, buildProfiles],
  );

  if (rows.length === 0) return null;

  const scopeNote =
    buildProfiles.length > 0
      ? 'From this project’s format builds'
      : 'No builds yet — showing all shipped radio profiles';

  return (
    <Stack gap={4}>
      <Text size="xs" c="dimmed">
        Approximate watts by export profile ({scopeNote}). Informational only — does not change
        saved power.
      </Text>
      <List size="xs" spacing={2} c="dimmed">
        {rows.map((row) => (
          <List.Item key={`${row.formatId}:${row.profileId}`}>
            <Text size="xs" span>
              {row.label}: {formatHintLine(row.wire, row.approxWatts)}
              {row.isRadioDefault ? ' (radio default)' : ''}
            </Text>
          </List.Item>
        ))}
      </List>
    </Stack>
  );
}
