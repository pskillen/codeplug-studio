import { Alert, Badge, Button, Group, Select, Stack, Text, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import type { DebugDecodedDiffProps } from './descriptors.ts';
import { compareAtD890, type AtD890UnitVerdict } from './atD890Compare.ts';
import type { AtD890ReadRange } from './atD890Provenance.ts';
import {
  AT_D890_DIFF_DOMAIN_LABELS,
  diffAtD890Decoded,
  type AtD890DiffDomain,
} from './atD890DecodedDiff.ts';
import { SensitiveRevealButton } from './SensitiveReveal.tsx';
import { useSensitiveReveal } from './useSensitiveReveal.ts';
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

function Captures({ first, second }: DebugDecodedDiffProps) {
  return (
    <Text size="sm">
      First capture: {first.manifest.capturedAt} · second capture: {second.manifest.capturedAt}
    </Text>
  );
}

function DecodedChanges({
  first,
  second,
  revealed,
  onToggleReveal,
}: DebugDecodedDiffProps & { revealed: boolean; onToggleReveal: () => void }) {
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
      {rows.some((r) => r.sensitive) && (
        <Group gap="xs">
          <Text size="sm">
            Password values are {revealed ? 'shown' : 'hidden'} in the decoded differences.
          </Text>
          <SensitiveRevealButton revealed={revealed} onToggle={onToggleReveal} />
        </Group>
      )}
      {!rows.length && <Text>No decoded differences found in the captured data.</Text>}
      {paged.slice.map((row) => (
        <div key={`${row.domain}:${row.key}`} role="group" aria-label={`${row.domain} ${row.key}`}>
          <Text fw={600}>
            {AT_D890_DIFF_DOMAIN_LABELS[row.domain]} · {row.key}
            {row.label ? ` · ${row.label}` : ''} ·{' '}
            {row.kind === 'incomparable' ? 'not comparable' : row.kind}
          </Text>
          {row.note && <Text size="sm">{row.note}</Text>}
          {row.sensitive && !revealed && (
            <Text size="sm">
              {row.changes.length ? 'Password changed (values hidden)' : 'Password not comparable'}
            </Text>
          )}
          {(!row.sensitive || revealed) &&
            row.changes.map((c) => (
              <Text size="sm" key={c.field}>
                {c.field}: {c.before} → {c.after}
              </Text>
            ))}
          {row.caveats.map((c) => (
            <Text size="sm" c="dimmed" key={c}>
              Caveat: {c}
            </Text>
          ))}
          {row.unavailable.length > 0 && (!row.sensitive || revealed) && (
            <details>
              <summary>
                Not captured on at least one side ({row.unavailable.length}):{' '}
                {row.unavailable
                  .slice(0, 3)
                  .map((u) => u.field)
                  .join(', ')}
                {row.unavailable.length > 3 ? ', …' : ''}
              </summary>
              {row.unavailable.map((u) => (
                <Text size="sm" c="dimmed" key={u.field}>
                  {u.field}: first {u.before ?? 'not captured'} · second {u.after ?? 'not captured'}
                </Text>
              ))}
            </details>
          )}
        </div>
      ))}
      <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label="Decoded" />
    </Stack>
  );
}

/**
 * What the D890 adds to the shared compare: the acquisition claims per range, the responding-unit
 * verdict, the provenance divergence and the decoded changes. The byte summary and hex diff
 * (password bytes masked there) come from the shared `RadioCompare`.
 */
export function AtD890Compare({ first, second }: DebugDecodedDiffProps) {
  const spans = useMemo(() => compareAtD890(first, second), [first, second]);
  const spanPages = usePaged(spans ?? []);
  const reveal = useSensitiveReveal(first);
  if (!spans)
    return (
      <Stack>
        <Alert title="Provenance unavailable">
          The acquisition claim is missing, malformed or inconsistent with stored regions. Byte
          comparison is refused; decoded differences below do not make those bytes trusted.
        </Alert>
        <Captures first={first} second={second} />
        <DecodedChanges
          first={first}
          second={second}
          revealed={reveal.revealed}
          onToggleReveal={reveal.toggle}
        />
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
      <DecodedChanges
        first={first}
        second={second}
        revealed={reveal.revealed}
        onToggleReveal={reveal.toggle}
      />
    </Stack>
  );
}
