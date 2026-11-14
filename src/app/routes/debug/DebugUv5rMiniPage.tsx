import {
  Alert,
  Badge,
  Button,
  Code,
  Group,
  Progress,
  Select,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Page, PageHeader, PageSection } from '@app/components/ui/index.ts';
import {
  grantUv5rMiniDebugPort,
  runUv5rMiniDebugFullRead,
} from '@app/services/uv5rMiniDebugRead.ts';
import { downloadZip, isoTimestampForFilename } from '@integrations/download/browserDownload.ts';
import {
  compareUv5rMiniReads,
  diffUv5rMiniChannels,
  formatUv5rMiniChannelChange,
  formatUv5rMiniSpanRange,
  formatUv5rMiniSpecialSlot,
  type Uv5rMiniCompareLine,
  type Uv5rMiniChannelDiff,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import type { ProgressUpdate } from '@integrations/radio-io/types.ts';

import Uv5rMiniCalibrationSection from './Uv5rMiniCalibrationSection.tsx';
import {
  buildUv5rMiniReadsZip,
  uv5rMiniDebugReadStore,
  useUv5rMiniDebugReads,
  type Uv5rMiniDebugRead,
} from './uv5rMiniDebugReads.ts';

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ');
const addr = (n: number) => `0x${n.toString(16).toUpperCase().padStart(4, '0')}`;
const SHOWN_OFFSETS = 32;

function readName(r: Uv5rMiniDebugRead): string {
  return `${r.label} (${r.readAt.toLocaleTimeString()})`;
}

function CompareLineRow({ line }: { line: Uv5rMiniCompareLine }) {
  const n = line.diffOffsets.length;
  let verdict;
  if (line.kind === 'skipped') {
    verdict = (
      <Text size="sm" c="dimmed">
        skipped (the radio owns it)
      </Text>
    );
  } else if (n === 0) {
    verdict = <Badge color="green">identical</Badge>;
  } else {
    const shown = line.diffOffsets.slice(0, SHOWN_OFFSETS).map(addr).join(' ');
    verdict = (
      <Stack gap={4}>
        <Badge color={line.kind === 'frame' ? 'yellow' : 'red'}>
          {n} byte{n === 1 ? '' : 's'} differ
        </Badge>
        <Code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
          {shown}
          {n > SHOWN_OFFSETS ? ` … (+${n - SHOWN_OFFSETS} more)` : ''}
        </Code>
      </Stack>
    );
  }
  const kindLabel = {
    compared: 'compared',
    calibration: 'calibration',
    frame: 'frame, reported only',
    skipped: 'log sector',
  }[line.kind];
  return (
    <Table.Tr>
      <Table.Td>
        <Code>{formatUv5rMiniSpanRange(line.span)}</Code>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{line.span.label}</Text>
        <Text size="xs" c="dimmed">
          {kindLabel}
        </Text>
      </Table.Td>
      <Table.Td>{verdict}</Table.Td>
    </Table.Tr>
  );
}

const SHOWN_CHANNELS = 200;

function ChannelDiffView({ diff }: { diff: Uv5rMiniChannelDiff }) {
  const n = diff.changes.length;
  return (
    <Stack gap="xs" data-testid="uv5r-mini-channel-diff">
      <Text fw={600}>Channels</Text>
      <Text size="sm" c="dimmed">
        {n === 0 ? 'No channel slot changed. ' : ''}
        {diff.unchangedCount} slot{diff.unchangedCount === 1 ? '' : 's'} unchanged; slots 248 and
        249 hold special data and are listed on their own.
      </Text>
      {n > 0 ? (
        <Stack gap={2}>
          {diff.changes.slice(0, SHOWN_CHANNELS).map((c) => (
            <Code key={c.slot} style={{ whiteSpace: 'normal' }}>
              {formatUv5rMiniChannelChange(c)}
            </Code>
          ))}
          {n > SHOWN_CHANNELS ? (
            <Text size="sm" c="dimmed">
              … (+{n - SHOWN_CHANNELS} more)
            </Text>
          ) : null}
        </Stack>
      ) : null}
      <Stack gap={2}>
        {diff.special.map((s) => (
          <Code key={s.slot} style={{ whiteSpace: 'normal' }}>
            {formatUv5rMiniSpecialSlot(s)}
          </Code>
        ))}
      </Stack>
    </Stack>
  );
}

function ReadCard({ read }: { read: Uv5rMiniDebugRead }) {
  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Badge size="lg">{read.label}</Badge>
        <Text size="sm">{read.readAt.toLocaleString()}</Text>
      </Group>
      <Text size="sm">
        <strong>F</strong> <Code>{hex(read.ident.f)}</Code>
      </Text>
      <Text size="sm">
        <strong>M</strong> <Code>{hex(read.ident.m)}</Code>
      </Text>
      <Table.ScrollContainer minWidth={480}>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Span</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>SHA-256 (decoded)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {read.spans.map((s) => (
              <Table.Tr key={s.span.id}>
                <Table.Td>
                  <Code>{formatUv5rMiniSpanRange(s.span)}</Code>
                </Table.Td>
                <Table.Td>{s.span.label}</Table.Td>
                <Table.Td>
                  <Code style={{ wordBreak: 'break-all' }}>{s.sha256}</Code>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}

/**
 * UV-5R Mini debug page: a read-only full clone read with span hashes, the reads of this tab, and a compare of two
 * reads with the runbook windows. It never writes to the radio and never offers a restore from a read.
 */
export default function DebugUv5rMiniPage() {
  const { reads, undownloaded } = useUv5rMiniDebugReads();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [leftLabel, setLeftLabel] = useState<string | null>(null);
  const [rightLabel, setRightLabel] = useState<string | null>(null);

  useEffect(() => {
    if (undownloaded === 0) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [undownloaded]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function read() {
    setError(null);
    setProgress(null);
    let port;
    try {
      port = await grantUv5rMiniDebugPort();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    const abort = new AbortController();
    abortRef.current = abort;
    setBusy(true);
    try {
      const result = await runUv5rMiniDebugFullRead({
        port,
        onProgress: setProgress,
        signal: abort.signal,
      });
      uv5rMiniDebugReadStore.add(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function downloadAll() {
    downloadZip(buildUv5rMiniReadsZip(reads), `uv5r-mini-reads-${isoTimestampForFilename()}.zip`);
    uv5rMiniDebugReadStore.markAllDownloaded();
  }

  // Until the user picks, compare the two newest reads.
  const leftPick = leftLabel ?? reads.at(-2)?.label ?? null;
  const rightPick = rightLabel ?? reads.at(-1)?.label ?? null;
  const left = reads.find((r) => r.label === leftPick);
  const right = reads.find((r) => r.label === rightPick);
  const comparison = useMemo(
    () => (left && right ? compareUv5rMiniReads(left.decoded, right.decoded) : null),
    [left, right],
  );
  const channelDiff = useMemo(
    () => (left && right ? diffUv5rMiniChannels(left.decoded, right.decoded) : null),
    [left, right],
  );
  const options = reads.map((r) => ({ value: r.label, label: readName(r) }));

  return (
    <Page>
      <PageHeader
        title="UV-5R Mini full read"
        description="Read-only clone read of 0x0000–0xFFFF, SHA-256 per span, a compare of two reads and a calibration viewer."
      />
      <Stack gap="md">
        <Alert color="blue" title="Read only">
          This page only reads. Its sender allows the clone handshake, 64-byte reads and the end
          frame, and refuses anything else, so it can't write to the radio. It never restores from a
          read: a read carries the radio&apos;s calibration, which must never be written back. Web
          Serial needs desktop Chrome or Edge. Close other tabs that use the cable first.
        </Alert>

        <PageSection
          title="Read the radio"
          description="Radio on in normal mode, programming cable plugged in. About 1024 reads of 64 bytes."
        >
          <Stack gap="sm">
            <Group>
              <Button onClick={() => void read()} loading={busy} disabled={busy}>
                Full read
              </Button>
              {busy ? (
                <Button variant="default" onClick={() => abortRef.current?.abort()}>
                  Cancel
                </Button>
              ) : null}
            </Group>
            {busy && progress ? (
              <Stack gap={4}>
                <Progress value={(progress.cur / Math.max(1, progress.max)) * 100} />
                <Text size="xs" c="dimmed">
                  {progress.msg} ({progress.cur}/{progress.max})
                </Text>
              </Stack>
            ) : null}
            {error ? (
              <Alert color="red" title="Read failed">
                {error}
              </Alert>
            ) : null}
          </Stack>
        </PageSection>

        <PageSection
          title="Reads in this tab"
          description="Kept only until you close or reload this tab."
        >
          {reads.length === 0 ? (
            <Text size="sm" c="dimmed">
              No reads yet.
            </Text>
          ) : (
            <Stack gap="lg">
              <Stack gap="xs">
                <Group>
                  <Button variant="default" onClick={downloadAll}>
                    Download all ({reads.length})
                  </Button>
                  {undownloaded > 0 ? (
                    <Text size="sm" c="orange">
                      {undownloaded} read{undownloaded === 1 ? '' : 's'} not downloaded
                    </Text>
                  ) : (
                    <Text size="sm" c="dimmed">
                      All downloaded
                    </Text>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  The zip holds each read in full (raw, decoded and a summary), including the
                  radio&apos;s calibration at 0xF000–0xFFFF. It is specific to this radio: keep it
                  with the radio and don&apos;t share it as a codeplug.
                </Text>
              </Stack>
              {[...reads].reverse().map((r) => (
                <ReadCard key={r.label} read={r} />
              ))}
            </Stack>
          )}
        </PageSection>

        <PageSection
          title="Compare two reads"
          description="The runbook windows: the four log sectors skipped, the VFO and settings frames reported only, calibration on its own line."
        >
          {reads.length < 2 ? (
            <Text size="sm" c="dimmed">
              Take two reads to compare them.
            </Text>
          ) : (
            <Stack gap="sm">
              <Group grow>
                <Select
                  label="First read"
                  data={options}
                  value={leftPick}
                  onChange={setLeftLabel}
                />
                <Select
                  label="Second read"
                  data={options}
                  value={rightPick}
                  onChange={setRightLabel}
                />
              </Group>
              {comparison ? (
                <>
                  <Alert
                    color={comparison.identical ? 'green' : 'red'}
                    title={
                      comparison.identical
                        ? 'Identical'
                        : 'The reads differ outside the skipped windows'
                    }
                  >
                    {comparison.identical
                      ? 'Every compared span and calibration are identical.'
                      : 'See the spans marked as differing below.'}
                  </Alert>
                  <Table.ScrollContainer minWidth={480}>
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Span</Table.Th>
                          <Table.Th>Name</Table.Th>
                          <Table.Th>Result</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {comparison.lines.map((line) => (
                          <CompareLineRow key={`${line.kind}-${line.span.id}`} line={line} />
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                  {channelDiff ? <ChannelDiffView diff={channelDiff} /> : null}
                </>
              ) : null}
            </Stack>
          )}
        </PageSection>

        <Uv5rMiniCalibrationSection reads={reads} />
      </Stack>
    </Page>
  );
}
