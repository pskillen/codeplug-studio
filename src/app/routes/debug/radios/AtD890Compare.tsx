import { Alert, Badge, Button, Group, Select, Stack, Text, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import type { DebugDecodedDiffProps } from './descriptors.ts';
import { compareAtD890, type AtD890UnitVerdict } from './atD890Compare.ts';
import {
  AT_D890_DIFF_DOMAIN_LABELS,
  diffAtD890Decoded,
  type AtD890DiffDomain,
} from './atD890DecodedDiff.ts';
import { formatAddress } from './viewerUtils.ts';

const PAGE_SIZE = 30;
const VERDICT: Record<AtD890UnitVerdict, string> = {
  same: 'Same (per archive claims)',
  different: 'Different (per archive claims)',
  unknown: 'Unknown',
};
const hex = (bytes: readonly number[]) =>
  bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

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

function Captures({ first, second }: DebugDecodedDiffProps) {
  return (
    <Text size="sm">
      First capture: {first.manifest.capturedAt} · second capture: {second.manifest.capturedAt}
    </Text>
  );
}

function DecodedChanges({ first, second }: DebugDecodedDiffProps) {
  const diff = useMemo(() => diffAtD890Decoded(first, second), [first, second]);
  const [domain, setDomain] = useState<string | null>(null);
  const rows = useMemo(
    () => (diff?.rows ?? []).filter((r) => !domain || r.domain === domain),
    [diff, domain],
  );
  const paged = usePaged(rows);
  if (!diff) return null;
  return (
    <Stack>
      <Title order={4}>Decoded differences</Title>
      <Text size="sm">
        Records are matched by radio slot; settings and calibration by field. A value or record that
        was not captured is unavailable, not zero and not deleted. Additions and removals are shown
        only when both captures have their occupancy bitmap.
      </Text>
      {diff.domains
        .filter((d) => d.uncapturedBoth > 0)
        .map((d) => (
          <Text size="sm" key={`unc-${d.domain}`}>
            {AT_D890_DIFF_DOMAIN_LABELS[d.domain]}: {d.uncapturedBoth} matched entries were not
            captured in either capture and are not listed.
          </Text>
        ))}
      {diff.domains
        .filter((d) => d.note || !d.occupancyComparable)
        .map((d) => (
          <Text size="sm" key={d.domain}>
            {AT_D890_DIFF_DOMAIN_LABELS[d.domain]}:{' '}
            {d.note ??
              'occupancy not captured on both sides; additions and removals are not reported.'}
          </Text>
        ))}
      <Select
        label="Show domain"
        clearable
        value={domain}
        onChange={(v) => {
          setDomain(v);
          paged.setPage(0);
        }}
        data={(Object.keys(AT_D890_DIFF_DOMAIN_LABELS) as AtD890DiffDomain[]).map((d) => ({
          value: d,
          label: AT_D890_DIFF_DOMAIN_LABELS[d],
        }))}
      />
      {!rows.length && <Text>No decoded differences found in the captured data.</Text>}
      {paged.slice.map((row) => (
        <div key={`${row.domain}:${row.key}`} role="group" aria-label={`${row.domain} ${row.key}`}>
          <Text fw={600}>
            {AT_D890_DIFF_DOMAIN_LABELS[row.domain]} · {row.key}
            {row.label ? ` · ${row.label}` : ''} ·{' '}
            {row.kind === 'incomparable' ? 'not comparable' : row.kind}
          </Text>
          {row.note && <Text size="sm">{row.note}</Text>}
          {row.changes.map((c) => (
            <Text size="sm" key={c.field}>
              {c.field}: {c.before} → {c.after}
            </Text>
          ))}
          {row.unavailable.length > 0 && (
            <Text size="sm" c="dimmed">
              Not captured on one or both sides ({row.unavailable.length}):{' '}
              {row.unavailable.slice(0, 6).join(', ')}
              {row.unavailable.length > 6 ? ', …' : ''}
            </Text>
          )}
        </div>
      ))}
      <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label="Decoded" />
    </Stack>
  );
}

/** D890 acquisition spaces are kept separate even when addresses or bytes coincide. */
export function AtD890Compare({ first, second }: DebugDecodedDiffProps) {
  const spans = useMemo(() => compareAtD890(first, second), [first, second]);
  const spanPages = usePaged(spans ?? []);
  const runs = useMemo(
    () =>
      (spans ?? []).flatMap((span) => (span.runs ?? []).map((run) => ({ space: span.space, run }))),
    [spans],
  );
  const runPages = usePaged(runs);
  if (!spans)
    return (
      <Stack>
        <Alert title="Provenance unavailable">
          The acquisition claim is missing, malformed or inconsistent with stored regions. Byte
          comparison is refused; decoded differences below do not make those bytes trusted.
        </Alert>
        <Captures first={first} second={second} />
        <DecodedChanges first={first} second={second} />
      </Stack>
    );
  const diverged = spans.filter((s) => s.provenanceDiffers.length > 0);
  return (
    <Stack>
      <Alert title="Provenance limits">
        Acquisition metadata is an archive claim. A responding unit is Same or Different only when
        both archives explicitly name one; equal bytes, serials, labels or a matching repeat read
        never establish it or validate calibration.
      </Alert>
      <Captures first={first} second={second} />
      <Title order={4}>Acquisition ranges (byte divergence)</Title>
      {spanPages.slice.map((span) => (
        <Text key={`${span.space}:${span.start}`}>
          {span.space} · {formatAddress(span.start)}–{formatAddress(span.end - 1)} ·{' '}
          {span.changed === undefined
            ? 'Missing or ambiguous bytes; incomparable'
            : `${span.changed} changed bytes`}{' '}
          · responding unit: {VERDICT[span.unitVerdict]} · repeat read:{' '}
          {span.first?.bothReadsMatched === true && span.second?.bothReadsMatched === true
            ? 'both claims matched'
            : 'Unknown or not applicable'}
        </Text>
      ))}
      {!spans.length && <Text>No captured ranges to compare.</Text>}
      <Pager
        page={spanPages.page}
        pages={spanPages.pages}
        onPage={spanPages.setPage}
        label="Range"
      />
      <Title order={4}>Changed byte runs</Title>
      {!runs.length && <Text>No differing bytes in the comparable ranges.</Text>}
      {runPages.slice.map(({ space, run }) => (
        <Text key={`${space}:${run.start}`} size="sm">
          {space} · {formatAddress(run.start)}
          {run.length > 1 ? `–${formatAddress(run.start + run.length - 1)}` : ''} · {run.length}{' '}
          byte{run.length === 1 ? '' : 's'} · {hex(run.before)}
          {run.length > run.before.length ? ' …' : ''} → {hex(run.after)}
          {run.length > run.after.length ? ' …' : ''}
        </Text>
      ))}
      <Pager page={runPages.page} pages={runPages.pages} onPage={runPages.setPage} label="Run" />
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
      <DecodedChanges first={first} second={second} />
    </Stack>
  );
}
