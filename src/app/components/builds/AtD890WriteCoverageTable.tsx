import { Link } from 'react-router-dom';
import { Anchor, Stack, Table, Text } from '@mantine/core';
import {
  AT_D890_WRITE_COVERAGE_ROWS,
  AT_D890_WRITE_COVERAGE_STATUS_LABEL,
} from '@integrations/radio-io/radios/at-d890uv/writeCoverage.ts';

export interface AtD890WriteCoverageTableProps {
  buildId: string;
  hasHydration?: boolean;
}

export default function AtD890WriteCoverageTable({
  buildId,
  hasHydration = false,
}: AtD890WriteCoverageTableProps) {
  return (
    <Stack gap={4}>
      <Text fw={600} size="sm">
        What Write updates
      </Text>
      <Text size="sm" c="dimmed">
        When you Write over the cable, Studio updates some parts of the radio from your build and
        leaves others alone. Items marked &ldquo;Not written yet&rdquo; stay on the radio (or need{' '}
        <strong>Anytone CSV</strong>) until Studio supports them.
      </Text>
      <Table withTableBorder withColumnBorders striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>On the radio</Table.Th>
            <Table.Th>On Write</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {AT_D890_WRITE_COVERAGE_ROWS.map((row) => (
            <Table.Tr key={row.label}>
              <Table.Td>{row.label}</Table.Td>
              <Table.Td>{AT_D890_WRITE_COVERAGE_STATUS_LABEL[row.status]}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {hasHydration ? (
        <Text size="xs" c="dimmed">
          For a detailed retain map from your last Read, see{' '}
          <Anchor component={Link} to={`/builds/${buildId}/radio-image`} size="xs">
            Radio image
          </Anchor>
          .
        </Text>
      ) : null}
    </Stack>
  );
}
