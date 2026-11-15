import { Alert, Button, Group, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import type { DebugDecodedDiffProps } from './descriptors.ts';
import { compareAtD890 } from './atD890Compare.ts';
import { formatAddress } from './viewerUtils.ts';

const PAGE_SIZE = 30;

/** D890 acquisition spaces are kept separate even when addresses or bytes coincide. */
export function AtD890Compare({ first, second }: DebugDecodedDiffProps) {
  const [page, setPage] = useState(0);
  const spans = compareAtD890(first, second);
  if (!spans)
    return (
      <Alert title="Provenance unavailable">
        The acquisition claim is missing, malformed or inconsistent with stored regions. Comparison
        is refused.
      </Alert>
    );
  const pages = Math.max(1, Math.ceil(spans.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  return (
    <Stack>
      <Alert title="Provenance limits">
        Acquisition metadata is an archive claim. The physical responding unit is unknown; a
        matching repeat read does not establish it or validate calibration.
      </Alert>
      <Title order={4}>Acquisition ranges</Title>
      {spans.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE).map((span) => (
        <Text key={`${span.space}:${span.start}`}>
          {span.space} · {formatAddress(span.start)}–{formatAddress(span.end - 1)} ·{' '}
          {span.changed === undefined
            ? 'Missing or ambiguous bytes; incomparable'
            : `${span.changed} changed bytes`}{' '}
          · responding unit: Unknown · repeat read:{' '}
          {span.first?.bothReadsMatched === true && span.second?.bothReadsMatched === true
            ? 'both claims matched'
            : 'Unknown or not applicable'}
        </Text>
      ))}
      {!spans.length && <Text>No captured ranges to compare.</Text>}
      <Group>
        <Button variant="default" disabled={current === 0} onClick={() => setPage(current - 1)}>
          Previous
        </Button>
        <Text>
          Page {current + 1} of {pages}
        </Text>
        <Button
          variant="default"
          disabled={current + 1 >= pages}
          onClick={() => setPage(current + 1)}
        >
          Next
        </Button>
      </Group>
    </Stack>
  );
}
