import { Alert, Badge, Button, Group, Stack, Text, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import type { DebugCompareExtraProps } from './descriptors.ts';
import { compareAtD890, type AtD890UnitVerdict } from './atD890Compare.ts';
import type { AtD890ReadRange } from './atD890Provenance.ts';
import { formatAddress } from './viewerUtils.ts';

const PAGE_SIZE = 30;
const VERDICT: Record<AtD890UnitVerdict, string> = {
  same: 'Same (per archive claims)',
  different: 'Different (per archive claims)',
  unknown: 'Unknown',
};
function Pager({
  page,
  pages,
  onPage,
  label,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
  label: string;
}) {
  return (
    <Group>
      <Button
        variant="default"
        disabled={page === 0}
        aria-label={`Previous ${label} page`}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </Button>
      <Text>
        {label} page {page + 1} of {pages}
      </Text>
      <Button
        variant="default"
        disabled={page + 1 >= pages}
        aria-label={`Next ${label} page`}
        onClick={() => onPage(page + 1)}
      >
        Next
      </Button>
    </Group>
  );
}

function usePaged<T>(items: readonly T[]) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  return {
    slice: items.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE),
    page: current,
    pages,
    setPage,
  };
}

/** Claims one capture makes about a range, never evidence of the physical responding unit. */
function claim(range?: AtD890ReadRange): string {
  if (!range) return 'not captured';
  const requested = range.requestedUnit
    ? `requested ${range.requestedUnit}`
    : 'sparse configuration';
  const responding = range.respondingUnit ?? 'Unknown';
  const repeat =
    range.bothReadsMatched === true
      ? 'repeat read matched (claim)'
      : range.bothReadsMatched === false
        ? 'repeat read did not match (claim)'
        : 'repeat read n/a';
  return `${requested} · responding unit: ${responding} · ${repeat}`;
}

function Captures({ first, second }: DebugCompareExtraProps) {
  return (
    <Text size="sm">
      First capture: {first.manifest.capturedAt} · second capture: {second.manifest.capturedAt}
    </Text>
  );
}

/**
 * What the D890 adds to the shared compare: the acquisition claims per range, the responding-unit
 * verdict and the provenance divergence. The byte summary, hex diff (password bytes masked there)
 * and decoded changes come from the shared `RadioCompare`.
 */
export function AtD890Compare({ first, second }: DebugCompareExtraProps) {
  const spans = useMemo(() => compareAtD890(first, second), [first, second]);
  const spanPages = usePaged(spans ?? []);
  // The shared view already says the claim is missing or invalid; nothing more to add.
  if (!spans) return null;
  const diverged = spans.filter((s) => s.provenanceDiffers.length > 0);
  return (
    <Stack>
      <Alert title="Provenance limits">
        Acquisition metadata is an archive claim. A responding unit is Same or Different only when
        both archives explicitly name one; equal bytes, serials, labels or a matching repeat read
        never establish it or validate calibration.
      </Alert>
      <Captures first={first} second={second} />
      <Title order={4}>Acquisition ranges (claims)</Title>
      {spanPages.slice.map((span) => (
        <div key={`${span.space}:${span.start}:${span.first?.regionId ?? ''}`}>
          <Text>
            {span.space} · {formatAddress(span.start)}–{formatAddress(span.end - 1)} ·{' '}
            {span.space === 'unclassified'
              ? 'Outside the AT-D890UV memory map; unclassified, not compared'
              : span.changed === undefined
                ? 'Missing or ambiguous bytes; incomparable'
                : `${span.changed} changed bytes`}{' '}
            · responding unit: {VERDICT[span.unitVerdict]}
          </Text>
          <Text size="sm" c="dimmed">
            First: {claim(span.first)}
          </Text>
          <Text size="sm" c="dimmed">
            Second: {claim(span.second)}
          </Text>
        </div>
      ))}
      {!spans.length && <Text>No captured ranges to compare.</Text>}
      <Pager
        page={spanPages.page}
        pages={spanPages.pages}
        onPage={spanPages.setPage}
        label="Range"
      />
      <Title order={4}>Provenance divergence</Title>
      <Text size="sm">
        Claims that differ between captures, separate from whether the bytes differ.
      </Text>
      {!diverged.length && <Text>No differing acquisition claims in the compared ranges.</Text>}
      {diverged.slice(0, PAGE_SIZE).map((span) => (
        <Group key={`${span.space}:${span.start}`} gap="xs">
          <Badge variant="light">{span.space}</Badge>
          <Text size="sm">
            {formatAddress(span.start)}: {span.provenanceDiffers.join(', ')} differ
          </Text>
        </Group>
      ))}
      {diverged.length > PAGE_SIZE && (
        <Text size="sm">{diverged.length - PAGE_SIZE} more ranges with differing claims.</Text>
      )}
    </Stack>
  );
}
