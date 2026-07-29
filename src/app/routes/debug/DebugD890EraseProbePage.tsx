import {
  Alert,
  Badge,
  Button,
  Code,
  Group,
  List,
  Progress,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { Fragment, useCallback, useState } from 'react';
import { zipSync } from 'fflate';
import { Page, PageHeader, PageSection } from '@app/components/ui/index.ts';
import { openWebSerialPipe, requestWebSerialPort } from '@integrations/radio-io/transport/index.ts';
import {
  AT_D890_CONNECTION,
  AT_D890_MEMORY_REGION_GROUPS,
  AT_D890_DUMP_REGIONS,
  AT_D890_PROBE,
  estimateAtD890RmwSeconds,
  runAtD890ConfigAliasCheck,
  runAtD890DigitalContactsDump,
  runAtD890LinkProbe,
  runAtD890MemoryDumpAll,
  runAtD890MemoryGroupDump,
  runAtD890ProbeDiagnose,
  runAtD890ProbeInspect,
  runAtD890ProbeMeasure,
  runAtD890ProbePaint,
  runAtD890ProbeVerifyAndMark,
  runAtD890WriteBlockProbe,
  runAtD890WriteBlockVerify,
  type AtD890AliasVerdict,
  type AtD890ConfigAliasCheckResult,
  type AtD890ConfigAliasStatus,
  type AtD890EraseUnitResult,
  type AtD890AccessProfile,
  type AtD890LinkProfile,
  type AtD890ProbeInspectResult,
  type AtD890SweepResult,
  type AtD890ThroughputResult,
  type AtD890WriteProbeVerdict,
} from '@integrations/radio-io/radios/at-d890uv/index.ts';
import type { ProgressUpdate } from '@integrations/radio-io/types.ts';
import { downloadZip, isoTimestampForFilename } from '@integrations/download/browserDownload.ts';

type Pass =
  | 'inspect'
  | 'paint'
  | 'mark'
  | 'measure'
  | 'diagnose'
  | 'link'
  | 'writeProbe'
  | 'writeVerify'
  | 'configAlias';

/** `diagnose` is run on demand, not as part of the sequence. */
const PASS_ORDER: Pass[] = ['inspect', 'paint', 'mark', 'measure'];

/** Only the paint and mark passes put bytes on the flash. */
const PASS_LABEL: Record<Pass, string> = {
  inspect: 'Inspect (read-only)',
  paint: 'Paint sentinel grid',
  mark: 'Verify + write marker',
  measure: 'Measure',
  diagnose: 'Diagnose address space (read-only)',
  link: 'Profile link speed (read-only)',
  writeProbe: 'Probe write block sizes',
  writeVerify: 'Verify write blocks after power-cycle (read-only)',
  configAlias: 'Config-region alias check (read-only)',
};

/** A power-cycle is only meaningful after a pass that committed writes. */
const PASS_COMMITS_WRITES: Record<Pass, boolean> = {
  inspect: false,
  paint: true,
  mark: true,
  measure: false,
  diagnose: false,
  link: false,
  writeProbe: true,
  writeVerify: false,
  configAlias: false,
};

/** Units the current modelled write set lands in, per erase-unit size (from the bag analysis). */
const TOUCHED_UNITS: Record<number, number> = { 0x2000: 18, 0x10000: 14, 0x80000: 14 };

function hex(n: number): string {
  return `0x${n.toString(16)}`;
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(n % (1024 * 1024) === 0 ? 0 : 1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(n % 1024 === 0 ? 0 : 1)} kB`;
  return `${n} B`;
}

function configAliasStatusColor(status: AtD890ConfigAliasStatus): string {
  switch (status) {
    case 'flat':
      return 'green';
    case 'aliased':
      return 'red';
    case 'inconclusive_both_erased':
      return 'gray';
  }
}

function configAliasStatusLabel(status: AtD890ConfigAliasStatus): string {
  switch (status) {
    case 'flat':
      return 'flat';
    case 'aliased':
      return 'aliased';
    case 'inconclusive_both_erased':
      return 'inconclusive — both erased';
  }
}

function sparseRmwGateColor(gate: AtD890ConfigAliasCheckResult['report']['sparseRmwGate']): string {
  switch (gate) {
    case 'proceed':
      return 'green';
    case 'replan':
      return 'red';
    case 'partial':
      return 'orange';
  }
}

function ThroughputRows({ label, t }: { label: string; t: AtD890ThroughputResult }) {
  return (
    <Table.Tr>
      <Table.Td>{label}</Table.Td>
      <Table.Td>{t.framesPerSecond.toFixed(0)} frames/s</Table.Td>
      <Table.Td>{t.msPerFrame.toFixed(2)} ms/frame</Table.Td>
      <Table.Td>{formatBytes(Math.round(t.payloadBytesPerSecond))}/s payload</Table.Td>
    </Table.Tr>
  );
}

/**
 * The sequence spans several page loads by design — each pass needs a radio power-cycle,
 * and the operator may reload in between — so which passes are done outlives React state.
 */
const DONE_STORAGE_KEY = 'debug.d890EraseProbe.done';

function loadDonePasses(): Pass[] {
  try {
    const raw = sessionStorage.getItem(DONE_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((p): p is Pass => PASS_ORDER.includes(p as Pass))
      : [];
  } catch {
    return [];
  }
}

function saveDonePasses(passes: Pass[]): void {
  try {
    sessionStorage.setItem(DONE_STORAGE_KEY, JSON.stringify(passes));
  } catch {
    /* Private mode / quota — the sequence still works within this page load. */
  }
}

export default function DebugD890EraseProbePage() {
  const [done, setDone] = useState<Pass[]>(loadDonePasses);
  const [busy, setBusy] = useState<Pass | null>(null);
  const [regionBusy, setRegionBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AtD890EraseUnitResult | null>(null);
  const [inspect, setInspect] = useState<AtD890ProbeInspectResult | null>(null);
  const [alias, setAlias] = useState<AtD890AliasVerdict | null>(null);
  const [link, setLink] = useState<AtD890LinkProfile | null>(null);
  const [sweep, setSweep] = useState<AtD890SweepResult | null>(null);
  const [access, setAccess] = useState<AtD890AccessProfile | null>(null);
  const [writeVerdict, setWriteVerdict] = useState<AtD890WriteProbeVerdict | null>(null);
  const [configAlias, setConfigAlias] = useState<AtD890ConfigAliasCheckResult | null>(null);
  const [shadowReads, setShadowReads] = useState<boolean | null>(null);
  const [desynced, setDesynced] = useState(false);
  const [rates, setRates] = useState<{ label: string; t: AtD890ThroughputResult }[]>([]);

  const append = useCallback((line: string) => {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${line}`]);
  }, []);

  const runPass = useCallback(
    async (pass: Pass) => {
      setBusy(pass);
      setError(null);
      setProgress(null);
      let pipe: Awaited<ReturnType<typeof openWebSerialPipe>> | null = null;
      try {
        const port = await requestWebSerialPort(false);
        pipe = await openWebSerialPipe(port, AT_D890_CONNECTION.BAUD_RATE);
        const opts = { onProgress: setProgress };

        if (pass === 'inspect') {
          const r = await runAtD890ProbeInspect(pipe, opts);
          append(
            `${r.model}: ${r.occupiedSlots.length} occupied channel slots and ` +
              `${r.nonEmptyCells.length}/${r.totalCells} non-empty cells in the probe span.`,
          );
          setInspect(r);
          setRates((prev) => [...prev, { label: 'Inspect (read)', t: r.readThroughput }]);
        } else if (pass === 'paint') {
          const r = await runAtD890ProbePaint(pipe, opts);
          append(`Painted ${r.sentinelsWritten} sentinels on ${r.model}.`);
          setRates((prev) => [...prev, { label: 'Paint (write)', t: r.throughput }]);
        } else if (pass === 'mark') {
          const r = await runAtD890ProbeVerifyAndMark(pipe, opts);
          setAlias(r.alias);
          if (!r.ok) {
            append(
              `Grid did not survive: ${r.paint.intact} intact, ${r.paint.erased} erased, ` +
                `${r.paint.unexpected} holding another address. Marker NOT written.`,
            );
            setError(
              'Pass 2 stopped without writing the marker. See the address-space diagnosis below.',
            );
          } else {
            append(
              `Grid intact (${r.paint.intact}/${r.readings.length}) — same-session writes ` +
                `coexist. Marker written at ${hex(r.markerAddress)}.`,
            );
          }
          setRates((prev) => [...prev, { label: 'Verify (read)', t: r.readThroughput }]);
          if (!r.ok) return;
        } else if (pass === 'link') {
          const r = await runAtD890LinkProbe(pipe, opts);
          setLink(r.profile);
          setSweep(r.sweep);
          setAccess(r.access);
          append(
            `Largest usable block ${r.profile.bestBlockSize} bytes ` +
              `(${r.profile.speedup.toFixed(1)}× the 16-byte path); sweep ` +
              `${formatBytes(Math.round(r.sweep.bytesPerSecond))}/s; ` +
              `page ${r.access.inferredPageBytes == null ? 'not resolved' : hex(r.access.inferredPageBytes)}.`,
          );
          return;
        } else if (pass === 'writeProbe') {
          const r = await runAtD890WriteBlockProbe(pipe, opts);
          setWriteVerdict(r.verdict);
          setShadowReads(r.inSessionReadsSeeStagedWrites);
          setDesynced(r.desynced);
          append(
            `Write blocks: largest usable ${r.verdict.bestBlockSize} bytes ` +
              `(${r.verdict.speedup.toFixed(1)}x). In-session reads see staged writes: ` +
              `${r.inSessionReadsSeeStagedWrites ? 'yes' : 'no'}.` +
              (r.desynced
                ? ' Radio desynced — NOT committed, power-cycle to discard.'
                : ' Committed; power-cycle, then verify.'),
          );
          if (r.desynced) {
            setError(
              'The radio stopped answering after an oversized write frame. Nothing was ' +
                'committed — power-cycle the radio before doing anything else.',
            );
          }
          return;
        } else if (pass === 'writeVerify') {
          const r = await runAtD890WriteBlockVerify(pipe, opts);
          setWriteVerdict(r.verdict);
          append(
            `After commit: largest write block that survived ${r.verdict.bestBlockSize} bytes ` +
              `(${r.verdict.speedup.toFixed(1)}x the 16-byte path).`,
          );
          return;
        } else if (pass === 'diagnose') {
          const r = await runAtD890ProbeDiagnose(pipe, opts);
          setAlias(r.alias);
          append(
            r.alias.flat
              ? `Address space looks flat: no cell reported another address.`
              : `${r.alias.aliasedCells} cells hold data written elsewhere; ` +
                  `${r.alias.aliasStride == null ? 'mixed deltas' : `stride ${hex(r.alias.aliasStride)}`}.`,
          );
          setRates((prev) => [...prev, { label: 'Diagnose (read)', t: r.readThroughput }]);
          return;
        } else if (pass === 'configAlias') {
          const r = await runAtD890ConfigAliasCheck(pipe, opts);
          setConfigAlias(r);
          append(
            `Config alias check (${r.model}): PR5 gate ${r.report.sparseRmwGate} — ` +
              r.report.summary,
          );
          setRates((prev) => [...prev, { label: 'Config alias (read)', t: r.readThroughput }]);
          return;
        } else {
          const r = await runAtD890ProbeMeasure(pipe, opts);
          setResult(r.result);
          append(
            `Erase unit ${hex(r.result.unitBytes)} (${formatBytes(r.result.unitBytes)}) ` +
              `at ${hex(r.result.unitStart)}.`,
          );
          setRates((prev) => [...prev, { label: 'Measure (read)', t: r.readThroughput }]);
        }
        setDone((prev) => {
          if (prev.includes(pass)) return prev;
          const next = [...prev, pass];
          saveDonePasses(next);
          return next;
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        append(`FAILED: ${message}`);
      } finally {
        await pipe?.close().catch(() => undefined);
        setBusy(null);
        setProgress(null);
      }
    },
    [append],
  );

  const nextPass = PASS_ORDER.find((p) => !done.includes(p));
  const fastest = rates.reduce((max, r) => Math.max(max, r.t.framesPerSecond), 0);
  const anyBusy = busy !== null || regionBusy !== null;

  const exportGroup = useCallback(
    async (groupId: string, groupLabel: string) => {
      setRegionBusy(groupId);
      setError(null);
      setProgress(null);
      let pipe: Awaited<ReturnType<typeof openWebSerialPipe>> | null = null;
      try {
        const port = await requestWebSerialPort(false);
        pipe = await openWebSerialPipe(port, AT_D890_CONNECTION.BAUD_RATE);
        const r = await runAtD890MemoryGroupDump(pipe, groupId, { onProgress: setProgress });
        const files: Record<string, Uint8Array> = {};
        for (const [id, bytes] of r.files) files[`${id}.bin`] = bytes;
        const fileName = `d890-${groupId}-${isoTimestampForFilename()}.zip`;
        downloadZip(zipSync(files), fileName);
        append(
          `Exported ${groupLabel} (${r.files.size} region${r.files.size === 1 ? '' : 's'}) — ` +
            `${formatBytes(r.totalBytes)} in ${(r.elapsedMs / 1000).toFixed(1)}s → ${fileName}`,
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        append(`FAILED: ${message}`);
      } finally {
        await pipe?.close().catch(() => undefined);
        setRegionBusy(null);
        setProgress(null);
      }
    },
    [append],
  );

  const exportAllRegions = useCallback(async () => {
    setRegionBusy('__all__');
    setError(null);
    setProgress(null);
    let pipe: Awaited<ReturnType<typeof openWebSerialPipe>> | null = null;
    try {
      const port = await requestWebSerialPort(false);
      pipe = await openWebSerialPipe(port, AT_D890_CONNECTION.BAUD_RATE);
      const r = await runAtD890MemoryDumpAll(pipe, { onProgress: setProgress });
      const files: Record<string, Uint8Array> = {};
      for (const [id, bytes] of r.files) files[`${id}.bin`] = bytes;
      const fileName = `d890-memory-dump-${isoTimestampForFilename()}.zip`;
      downloadZip(zipSync(files), fileName);
      append(
        `Exported ${r.files.size} regions (excl. Digital Contacts) — ` +
          `${formatBytes(r.totalBytes)} in ${(r.elapsedMs / 1000).toFixed(1)}s → ${fileName}`,
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      append(`FAILED: ${message}`);
    } finally {
      await pipe?.close().catch(() => undefined);
      setRegionBusy(null);
      setProgress(null);
    }
  }, [append]);

  const exportDigitalContacts = useCallback(async () => {
    setRegionBusy('__contacts__');
    setError(null);
    setProgress(null);
    let pipe: Awaited<ReturnType<typeof openWebSerialPipe>> | null = null;
    try {
      const port = await requestWebSerialPort(false);
      pipe = await openWebSerialPipe(port, AT_D890_CONNECTION.BAUD_RATE);
      const r = await runAtD890DigitalContactsDump(pipe, { onProgress: setProgress });
      const fileName = `d890-digital-contacts-${isoTimestampForFilename()}.zip`;
      downloadZip(
        zipSync({ 'meta.bin': r.meta, 'order.bin': r.order, 'contacts.bin': r.contacts }),
        fileName,
      );
      append(
        `Exported ${r.contactCount} digital contacts in ${(r.elapsedMs / 1000).toFixed(1)}s → ${fileName}`,
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      append(`FAILED: ${message}`);
    } finally {
      await pipe?.close().catch(() => undefined);
      setRegionBusy(null);
      setProgress(null);
    }
  }, [append]);

  return (
    <Page>
      <PageHeader
        title="AT-D890UV erase-unit probe"
        description="Measures the flash erase unit that Write must read-modify-write (#768 phase 1). Includes a read-only config-region alias check (#792) — no power-cycle required."
      />
      <Stack gap="md">
        <Alert color="red" title="This writes to the radio">
          <Stack gap="xs">
            <Text size="sm">
              Use a spare radio if you have one, and be ready to restore with official Anytone CPS
              (band <Code>0x000</Code> → PTT+1 test mode → band <Code>0x003</Code>).
            </Text>
            <Text size="sm">
              Writes land only in <Code>ChannelData</Code> for channel slots{' '}
              {AT_D890_PROBE.FIRST_CHANNEL_SLOT}–{AT_D890_PROBE.LAST_CHANNEL_SLOT} (
              {hex(AT_D890_PROBE.SPAN_START)}–{hex(AT_D890_PROBE.SPAN_END)}). Pass 1 refuses to
              write anything if any of those slots is occupied.
            </Text>
          </Stack>
        </Alert>

        <PageSection title="How it works">
          <Text size="sm">
            The radio stages writes in RAM and applies them on commit, so reading back in the same
            session returns the shadow rather than flash. Each pass is therefore its own session
            with a <strong>power-cycle after any pass that wrote</strong>. Pass 1 paints a 16-byte
            sentinel every {hex(AT_D890_PROBE.SENTINEL_STRIDE)}; pass 2 confirms they survived and
            writes one marker at {hex(AT_D890_PROBE.MARKER_ADDRESS)}; pass 3 reads the grid back.
            The run of erased sentinels around the marker is exactly one erase unit.
          </Text>
          <Text size="sm" mt="sm">
            The span deliberately sits in <Code>ChannelData</Code> blocks 16-18 rather than near the
            start of the bank. The erase unit is the unknown being measured, so the span is placed
            where even a far larger unit than expected (up to 8 MB) still lands entirely on unused
            address space, well above the blocks a real codeplug occupies.
          </Text>
          <Text size="sm" mt="sm">
            <strong>Config-region alias check (#792):</strong> a separate read-only pass compares
            LocalInfo, optional settings, and ChannelSet against their <Code>+0x40000</Code> alias
            candidates. Identical non-trivial bytes mean one physical cell; dual all-
            <Code>0xff</Code> spans are inconclusive. Use a CPS-restored radio so LocalInfo is
            densely populated. No writes and no power-cycle.
          </Text>
        </PageSection>

        <PageSection title="Passes">
          <Stack gap="sm">
            <List spacing="xs">
              <List.Item>
                <Group gap="sm">
                  <Badge color="gray" variant="light">
                    0 · read-only
                  </Badge>
                  <Text size="sm">Inspect the span — confirm it holds nothing before writing.</Text>
                  {done.includes('inspect') && <Badge color="green">done</Badge>}
                </Group>
              </List.Item>
              <List.Item>
                <Group gap="sm">
                  <Badge color="red" variant="light">
                    1 · writes
                  </Badge>
                  <Text size="sm">Paint the sentinel grid, then commit.</Text>
                  {done.includes('paint') && <Badge color="green">done</Badge>}
                </Group>
              </List.Item>
              <List.Item>
                <Group gap="sm">
                  <Badge color="red" variant="light">
                    2 · writes
                  </Badge>
                  <Text size="sm">Power-cycle, verify the grid, write one marker, commit.</Text>
                  {done.includes('mark') && <Badge color="green">done</Badge>}
                </Group>
              </List.Item>
              <List.Item>
                <Group gap="sm">
                  <Badge color="gray" variant="light">
                    3 · read-only
                  </Badge>
                  <Text size="sm">Power-cycle, read the grid back, measure.</Text>
                  {done.includes('measure') && <Badge color="green">done</Badge>}
                </Group>
              </List.Item>
            </List>

            {nextPass && done.some((p) => PASS_COMMITS_WRITES[p]) && (
              <Alert color="yellow" title="Power-cycle the radio now">
                Turn the radio off and on again before running the next pass, or it will report the
                RAM shadow instead of flash.
              </Alert>
            )}

            {nextPass === 'paint' && inspect && inspect.occupiedSlots.length === 0 && (
              <Alert color="orange" title="Next pass writes to the radio">
                The span is confirmed empty. Pass 1 writes{' '}
                {AT_D890_PROBE.SENTINEL_STRIDE > 0 ? '' : ''}
                {Math.floor(
                  (AT_D890_PROBE.SPAN_END - AT_D890_PROBE.SPAN_START) /
                    AT_D890_PROBE.SENTINEL_STRIDE,
                )}{' '}
                sentinel blocks into it and commits.
              </Alert>
            )}

            <Group>
              <Button
                onClick={() => nextPass && void runPass(nextPass)}
                loading={anyBusy}
                disabled={!nextPass}
                color={nextPass && PASS_COMMITS_WRITES[nextPass] ? 'red' : undefined}
              >
                {nextPass
                  ? `Run pass ${PASS_ORDER.indexOf(nextPass)} — ${PASS_LABEL[nextPass]}`
                  : 'Complete'}
              </Button>
              {/* Always available: read-only, idempotent, and its whole purpose is to
                  inspect a grid painted in an earlier session or before a page reload. */}
              <Button variant="default" disabled={anyBusy} onClick={() => void runPass('diagnose')}>
                {PASS_LABEL.diagnose}
              </Button>
              <Button variant="default" disabled={anyBusy} onClick={() => void runPass('link')}>
                {PASS_LABEL.link}
              </Button>
              <Button
                color="red"
                variant="light"
                disabled={anyBusy}
                onClick={() => void runPass('writeProbe')}
              >
                {PASS_LABEL.writeProbe}
              </Button>
              <Button
                variant="default"
                disabled={anyBusy}
                onClick={() => void runPass('writeVerify')}
              >
                {PASS_LABEL.writeVerify}
              </Button>
              <Button
                variant="default"
                disabled={anyBusy}
                onClick={() => void runPass('configAlias')}
              >
                {PASS_LABEL.configAlias}
              </Button>
              <Button
                variant="subtle"
                disabled={anyBusy}
                onClick={() => {
                  setDone([]);
                  saveDonePasses([]);
                  setResult(null);
                  setInspect(null);
                  setAlias(null);
                  setConfigAlias(null);
                  setLink(null);
                  setSweep(null);
                  setAccess(null);
                  setWriteVerdict(null);
                  setShadowReads(null);
                  setDesynced(false);
                  setRates([]);
                  setError(null);
                  setLog([]);
                }}
              >
                Reset
              </Button>
            </Group>

            {progress && (
              <Stack gap={4}>
                <Text size="xs" c="dimmed">
                  {progress.stage}: {progress.msg}
                </Text>
                <Progress value={(progress.cur / Math.max(1, progress.max)) * 100} />
              </Stack>
            )}
          </Stack>
        </PageSection>

        <PageSection title="Raw memory-region export (read-only)">
          <Stack gap="sm">
            <Text size="sm">
              Dumps documented regions to raw <Code>.bin</Code> files for offline diffing against
              codeplugs written by the official Anytone CPS — write the config there first, then
              dump here. Never issues a write frame. See{' '}
              <Code>docs/reference/radios/anytone/at-d890uv/memory-layout.md</Code> for what each
              region means.
            </Text>
            <Group>
              <Button
                variant="light"
                disabled={anyBusy}
                loading={regionBusy === '__all__'}
                onClick={() => void exportAllRegions()}
              >
                Export all (excl. Digital Contacts) → ZIP
              </Button>
              <Button
                variant="light"
                color="orange"
                disabled={anyBusy}
                loading={regionBusy === '__contacts__'}
                onClick={() => void exportDigitalContacts()}
              >
                Export Digital Contacts → ZIP
              </Button>
            </Group>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Area / region</Table.Th>
                  <Table.Th>Base</Table.Th>
                  <Table.Th>Size</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {AT_D890_MEMORY_REGION_GROUPS.map((group) => {
                  const members = AT_D890_DUMP_REGIONS.filter((r) => r.group === group.id);
                  const groupSize = members.reduce(
                    (sum, r) => sum + r.chunks.reduce((s, c) => s + c.length, 0),
                    0,
                  );
                  return (
                    <Fragment key={group.id}>
                      <Table.Tr>
                        <Table.Td>
                          <Text fw={600} size="sm">
                            {group.label}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {members.length} region{members.length === 1 ? '' : 's'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={600} size="sm">
                            {formatBytes(groupSize)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Button
                            size="xs"
                            variant="light"
                            disabled={anyBusy}
                            loading={regionBusy === group.id}
                            onClick={() => void exportGroup(group.id, group.label)}
                          >
                            Export
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                      {members.map((r) => {
                        const size = r.chunks.reduce((sum, c) => sum + c.length, 0);
                        return (
                          <Table.Tr key={r.id}>
                            <Table.Td pl="lg">
                              <Text size="sm" c="dimmed">
                                {r.label}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Code>{hex(r.chunks[0]?.address ?? 0)}</Code>
                              {r.chunks.length > 1 && (
                                <Text size="xs" c="dimmed">
                                  {r.chunks.length} chunks
                                </Text>
                              )}
                            </Table.Td>
                            <Table.Td>{formatBytes(size)}</Table.Td>
                            <Table.Td />
                          </Table.Tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Stack>
        </PageSection>

        {error && (
          <Alert color="red" title="Pass failed">
            {error}
          </Alert>
        )}

        {writeVerdict && (
          <PageSection title="Write block sizes">
            <Stack gap="sm">
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Block</Table.Th>
                    <Table.Th>Frame</Table.Th>
                    <Table.Th>Read-back</Table.Th>
                    <Table.Th>Address</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {writeVerdict.results.map((t) => (
                    <Table.Tr key={t.blockSize}>
                      <Table.Td>
                        <Code>{t.blockSize}</Code>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={t.accepted ? 'green' : 'gray'} variant="light">
                          {t.accepted ? 'ACKed' : 'refused'}
                        </Badge>
                        {t.detail && (
                          <Text size="xs" c="dimmed">
                            {t.detail}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {t.readback == null ? (
                          '—'
                        ) : (
                          <Badge
                            color={
                              t.readback === 'match'
                                ? 'green'
                                : t.readback === 'erased'
                                  ? 'orange'
                                  : 'red'
                            }
                            variant="light"
                          >
                            {t.readback}
                          </Badge>
                        )}
                        {t.readback === 'mismatch' && t.matchingPrefix != null && (
                          <Text size="xs" c="dimmed">
                            first {t.matchingPrefix} bytes matched
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Code>{hex(t.address)}</Code>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              {desynced && (
                <Alert color="red" title="Radio desynced — nothing committed">
                  An oversized write frame left the radio unable to answer: it consumes only the
                  first 16 data bytes and re-parses the rest of the frame as commands. The session
                  was abandoned without <Code>END</Code>, so nothing reached flash.{' '}
                  <strong>Power-cycle the radio</strong> to discard the staged shadow.
                </Alert>
              )}
              {writeVerdict.anyVerified ? (
                <Alert color={writeVerdict.bestBlockSize > 0x10 ? 'green' : 'orange'}>
                  Largest verified write block <Code>{writeVerdict.bestBlockSize}</Code> bytes —{' '}
                  <strong>{writeVerdict.speedup.toFixed(1)}×</strong> the 16-byte path.
                  {writeVerdict.bestBlockSize > 0x10
                    ? ' Staging is the dominant cost in a dense erase-unit RMW, so this is a real saving.'
                    : ' The radio stages only 16 bytes per frame.'}
                </Alert>
              ) : (
                <Alert color="gray" title="Nothing verified">
                  No size read back correctly — not even 16 bytes, which is the known-good control.
                  This run proves nothing about block sizes rather than proving 16 is the limit.
                  Most likely the oversized frames disturbed the session enough that none of the
                  staged writes survived the commit.
                </Alert>
              )}

              {shadowReads != null && (
                <Alert color={shadowReads ? 'blue' : 'yellow'} title="In-session read semantics">
                  {shadowReads
                    ? 'A read issued after a write in the same session returned the new bytes — reads see the staged shadow. Any same-session Write verification is therefore checking RAM, not flash, which is why the sentinel fence never fired (#769).'
                    : 'A read issued after a write in the same session returned the old bytes — reads come from flash, and staged writes are invisible until commit. Verification must happen after a power-cycle either way.'}
                </Alert>
              )}

              <Text size="sm" c="dimmed">
                Run this pass, power-cycle the radio, then run the verify pass — only a post-commit
                read proves a block size actually reached flash.
              </Text>
            </Stack>
          </PageSection>
        )}

        {link && (
          <PageSection title="Link profile">
            <Stack gap="sm">
              <Text size="sm">
                Transfers are priced by <strong>frames</strong>, not bytes: at{' '}
                {link.baselineMsPerFrame.toFixed(2)} ms per exchange, 16-byte blocks give only{' '}
                {formatBytes(Math.round(link.baselinePayloadBytesPerSecond))}/s against a ~59 kB/s
                line-rate ceiling. Larger blocks amortise that latency.
              </Text>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Block</Table.Th>
                    <Table.Th>Result</Table.Th>
                    <Table.Th>Latency</Table.Th>
                    <Table.Th>Payload</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {link.trials.map((t) => (
                    <Table.Tr key={t.blockSize}>
                      <Table.Td>
                        <Code>{t.blockSize}</Code>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={t.ok ? 'green' : 'gray'} variant="light">
                          {t.ok ? 'ok' : 'rejected'}
                        </Badge>
                        {t.detail && (
                          <Text size="xs" c="dimmed">
                            {t.detail}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>{t.msPerFrame ? `${t.msPerFrame.toFixed(2)} ms` : '—'}</Table.Td>
                      <Table.Td>
                        {t.payloadBytesPerSecond
                          ? `${formatBytes(Math.round(t.payloadBytesPerSecond))}/s`
                          : '—'}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Alert color={link.bestBlockSize > 0x10 ? 'green' : 'orange'}>
                Largest usable block <Code>{link.bestBlockSize}</Code> bytes —{' '}
                <strong>{link.speedup.toFixed(1)}×</strong> the 16-byte path.
                {link.bestBlockSize > 0x10
                  ? ' Raising the read block size makes full erase-unit RMW affordable.'
                  : ' The radio only honours 16-byte blocks, so full-unit RMW stays expensive and the fix must minimise the units it touches.'}
              </Alert>
              {sweep && (
                <Text size="sm">
                  Contiguous sweep of {formatBytes(sweep.bytes)} at <Code>{sweep.blockSize}</Code>
                  -byte blocks: <strong>{formatBytes(Math.round(sweep.bytesPerSecond))}/s</strong>.
                  This is the access pattern an erase-unit RMW actually uses, so it — not the
                  same-address figures above — is what prices the read half.
                </Text>
              )}
              {access && (
                <Text size="sm">
                  Read latency by stride:{' '}
                  {access.samples
                    .map((s) => `${hex(s.stride)}→${s.msPerFrame.toFixed(2)}ms`)
                    .join(', ')}
                  .{' '}
                  {access.inferredPageBytes == null
                    ? 'No cache signal resolved, so no page size is claimed.'
                    : `Latency saturates at ${hex(access.inferredPageBytes)}, so the read page is no larger than that.`}
                </Text>
              )}
            </Stack>
          </PageSection>
        )}

        {alias && !alias.flat && (
          <PageSection title="Address space is not flat">
            <Stack gap="sm">
              <Alert color="orange" title="Two addresses share one physical cell">
                {alias.aliasedCells} of the painted cells hold a block written to a{' '}
                <strong>different</strong> address. Nothing was erased — the writes landed
                elsewhere. This is an aliasing/mirroring property of the address space, not an
                erase-unit effect, and it invalidates the erase measurement until the grid is
                re-sited on non-aliasing addresses.
              </Alert>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>tag − address</Table.Th>
                    <Table.Th>cells</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {alias.deltas.map((d) => (
                    <Table.Tr key={d.delta}>
                      <Table.Td>
                        <Code>
                          {d.delta < 0 ? '-' : '+'}
                          {hex(Math.abs(d.delta))}
                        </Code>
                      </Table.Td>
                      <Table.Td>{d.count}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              {alias.aliasStride != null && (
                <Text size="sm">
                  Single consistent stride <Code>{hex(alias.aliasStride)}</Code> — the address space
                  repeats with that period, so only the first <Code>{hex(alias.aliasStride)}</Code>{' '}
                  of each region is real storage.
                </Text>
              )}
            </Stack>
          </PageSection>
        )}

        {alias?.flat && (
          <PageSection title="Address space">
            <Text size="sm">
              No cell reported another address — the probe span is flat, so any missing sentinels
              really were erased.
            </Text>
          </PageSection>
        )}

        {configAlias && (
          <PageSection title="Config-region alias check (#792)">
            <Stack gap="sm">
              <Alert
                color={sparseRmwGateColor(configAlias.report.sparseRmwGate)}
                title={`PR5 gate: ${configAlias.report.sparseRmwGate}`}
              >
                {configAlias.report.summary}
              </Alert>
              <Text size="sm">
                {configAlias.model} · read block <Code>{configAlias.readBlockSize}</Code> bytes
              </Text>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Region</Table.Th>
                    <Table.Th>Base</Table.Th>
                    <Table.Th>Alias (+0x40000)</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>non-0xff (base / alias)</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {configAlias.report.pairs.map((p) => (
                    <Table.Tr key={p.id}>
                      <Table.Td>{p.label}</Table.Td>
                      <Table.Td>
                        <Code>{hex(p.base)}</Code>
                      </Table.Td>
                      <Table.Td>
                        <Code>{hex(p.aliasCandidate)}</Code>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={configAliasStatusColor(p.status)} variant="light">
                          {configAliasStatusLabel(p.status)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {p.nonFfBytesBase} / {p.nonFfBytesAlias}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Group>
                <Button
                  variant="light"
                  onClick={() => void navigator.clipboard.writeText(configAlias.markdown)}
                >
                  Copy markdown for docs
                </Button>
              </Group>
            </Stack>
          </PageSection>
        )}

        {inspect && (
          <PageSection title="Span inspection (read-only)">
            <Table>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td>Radio</Table.Td>
                  <Table.Td>
                    <Code>{inspect.model}</Code>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Occupied channel slots in span</Table.Td>
                  <Table.Td>
                    <Badge color={inspect.occupiedSlots.length === 0 ? 'green' : 'red'}>
                      {inspect.occupiedSlots.length === 0
                        ? 'none — safe to write'
                        : `${inspect.occupiedSlots.length} occupied — pass 1 will refuse`}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Cells holding data</Table.Td>
                  <Table.Td>
                    {inspect.nonEmptyCells.length} of {inspect.totalCells}
                    {inspect.nonEmptyCells.length > 0 && (
                      <Text size="xs" c="dimmed">
                        first: {inspect.nonEmptyCells.slice(0, 6).map(hex).join(', ')}
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </PageSection>
        )}

        {result && (
          <PageSection title="Result">
            <Table>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td>Erase unit</Table.Td>
                  <Table.Td>
                    <Code>{hex(result.unitBytes)}</Code> ({formatBytes(result.unitBytes)})
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Unit range</Table.Td>
                  <Table.Td>
                    <Code>
                      {hex(result.unitStart)}–{hex(result.unitEnd)}
                    </Code>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Aligned to its own size</Table.Td>
                  <Table.Td>
                    <Badge color={result.aligned ? 'green' : 'red'}>
                      {result.aligned ? 'yes' : 'no'}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Measurement resolution</Table.Td>
                  <Table.Td>
                    <Code>{hex(result.resolution)}</Code>
                  </Table.Td>
                </Table.Tr>
                {result.truncatedBySpan && (
                  <Table.Tr>
                    <Table.Td>Warning</Table.Td>
                    <Table.Td>
                      <Text size="sm" c="red">
                        The erased run reached a span edge — the true unit may be larger. Widen{' '}
                        <Code>AT_D890_PROBE.SPAN_END</Code> and re-run.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {fastest > 0 && (
                  <Table.Tr>
                    <Table.Td>Estimated full-RMW Write</Table.Td>
                    <Table.Td>
                      {estimateAtD890RmwSeconds(
                        result.unitBytes,
                        TOUCHED_UNITS[result.unitBytes] ?? 14,
                        fastest,
                      ).toFixed(0)}
                      s for {TOUCHED_UNITS[result.unitBytes] ?? 14} touched units (read + write)
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
            <Text size="sm" c="dimmed" mt="sm">
              Record this in <Code>docs/reference/radios/anytone/at-d890uv/memory-layout.md</Code>{' '}
              and set <Code>AT_D890_ERASE_UNIT_BYTES</Code> from it.
            </Text>
          </PageSection>
        )}

        {rates.length > 0 && (
          <PageSection title="Measured link throughput">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Pass</Table.Th>
                  <Table.Th>Rate</Table.Th>
                  <Table.Th>Latency</Table.Th>
                  <Table.Th>Payload</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rates.map((r, i) => (
                  <ThroughputRows key={`${r.label}-${i}`} label={r.label} t={r.t} />
                ))}
              </Table.Tbody>
            </Table>
          </PageSection>
        )}

        {log.length > 0 && (
          <PageSection title="Log">
            <Code block>{log.join('\n')}</Code>
          </PageSection>
        )}
      </Stack>
    </Page>
  );
}
