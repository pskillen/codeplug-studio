import { Anchor, Group, Stack, Table, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import type { Library } from '@core/models/library.ts';

export interface ScanListSummaryProps {
  listId: string | null;
  library: Library;
}

export default function ScanListSummary({ listId, library }: ScanListSummaryProps) {
  if (!listId) return null;

  const list = library.scanLists.find((row) => row.id === listId);
  if (!list) {
    return (
      <Text size="sm" c="dimmed">
        Scan list not found
      </Text>
    );
  }

  const channelById = new Map(library.channels.map((channel) => [channel.id, channel]));
  const memberRows = list.memberChannelIds.map((channelId) => {
    const channel = channelById.get(channelId);
    return {
      channelId,
      label: channel ? channelDisplayLabel(channel) : channelId,
      missing: !channel,
    };
  });

  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Anchor component={Link} to={`/library/scan-lists/${list.id}`} size="sm">
          {list.name}
        </Anchor>
        <Text size="sm" c="dimmed">
          {list.memberChannelIds.length} member{list.memberChannelIds.length === 1 ? '' : 's'}
        </Text>
      </Group>

      {memberRows.length === 0 ? (
        <Text size="sm" c="dimmed">
          No members — add channels on the scan list editor
        </Text>
      ) : (
        <Table withTableBorder withColumnBorders striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Channel</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {memberRows.map((row) => (
              <Table.Tr key={row.channelId}>
                <Table.Td>
                  {row.missing ? (
                    <Text size="sm" c="dimmed">
                      {row.label}
                    </Text>
                  ) : (
                    <Anchor component={Link} to={`/library/channels/${row.channelId}`} size="sm">
                      {row.label}
                    </Anchor>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
