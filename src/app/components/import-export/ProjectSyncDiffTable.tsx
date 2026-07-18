import { Table, Text } from '@mantine/core';
import {
  formatSyncDelta,
  formatSyncTimestamp,
  type ProjectSyncDiff,
  type ProjectSyncNewerSide,
} from '@core/services/projectSyncSummary.ts';

export interface ProjectSyncDiffTableProps {
  diff: ProjectSyncDiff;
}

function newerHint(side: ProjectSyncNewerSide): string | null {
  if (side === 'local') return 'local newer';
  if (side === 'remote') return 'remote newer';
  if (side === 'tie') return 'same';
  return null;
}

function TimestampCell({ value, highlight }: { value: string | null; highlight: boolean }) {
  return (
    <Text size="sm" fw={highlight ? 600 : undefined} c={highlight ? undefined : 'dimmed'}>
      {formatSyncTimestamp(value)}
    </Text>
  );
}

function CountCell({ value, highlight }: { value: number; highlight: boolean }) {
  return (
    <Text size="sm" fw={highlight ? 600 : undefined} ta="right">
      {value}
    </Text>
  );
}

/**
 * Left/right comparison of local IndexedDB vs remote portable YAML summaries.
 */
export default function ProjectSyncDiffTable({ diff }: ProjectSyncDiffTableProps) {
  return (
    <Table.ScrollContainer minWidth={360}>
      <Table striped withTableBorder withColumnBorders fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Metric</Table.Th>
            <Table.Th>Local</Table.Th>
            <Table.Th>Remote</Table.Th>
            <Table.Th>Δ</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {diff.timestamps.map((row) => {
            const hint = newerHint(row.newerSide);
            return (
              <Table.Tr key={row.key}>
                <Table.Td>
                  <Text size="sm">{row.label}</Text>
                </Table.Td>
                <Table.Td>
                  <TimestampCell value={row.local} highlight={row.newerSide === 'local'} />
                </Table.Td>
                <Table.Td>
                  <TimestampCell value={row.remote} highlight={row.newerSide === 'remote'} />
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {hint ?? '—'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            );
          })}
          {diff.counts.map((row) => (
            <Table.Tr key={row.key}>
              <Table.Td>
                <Text size="sm">{row.label}</Text>
              </Table.Td>
              <Table.Td>
                <CountCell value={row.local} highlight={row.delta !== 0} />
              </Table.Td>
              <Table.Td>
                <CountCell value={row.remote} highlight={row.delta !== 0} />
              </Table.Td>
              <Table.Td>
                <Text
                  size="sm"
                  ta="right"
                  fw={row.delta !== 0 ? 600 : undefined}
                  c={row.delta === 0 ? 'dimmed' : row.delta > 0 ? 'teal' : 'orange'}
                >
                  {formatSyncDelta(row.delta)}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
