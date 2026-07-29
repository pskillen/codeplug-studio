/**
 * Cross-session write verify report for Web Serial Write.
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
import type {
  WriteVerifyDebugContext,
  WriteVerifyRegionStatus,
  WriteVerifyResult,
} from '@integrations/radio-io/writeVerify.ts';

const MISMATCH_DISPLAY_LIMIT = 50;

export interface WriteVerifyReportProps {
  result: WriteVerifyResult;
  debugContext: WriteVerifyDebugContext;
  formatDebugMarkdown: (result: WriteVerifyResult, context: WriteVerifyDebugContext) => string;
  onClose: () => void;
  /** When true, render body only (parent supplies Modal chrome). */
  inModal?: boolean;
  /** Section title for optional kept-region compare (D890: preserved settings). */
  keptSectionTitle?: string;
  /** Dimmed summary when kept compare passes (e.g. "6 sentinel regions"). */
  keptSummaryLabel?: string;
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

function regionStatusColor(status: WriteVerifyRegionStatus): string {
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

function regionStatusLabel(status: WriteVerifyRegionStatus): string {
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

export default function WriteVerifyReport({
  result,
  debugContext,
  formatDebugMarkdown,
  onClose,
  inModal = false,
  keptSectionTitle = 'Retained regions',
  keptSummaryLabel,
}: WriteVerifyReportProps) {
  const [log, setLog] = useState<string[]>(() => [
    `${new Date().toLocaleTimeString()} — verify complete: ${result.staging.mismatchedChunks} mismatched of ${result.staging.totalChunks} staged chunks`,
  ]);

  const regionsByGroup = useMemo(() => {
    const map = new Map<string, typeof result.regions>();
    for (const group of result.regionGroups) {
      map.set(
        group.id,
        result.regions.filter((r) => r.group === group.id),
      );
    }
    return map;
  }, [result.regions, result.regionGroups]);

  const debugMarkdown = useMemo(
    () => formatDebugMarkdown(result, debugContext),
    [formatDebugMarkdown, result, debugContext],
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
    a.download = `write-verify-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
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
    a.download = `write-verify-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    appendLog('Downloaded mismatch JSON');
  }

  const mismatches = result.staging.mismatches;
  const hiddenMismatchCount = Math.max(0, mismatches.length - MISMATCH_DISPLAY_LIMIT);
  const keptOk = result.kept?.ok ?? true;
  const keptMismatches = result.kept?.mismatches ?? [];
  const notReadChunks = result.staging.notReadChunks ?? 0;
  const excludedBookkeepingChunks = result.staging.excludedBookkeepingChunks ?? 0;

  const body = (
    <Stack gap="md" pr={inModal ? undefined : 'xs'}>
      <Alert
        color={result.ok ? 'green' : 'red'}
        title={result.ok ? 'Verify passed' : 'Verify failed'}
      >
        <Text size="sm">
          {result.staging.mismatchedChunks} of {result.staging.totalChunks} staged chunks
          mismatched.
          {notReadChunks > 0 ? ` ${notReadChunks} could not be read back.` : ''}
          {excludedBookkeepingChunks > 0
            ? ` ${excludedBookkeepingChunks} bookkeeping blocks excluded from compare.`
            : ''}{' '}
          {result.kept
            ? `${keptSectionTitle}: ${keptOk ? 'unchanged' : 'changed'}.`
            : null}
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
            {result.regionGroups.map((group) => {
              const rows = regionsByGroup.get(group.id) ?? [];
              if (rows.length === 0) return null;
              const groupBytes = rows.reduce((sum, r) => sum + r.bytesRead, 0);
              const groupStaged = rows.reduce((sum, r) => sum + r.stagedChunkCount, 0);
              const groupMismatches = rows.reduce((sum, r) => sum + r.mismatchedChunks, 0);
              const groupStatus: WriteVerifyRegionStatus =
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
            })}
          </Table.Tbody>
        </Table>
      </Stack>

      {result.kept && !keptOk ? (
        <Stack gap="xs">
          <Text fw={600} size="sm">
            {keptSectionTitle}
          </Text>
          <Table withTableBorder>
            <Table.Tbody>
              {keptMismatches.map((m) => (
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
      ) : result.kept && keptOk ? (
        <Text size="sm">
          {keptSectionTitle}
          {keptSummaryLabel ? ` (${keptSummaryLabel})` : ''}: unchanged
        </Text>
      ) : null}

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
