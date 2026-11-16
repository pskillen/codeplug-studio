import {
  hexHunks,
  type CompareSection,
  type HexRow,
} from '@integrations/radio-io/debugCompare/index.ts';
import type { DebugSensitiveRange } from '@integrations/radio-io/debugSensitive.ts';
import {
  Button,
  Group,
  Mark,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { useMemo, useState, type ReactNode } from 'react';
import { formatAddress, HEX_PAGE_BYTES, isMasked, MASKED_HEX_BYTE } from '../viewerUtils.ts';

const HUNKS_PER_PAGE = 20;
const ROWS_PER_HUNK = 8;
const CONTEXTS = ['0', '1', '2', '4'];
const MONO = { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 13 } as const;

/** The 16 bytes (or fewer) of one side of a row; differing bytes are marked, masked ones read ••. */
function Side({
  label,
  bytes,
  other,
  row,
  base,
  mask,
}: {
  label: string;
  bytes: Uint8Array;
  other: Uint8Array;
  row: HexRow;
  base: number;
  mask: readonly DebugSensitiveRange[];
}) {
  const cells: ReactNode[] = [];
  for (let i = 0; i < row.length; i++) {
    const at = row.offset + i;
    const text = isMasked(base + at, mask)
      ? MASKED_HEX_BYTE
      : bytes[at]!.toString(16).padStart(2, '0');
    // Compared on the raw bytes: a masked byte that differs is still marked.
    cells.push(
      bytes[at] !== other[at] ? (
        <Mark key={i} color="yellow" fw={700}>
          {text}
        </Mark>
      ) : (
        <span key={i}>{text}</span>
      ),
      ' ',
    );
  }
  return (
    <div style={{ whiteSpace: 'pre' }}>
      {label} {cells}
    </div>
  );
}

export interface HexDiffProps {
  section: CompareSection;
  /** Password ranges of A and of B in absolute addresses; masked until `revealed`. */
  rangesA: readonly DebugSensitiveRange[];
  rangesB: readonly DebugSensitiveRange[];
  revealed: boolean;
  onlyChanged: boolean;
  onOnlyChangedChange: (value: boolean) => void;
}

/**
 * A over B in 16-byte rows on absolute boundaries, changed bytes marked. Filtered to the changed
 * rows plus context by default when anything differs; Previous/Next change and Go to address.
 */
export function HexDiff({
  section,
  rangesA,
  rangesB,
  revealed,
  onlyChanged,
  onOnlyChangedChange,
}: HexDiffProps) {
  const [context, setContext] = useState('1');
  const [page, setPage] = useState(0);
  const [focus, setFocus] = useState<number | null>(null);
  const [jump, setJump] = useState('');
  const [jumpError, setJumpError] = useState<string>();
  const a = section.a!;
  const b = section.b!;
  const shared = Math.min(a.length, b.length);
  const maskA = revealed ? [] : rangesA;
  const maskB = revealed ? [] : rangesB;
  const changedRows = useMemo(
    () => hexHunks(section, { context: 0 }).flatMap((h) => (h.kind === 'rows' ? h.rows : [])),
    [section],
  );
  const hunks = useMemo(
    () =>
      onlyChanged
        ? hexHunks(section, { context: Number(context) }).flatMap((h) =>
            // One long run of changed rows is split so a page never renders thousands of rows.
            h.kind === 'rows' && h.rows.length > ROWS_PER_HUNK
              ? Array.from({ length: Math.ceil(h.rows.length / ROWS_PER_HUNK) }, (_, i) => ({
                  ...h,
                  rows: h.rows.slice(i * ROWS_PER_HUNK, (i + 1) * ROWS_PER_HUNK),
                }))
              : [h],
          )
        : [],
    [section, onlyChanged, context],
  );
  const fullPages = Math.max(1, Math.ceil(shared / HEX_PAGE_BYTES));
  const pages = onlyChanged ? Math.max(1, Math.ceil(hunks.length / HUNKS_PER_PAGE)) : fullPages;
  const current = Math.min(page, pages - 1);

  const rowFor = (address: number): HexRow => {
    const start = Math.max(address, section.base);
    const end = Math.min(address + 16, section.base + shared);
    const known = changedRows.find((r) => r.address === address);
    return {
      address,
      offset: start - section.base,
      length: end - start,
      changed: known?.changed ?? 0,
    };
  };
  /** Page of the current view that shows the row at `address`. */
  const pageOf = (address: number) => {
    if (!onlyChanged) return Math.floor((address - section.base) / HEX_PAGE_BYTES);
    const at = hunks.findIndex(
      (h) => h.kind === 'rows' && h.rows.some((r) => r.address === address),
    );
    return Math.max(0, Math.floor(at / HUNKS_PER_PAGE));
  };
  const goTo = (row: HexRow) => {
    setFocus(row.address);
    setPage(pageOf(row.address));
  };
  const next = changedRows.find((r) => focus === null || r.address > focus);
  const previous = [...changedRows].reverse().find((r) => focus === null || r.address < focus);

  const goToAddress = () => {
    const text = jump.trim().replace(/^0x/i, '');
    const target = /^[0-9a-f]+$/i.test(text) ? parseInt(text, 16) : NaN;
    if (!Number.isFinite(target) || target < section.base || target >= section.base + shared) {
      setJumpError(
        `Address is outside this region (${formatAddress(section.base)}–${formatAddress(section.base + Math.max(0, shared - 1))}).`,
      );
      return;
    }
    setJumpError(undefined);
    const address = Math.floor(target / 16) * 16;
    // The full view always has the row; a filtered one may have dropped it.
    setFocus(address);
    setPage(Math.floor((target - section.base) / HEX_PAGE_BYTES));
    onOnlyChangedChange(false);
  };

  const renderRow = (row: HexRow) => (
    <div
      key={row.address}
      data-row-address={formatAddress(row.address)}
      aria-current={focus === row.address ? 'true' : undefined}
      style={{
        ...MONO,
        display: 'flex',
        gap: 12,
        padding: '2px 4px',
        outline: focus === row.address ? '2px solid var(--mantine-color-blue-5)' : undefined,
      }}
    >
      <span style={{ width: '3.5em', textAlign: 'right', whiteSpace: 'pre' }}>
        {row.changed ? `${row.changed}≠` : ''}
      </span>
      <span>{formatAddress(row.address)}</span>
      <div>
        <Side label="A" bytes={a} other={b} row={row} base={section.base} mask={maskA} />
        <Side label="B" bytes={b} other={a} row={row} base={section.base} mask={maskB} />
        {!revealed &&
          Array.from({ length: row.length }, (_, i) => i).some(
            (i) =>
              (isMasked(section.base + row.offset + i, maskA) ||
                isMasked(section.base + row.offset + i, maskB)) &&
              a[row.offset + i] !== b[row.offset + i],
          ) && <Text size="xs">[masked bytes differ]</Text>}
      </div>
    </div>
  );

  let body: ReactNode;
  if (onlyChanged) {
    const slice = hunks.slice(current * HUNKS_PER_PAGE, (current + 1) * HUNKS_PER_PAGE);
    body = slice.map((h, i) =>
      h.kind === 'rows' ? (
        <div key={`r${current}-${i}`}>{h.rows.map(renderRow)}</div>
      ) : (
        <Text key={`i${current}-${i}`} size="sm" c="dimmed" my={4}>
          … {formatAddress(h.start)}–{formatAddress(h.end)} identical ({h.rows}{' '}
          {h.rows === 1 ? 'row' : 'rows'})
        </Text>
      ),
    );
  } else {
    const rows: HexRow[] = [];
    const from = section.base + current * HEX_PAGE_BYTES;
    const to = Math.min(from + HEX_PAGE_BYTES, section.base + shared);
    for (let address = Math.floor(from / 16) * 16; address < to; address += 16)
      rows.push(rowFor(address));
    body = rows.map(renderRow);
  }
  const shorter = a.length < b.length ? 'A' : b.length < a.length ? 'B' : undefined;

  return (
    <Stack gap="xs">
      <Group align="flex-end" wrap="wrap">
        <Switch
          label="Only changed rows"
          checked={onlyChanged}
          onChange={(event) => {
            onOnlyChangedChange(event.currentTarget.checked);
            setPage(0);
          }}
        />
        {onlyChanged && (
          <div>
            <Text size="xs">Context rows</Text>
            <SegmentedControl
              size="xs"
              aria-label="Context rows"
              data={CONTEXTS}
              value={context}
              onChange={(value) => {
                setContext(value);
                setPage(0);
              }}
            />
          </div>
        )}
        <Button
          variant="default"
          size="xs"
          disabled={!previous}
          onClick={() => previous && goTo(previous)}
        >
          Previous change
        </Button>
        <Button variant="default" size="xs" disabled={!next} onClick={() => next && goTo(next)}>
          Next change
        </Button>
        <TextInput
          aria-label="Go to address"
          placeholder="Address, e.g. 0x3B00"
          size="xs"
          value={jump}
          error={jumpError}
          onChange={(event) => setJump(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') goToAddress();
          }}
        />
        <Button variant="default" size="xs" onClick={goToAddress}>
          Go
        </Button>
      </Group>
      <div style={{ overflowX: 'auto' }} role="group" aria-label="Hex diff">
        {body}
        {shorter && (
          <Text size="sm" c="dimmed" my={4}>
            {shorter} has no bytes after {formatAddress(section.base + shared - 1)} (counted as
            missing, not changed).
          </Text>
        )}
        {section.runsTruncated && (
          <Text size="sm" c="dimmed" my={4}>
            Only the first changed runs are marked; the changed-byte count above is exact.
          </Text>
        )}
      </div>
      <Group>
        <Button
          variant="default"
          size="xs"
          disabled={current === 0}
          onClick={() => setPage(current - 1)}
        >
          Previous page
        </Button>
        <Text size="sm">
          Page {current + 1} of {pages}
        </Text>
        <Button
          variant="default"
          size="xs"
          disabled={current + 1 >= pages}
          onClick={() => setPage(current + 1)}
        >
          Next page
        </Button>
      </Group>
    </Stack>
  );
}
