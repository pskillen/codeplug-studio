import {
  compareVerdict,
  fieldCounts,
  hexHunks,
  type ByteComparison,
  type DecodedDiff,
  type CompareSection,
} from '@integrations/radio-io/debugCompare/index.ts';
import { Alert, Badge, Button, CopyButton, Group, Stack, Table, Text } from '@mantine/core';
import { useMemo } from 'react';
import { formatAddress } from '../viewerUtils.ts';

const MAX_LISTED_ROWS = 32;

const KIND_LABEL: Record<CompareSection['kind'], string> = {
  compared: 'compared',
  reported: 'reported only',
  skipped: 'skipped',
  incomparable: 'incomparable',
};

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

const rangeOf = (s: CompareSection) => {
  const length = Math.max(s.a?.length ?? 0, s.b?.length ?? 0);
  return length ? `${formatAddress(s.base)}–${formatAddress(s.base + length - 1)}` : '—';
};

/** Addresses of the changed 16-byte rows of a section, for the changed-region list. */
function changedRowAddresses(s: CompareSection): number[] {
  return hexHunks(s, { context: 0 }).flatMap((h) =>
    h.kind === 'rows' ? h.rows.map((r) => r.address) : [],
  );
}

function Result({ s }: { s: CompareSection }) {
  if (s.kind === 'skipped' || s.kind === 'incomparable')
    return <Badge color="gray">{KIND_LABEL[s.kind]}</Badge>;
  if (s.changed > 0 || s.missing > 0)
    return (
      <Group gap={6}>
        {s.changed > 0 && <Badge color="yellow">{plural(s.changed, 'byte')}</Badge>}
        {s.missing > 0 && (
          <Badge color="yellow" variant="outline">
            {plural(s.missing, 'byte')} on one side only
          </Badge>
        )}
      </Group>
    );
  return <Badge color="green">identical</Badge>;
}

function ChangedRows({ section }: { section: CompareSection }) {
  const rows = useMemo(() => changedRowAddresses(section), [section]);
  if (!rows.length) return null;
  const listed = rows.slice(0, MAX_LISTED_ROWS).map(formatAddress);
  const more = rows.length - listed.length;
  const all = rows.map(formatAddress).join('\n');
  return (
    <Group gap="xs" mt={4} wrap="wrap">
      <Text size="xs" c="dimmed">
        Changed rows: {listed.join(', ')}
        {more > 0 ? `, +${more} more` : ''}
        {section.runsTruncated ? ' (run list truncated)' : ''}
      </Text>
      <CopyButton value={all}>
        {({ copied, copy }) => (
          <Button
            variant="subtle"
            size="compact-xs"
            aria-label={`Copy changed row addresses of ${section.label}`}
            onClick={(event) => {
              event.stopPropagation();
              copy();
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        )}
      </CopyButton>
    </Group>
  );
}

/**
 * The verdict first: green Identical, amber changed, grey nothing comparable. Under it one row per
 * region; choosing a row asks the hex diff to show that region, filtered to its changes.
 */
export function CompareSummary({
  comparison,
  onJump,
  decoded,
  onJumpCategory,
}: {
  comparison: ByteComparison;
  onJump: (sectionId: string) => void;
  /** The decoded diff, when the radio has one: adds the fields-by-category table. */
  decoded?: DecodedDiff;
  onJumpCategory?: (domainId: string) => void;
}) {
  const counts = useMemo(() => (decoded ? fieldCounts(decoded) : []), [decoded]);
  const totalFields = counts.reduce((n, c) => n + c.changedFields, 0);
  const totalRecords = counts.reduce((n, c) => n + c.changedRecords, 0);
  const { verdict, changedBytes, changedSections, notCompared } = compareVerdict(comparison);
  const compared = comparison.sections.filter((s) => s.kind === 'compared');
  const comparedBytes = compared.reduce(
    (n, s) => n + Math.max(s.a?.length ?? 0, s.b?.length ?? 0),
    0,
  );
  const gaps = compared.reduce((n, s) => n + s.missing, 0);
  const reportedDiffer = comparison.sections.filter((s) => s.kind === 'reported' && s.changed > 0);
  return (
    <Stack>
      {verdict === 'identical' && (
        <Alert color="green" title="Identical">
          A and B match in every compared region ({plural(compared.length, 'region')},{' '}
          {plural(comparedBytes, 'byte')}).
        </Alert>
      )}
      {verdict === 'changed' && (
        <Alert color="yellow" title="A and B differ">
          {plural(changedBytes, 'changed byte')} in {plural(changedSections, 'region')}
          {decoded
            ? ` · ${plural(totalFields, 'changed field')} in ${plural(totalRecords, 'record')}`
            : ''}
          {gaps > 0 ? `; ${plural(gaps, 'byte')} present on one side only` : ''}.
        </Alert>
      )}
      {verdict === 'nothing-compared' && (
        <Alert color="gray" title="Nothing comparable">
          No region could be compared: none has a common address space and byte representation on
          both sides.
        </Alert>
      )}
      {(notCompared.length > 0 || reportedDiffer.length > 0) && verdict !== 'nothing-compared' && (
        <Text size="sm" c="dimmed">
          {notCompared.length > 0 &&
            `Not compared: ${notCompared.map((s) => `${s.label} (${KIND_LABEL[s.kind]})`).join(', ')}. `}
          {reportedDiffer.length > 0 &&
            `Reported only, differ: ${reportedDiffer.map((s) => s.label).join(', ')}.`}
        </Text>
      )}
      <Table withTableBorder aria-label="Bytes by region">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Region</Table.Th>
            <Table.Th>Range</Table.Th>
            <Table.Th>Kind</Table.Th>
            <Table.Th>Result</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {comparison.sections.map((s) => {
            const jumpable = Boolean(s.a && s.b);
            return (
              <Table.Tr
                key={s.id}
                style={jumpable ? { cursor: 'pointer' } : undefined}
                onClick={jumpable ? () => onJump(s.id) : undefined}
              >
                <Table.Td>
                  {jumpable ? (
                    <Button
                      variant="subtle"
                      size="compact-sm"
                      aria-label={`Show ${s.label} in the hex diff`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onJump(s.id);
                      }}
                    >
                      {s.label}
                    </Button>
                  ) : (
                    s.label
                  )}
                  {s.note && (
                    <Text size="xs" c="dimmed">
                      [{s.note}]
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>{rangeOf(s)}</Table.Td>
                <Table.Td>
                  {KIND_LABEL[s.kind]}
                  {s.reason && (
                    <Text size="xs" c="dimmed">
                      {s.reason}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Result s={s} />
                  {s.changed > 0 && s.kind !== 'incomparable' && <ChangedRows section={s} />}
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
      {decoded && decoded.domains.length > 0 && (
        <Table withTableBorder aria-label="Fields by category">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Category</Table.Th>
              <Table.Th>Changed fields</Table.Th>
              <Table.Th>Records changed</Table.Th>
              <Table.Th>Added</Table.Th>
              <Table.Th>Removed</Table.Th>
              <Table.Th>Not comparable</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {decoded.domains.map((d) => {
              const c = counts.find((x) => x.domainId === d.id);
              // Unknown, never zero: nothing of this category was captured on one side.
              const cells = d.unavailable
                ? Array<string>(5).fill('not captured')
                : [c?.changedFields ?? 0, d.changed, d.added, d.removed, d.incomparable];
              return (
                <Table.Tr key={d.id}>
                  <Table.Td>
                    <Button
                      variant="subtle"
                      size="compact-sm"
                      aria-label={`Show ${d.label} in the decoded diff`}
                      onClick={() => onJumpCategory?.(d.id)}
                    >
                      {d.label}
                    </Button>
                    {d.unavailable && d.note && (
                      <Text size="xs" c="dimmed">
                        {d.note}
                      </Text>
                    )}
                  </Table.Td>
                  {cells.map((cell, i) => (
                    <Table.Td key={i} c={d.unavailable ? 'dimmed' : undefined}>
                      {cell}
                    </Table.Td>
                  ))}
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
