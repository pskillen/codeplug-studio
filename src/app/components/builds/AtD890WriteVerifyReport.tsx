/**
 * Full-memory write verify report for AT-D890UV serial Write.
 */

import { Fragment, useMemo, useState } from 'react';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Code,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import {
  AT_D890_MEMORY_REGION_GROUPS,
  formatAtD890WriteVerifyDebugMarkdown,
  AT_D890_RMW_SPILL_GROUP,
  type AtD890RegionVerifyStatus,
  type AtD890WriteVerifyDebugContext,
  type AtD890WriteVerifyResult,
} from '@integrations/radio-io/radios/at-d890uv/index.ts';

/** Verify-only region group — not part of {@link AT_D890_MEMORY_REGION_GROUPS} memory export. */
const AT_D890_VERIFY_ONLY_REGION_GROUPS: { id: string; label: string }[] = [
  { id: AT_D890_RMW_SPILL_GROUP, label: 'RMW-preserved spill' },
];

const MISMATCH_DISPLAY_LIMIT = 50;

export interface AtD890WriteVerifyReportProps {
  result: AtD890WriteVerifyResult;
  debugContext: AtD890WriteVerifyDebugContext;
  onClose: () => void;
  /** When true, render body only (parent supplies Modal chrome). */
  inModal?: boolean;
}

function hex(address: number): string {
  return `0x${address.toString(16)}`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function bytesToHex(data: Uint8Array): string {
  return [...data].map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

function regionStatusColor(status: AtD890RegionVerifyStatus): string {
  switch (status) {
    case 'match':
      return 'green';
    case 'mismatch':
      return 'red';
    case 'not_written':
      return 'gray';
    case 'skipped':
      return 'dark';
  }
}

function regionStatusLabel(status: AtD890RegionVerifyStatus): string {
  switch (status) {
    case 'match':
      return 'match';
    case 'mismatch':
      return 'mismatch';
    case 'not_written':
      return 'not written';
    case 'skipped':
      return 'skipped';
  }
}

export default function AtD890WriteVerifyReport({
  result,
  debugContext,
  onClose,
  inModal = false,
}: AtD890WriteVerifyReportProps) {
  const [log, setLog] = useState<string[]>(() => [
    `${new Date().toLocaleTimeString()} — verify complete: ${result.staging.mismatchedChunks} mismatched of ${result.staging.totalChunks} staged chunks`,
  ]);

  const regionsByGroup = useMemo(() => {
    const map = new Map<string, typeof result.regions>();
    const allGroups = [...AT_D890_MEMORY_REGION_GROUPS, ...AT_D890_VERIFY_ONLY_REGION_GROUPS];
    for (const group of allGroups) {
      map.set(
        group.id,
        result.regions.filter((r) => r.group === group.id),
      );
    }
    return map;
  }, [result.regions]);

  const debugMarkdown = useMemo(
    () => formatAtD890WriteVerifyDebugMarkdown(result, debugContext),
    [result, debugContext],
  );

  function appendLog(line: string): void {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()} — ${line}`]);
  }

  async function handleCopyDebugInfo(): Promise<void> {
    await navigator.clipboard.writeText(debugMarkdown);
    appendLog('Copied debug info to clipboard');
  }

  function handleDownloadMarkdown(): void {
    const blob = new Blob([debugMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `d890-write-verify-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    appendLog('Downloaded markdown report');
  }

  function handleDownloadJson(): void {
    const serializable = {
      ...result,
      staging: {
        ...result.staging,
        mismatches: result.staging.mismatches.map((m) => ({
          kind: m.kind,
          address: m.address,
          regionId: m.regionId,
          regionLabel: m.regionLabel,
          expected: bytesToHex(m.expected),
          actual: m.actual ? bytesToHex(m.actual) : null,
        })),
      },
    };
    const blob = new Blob([JSON.stringify(serializable, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `d890-write-verify-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    appendLog('Downloaded mismatch JSON');
  }

  const mismatches = result.staging.mismatches;
  const hiddenMismatchCount = Math.max(0, mismatches.length - MISMATCH_DISPLAY_LIMIT);

  const body = (
    <Stack gap="md" pr={inModal ? undefined : 'xs'}>
      <Alert
        color={result.ok ? 'green' : 'red'}
        title={result.ok ? 'Verify passed' : 'Verify failed'}
      >
        <Text size="sm">
          {result.staging.mismatchedChunks} of {result.staging.totalChunks} staged chunks
          mismatched.
          {result.staging.notReadChunks > 0
            ? ` ${result.staging.notReadChunks} could not be read back.`
            : ''}
          {result.staging.excludedBookkeepingChunks > 0
            ? ` ${result.staging.excludedBookkeepingChunks} erase-unit bookkeeping blocks excluded from compare.`
            : ''}{' '}
          Preserved settings: {result.sentinel.ok ? 'unchanged' : 'changed'}.
        </Text>
      </Alert>

      <Text size="sm" c="dimmed">
        {result.model} · read {formatBytes(result.totalBytesRead)} in{' '}
        {(result.elapsedMs / 1000).toFixed(1)}s ·{' '}
        <Anchor
          component="button"
          type="button"
          size="sm"
          onClick={() => void handleCopyDebugInfo()}
        >
          Copy debug info
        </Anchor>
      </Text>

      <Stack gap="xs">
        <Text fw={600} size="sm">
          Memory regions
        </Text>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Region</Table.Th>
              <Table.Th>Size</Table.Th>
              <Table.Th>Staged</Table.Th>
              <Table.Th>Mismatches</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {[...AT_D890_MEMORY_REGION_GROUPS, ...AT_D890_VERIFY_ONLY_REGION_GROUPS].map(
              (group) => {
                const rows = regionsByGroup.get(group.id) ?? [];
                if (rows.length === 0) return null;
                const groupBytes = rows.reduce((sum, r) => sum + r.bytesRead, 0);
                const groupStaged = rows.reduce((sum, r) => sum + r.stagedChunkCount, 0);
                const groupMismatches = rows.reduce((sum, r) => sum + r.mismatchedChunks, 0);
                const groupStatus: AtD890RegionVerifyStatus =
                  groupMismatches > 0 ? 'mismatch' : groupStaged > 0 ? 'match' : 'not_written';
                return (
                  <Fragment key={group.id}>
                    <Table.Tr>
                      <Table.Td fw={600}>{group.label}</Table.Td>
                      <Table.Td>{formatBytes(groupBytes)}</Table.Td>
                      <Table.Td>{groupStaged}</Table.Td>
                      <Table.Td>{groupMismatches}</Table.Td>
                      <Table.Td>
                        <Badge color={regionStatusColor(groupStatus)} variant="light">
                          {regionStatusLabel(groupStatus)}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                    {rows.map((r) => (
                      <Table.Tr key={r.id}>
                        <Table.Td pl="xl">{r.label}</Table.Td>
                        <Table.Td>{formatBytes(r.bytesRead)}</Table.Td>
                        <Table.Td>{r.stagedChunkCount}</Table.Td>
                        <Table.Td>{r.mismatchedChunks}</Table.Td>
                        <Table.Td>
                          <Badge color={regionStatusColor(r.status)} variant="light" size="sm">
                            {regionStatusLabel(r.status)}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Fragment>
                );
              },
            )}
          </Table.Tbody>
        </Table>
      </Stack>

      {!result.sentinel.ok ? (
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Preserved settings
          </Text>
          <Table withTableBorder>
            <Table.Tbody>
              {result.sentinel.mismatches.map((m) => (
                <Table.Tr key={m.id}>
                  <Table.Td>{m.label}</Table.Td>
                  <Table.Td>
                    <Badge color="red" variant="light">
                      changed
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      ) : (
        <Text size="sm">Preserved settings (6 sentinel regions): unchanged</Text>
      )}

      {mismatches.length > 0 ? (
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Staging mismatches
          </Text>
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Address</Table.Th>
                <Table.Th>Region</Table.Th>
                <Table.Th>Expected</Table.Th>
                <Table.Th>Actual</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {mismatches.slice(0, MISMATCH_DISPLAY_LIMIT).map((m) => (
                <Table.Tr key={m.address}>
                  <Table.Td>
                    <Code>{hex(m.address)}</Code>
                  </Table.Td>
                  <Table.Td>{m.regionLabel}</Table.Td>
                  <Table.Td>
                    <Code>{bytesToHex(m.expected)}</Code>
                  </Table.Td>
                  <Table.Td>
                    <Code>{m.kind === 'not_read' ? '(not read)' : bytesToHex(m.actual!)}</Code>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {hiddenMismatchCount > 0 ? (
            <Text size="sm" c="dimmed">
              … and {hiddenMismatchCount} more mismatches (download JSON for full list).
            </Text>
          ) : null}
        </Stack>
      ) : null}

      <Group gap="xs">
        <Button size="xs" variant="light" onClick={handleDownloadMarkdown}>
          Download markdown
        </Button>
        {mismatches.length > 0 ? (
          <Button size="xs" variant="light" onClick={handleDownloadJson}>
            Download JSON
          </Button>
        ) : null}
      </Group>

      {log.length > 0 ? (
        <Code block style={{ whiteSpace: 'pre-wrap', fontSize: '0.75rem' }}>
          {log.join('\n')}
        </Code>
      ) : null}
    </Stack>
  );

  if (inModal) {
    return (
      <ScrollArea.Autosize mah="70vh" type="auto">
        {body}
      </ScrollArea.Autosize>
    );
  }

  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
    >
      <Group justify="space-between" mb="sm">
        <Title order={4}>Write verify report</Title>
        <Button size="xs" variant="subtle" onClick={onClose}>
          Close
        </Button>
      </Group>
      <ScrollArea style={{ flex: 1 }} type="auto">
        {body}
      </ScrollArea>
    </Paper>
  );
}
