import { Anchor, Badge, Group, Stack, Table, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { Library } from '@core/models/library.ts';
import {
  formatTimeSlotOverride,
  resolveRxGroupListMemberDisplay,
} from '../../lib/rxGroupListMembers.ts';

export interface RxGroupListSummaryProps {
  listId: string | null;
  library: Library;
}

export default function RxGroupListSummary({ listId, library }: RxGroupListSummaryProps) {
  if (!listId) return null;

  const list = library.rxGroupLists.find((row) => row.id === listId);
  if (!list) {
    return (
      <Text size="sm" c="dimmed">
        RX group list not found
      </Text>
    );
  }

  const memberRows = list.members.map((member) => resolveRxGroupListMemberDisplay(member, library));

  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Anchor component={Link} to={`/library/rx-group-lists/${list.id}`} size="sm">
          {list.name}
        </Anchor>
        <Text size="sm" c="dimmed">
          {list.members.length} member{list.members.length === 1 ? '' : 's'}
        </Text>
      </Group>

      {memberRows.length === 0 ? (
        <Text size="sm" c="dimmed">
          No members
        </Text>
      ) : (
        <Table withTableBorder withColumnBorders striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Kind</Table.Th>
              <Table.Th>ID</Table.Th>
              <Table.Th>TS override</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {memberRows.map((row) => (
              <Table.Tr key={`${row.ref.kind}:${row.ref.id}`}>
                <Table.Td>
                  <Text size="sm" c={row.brokenRef ? 'dimmed' : undefined}>
                    {row.name}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm" color={row.kindLabel === 'Talk group' ? undefined : 'grape'}>
                    {row.kindLabel}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" ff="monospace" c="dimmed">
                    {row.digitalId ?? '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {formatTimeSlotOverride(row.timeSlotOverride)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
