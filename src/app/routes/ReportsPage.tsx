import { Alert, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { summariseLibrary } from '@core/domain/summary.ts';
import { useLibrary } from '../state/useLibrary.ts';
import { ListPage, PageSection, PageSectionGrid } from '../components/ui/index.ts';

export default function ReportsPage() {
  const { library, loading } = useLibrary();

  if (loading) {
    return (
      <ListPage title="Reports" description="Read-only summary of the active project's library.">
        <Text>Loading…</Text>
      </ListPage>
    );
  }

  const summary = summariseLibrary(library);
  const counts: { label: string; value: number }[] = [
    { label: 'Channels', value: summary.counts.channels },
    { label: 'Talk groups', value: summary.counts.talkGroups },
    { label: 'Digital contacts', value: summary.counts.digitalContacts },
    { label: 'Analog contacts', value: summary.counts.analogContacts },
    { label: 'RX group lists', value: summary.counts.rxGroupLists },
    { label: 'Zones', value: summary.counts.zones },
  ];

  return (
    <ListPage title="Reports" description="Read-only summary of the active project's library.">
      <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="sm">
        {counts.map((c) => (
          <PageSection key={c.label}>
            <Text size="xl" fw={700}>
              {c.value}
            </Text>
            <Text size="sm" c="dimmed">
              {c.label}
            </Text>
          </PageSection>
        ))}
      </SimpleGrid>

      <PageSectionGrid>
        <Breakdown
          title="Channels by mode"
          rows={summary.channelsByMode.map((r) => ({ label: r.mode, count: r.count }))}
        />
        <Breakdown
          title="Channels by band"
          rows={summary.channelsByBand.map((r) => ({ label: r.band, count: r.count }))}
        />
      </PageSectionGrid>

      <Text c="dimmed">
        {summary.channelsWithLocation} channel(s) have a location (
        <Link to="/map">view on map</Link>).
      </Text>

      <PageSection title="Integrity warnings">
        {summary.danglingReferences.length === 0 ? (
          <Alert color="green">No dangling references — all relationships resolve.</Alert>
        ) : (
          <Stack gap="xs">
            {summary.danglingReferences.map((d, i) => (
              <Text key={i} c="red" size="sm">
                {d.fromKind} “{d.fromName}” references a missing {d.targetKind} ({d.relationship})
              </Text>
            ))}
          </Stack>
        )}
      </PageSection>
    </ListPage>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  return (
    <PageSection title={title}>
      {rows.length === 0 ? (
        <Text c="dimmed">No channels.</Text>
      ) : (
        <Table>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.label}>
                <Table.Td>{r.label}</Table.Td>
                <Table.Td fw={600}>{r.count}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </PageSection>
  );
}
