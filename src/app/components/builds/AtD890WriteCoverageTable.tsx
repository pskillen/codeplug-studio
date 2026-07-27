import { Link } from 'react-router-dom';
import { Anchor, Group, Stack, Table, Text } from '@mantine/core';
import { IconCheck, IconMinus, IconX } from '@tabler/icons-react';
import {
  AT_D890_WRITE_COVERAGE_ROWS,
  AT_D890_WRITE_COVERAGE_STATUS_LABEL,
  type AtD890WriteCoverageStatus,
} from '@integrations/radio-io/radios/at-d890uv/writeCoverage.ts';
import { ICON_STROKE } from '../../lib/iconSizes.ts';

const STATUS_ICON_SIZE = 16;

function WriteCoverageStatusCell({ status }: { status: AtD890WriteCoverageStatus }) {
  const label = AT_D890_WRITE_COVERAGE_STATUS_LABEL[status];

  if (status === 'written') {
    return (
      <Group gap={6} wrap="nowrap">
        <IconCheck
          size={STATUS_ICON_SIZE}
          stroke={ICON_STROKE}
          color="var(--mantine-color-teal-6)"
          aria-hidden
        />
        <Text size="sm">{label}</Text>
      </Group>
    );
  }

  if (status === 'planned') {
    return (
      <Group gap={6} wrap="nowrap">
        <IconX
          size={STATUS_ICON_SIZE}
          stroke={ICON_STROKE}
          color="var(--mantine-color-orange-6)"
          aria-hidden
        />
        <Text size="sm">{label}</Text>
      </Group>
    );
  }

  if (status === 'preserved') {
    return (
      <Group gap={6} wrap="nowrap">
        <IconCheck
          size={STATUS_ICON_SIZE}
          stroke={ICON_STROKE}
          color="var(--mantine-color-blue-6)"
          aria-hidden
        />
        <Text size="sm">{label}</Text>
      </Group>
    );
  }

  return (
    <Group gap={6} wrap="nowrap">
      <IconMinus
        size={STATUS_ICON_SIZE}
        stroke={ICON_STROKE}
        color="var(--mantine-color-gray-6)"
        aria-hidden
      />
      <Text size="sm">{label}</Text>
    </Group>
  );
}

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
        When you Write over the cable, Studio updates some parts of the radio from your library and
        leaves others alone. Items marked &ldquo;Not supported yet&rdquo; stay on the radio (or need{' '}
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
              <Table.Td>
                <WriteCoverageStatusCell status={row.status} />
              </Table.Td>
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
