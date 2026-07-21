import { Alert, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { Link, useNavigate } from 'react-router-dom';
import { applyFilters, DEFAULT_MAP_FILTER_OPTS } from '@core/domain/mapProjection.ts';
import { summariseLibrary } from '@core/domain/summary.ts';
import CodeplugMap from '../components/CodeplugMap/CodeplugMap.tsx';
import ExportProjectYamlPanel from '../components/import-export/ExportProjectYamlPanel.tsx';
import ExportToDrivePanel from '../components/import-export/ExportToDrivePanel.tsx';
import ImportYamlIntoActivePanel from '../components/import-export/ImportYamlIntoActivePanel.tsx';
import { useLibrary } from '../state/useLibrary.ts';
import { useProjects } from '../state/useProjects.ts';
import { ListPage, PageSection, PageSectionGrid } from '../components/ui/index.ts';

export default function SummaryPage() {
  const { library, loading } = useLibrary();
  const { activeProjectId } = useProjects();
  const navigate = useNavigate();

  if (loading) {
    return (
      <ListPage
        title="Summary"
        description="Library inventory and project YAML backup for the active project."
      >
        <Text>Loading…</Text>
      </ListPage>
    );
  }

  const summary = summariseLibrary(library);
  const { channels, zones } = library;
  const mapSkipped = applyFilters(channels, DEFAULT_MAP_FILTER_OPTS).skipped;

  const counts: { label: string; value: number }[] = [
    { label: 'Channels', value: summary.counts.channels },
    { label: 'Talk groups', value: summary.counts.talkGroups },
    { label: 'Digital contacts', value: summary.counts.digitalContacts },
    { label: 'Analog contacts', value: summary.counts.analogContacts },
    { label: 'RX group lists', value: summary.counts.rxGroupLists },
    { label: 'Scan lists', value: summary.counts.scanLists },
    { label: 'Zones', value: summary.counts.zones },
  ];

  return (
    <ListPage
      title="Summary"
      description="Library inventory and project YAML backup for the active project. CPS export for a radio lives under Export for radio."
    >
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
        {summary.channelsWithLocation} channel(s) have a location — browse on{' '}
        <Link to="/library/channels">Channels</Link> or the library map below.
      </Text>

      <PageSection title="Library map">
        <CodeplugMap
          channels={channels}
          zones={zones}
          allChannels={channels}
          height={480}
          onChannelClick={(id) => navigate(`/library/channels/${id}`)}
          onZoneClick={(id) => navigate(`/library/zones/${id}`)}
        />
        {mapSkipped.length > 0 ? (
          <Text size="sm" c="dimmed" mt="sm">
            {mapSkipped.length} channel{mapSkipped.length === 1 ? '' : 's'} not shown on map
            (missing coordinates, Use Location = No, or 0,0).
          </Text>
        ) : null}
      </PageSection>

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

      <PageSection
        title="Project interchange"
        description="Lossless project backup — library, builds, and metadata as native YAML."
      >
        <PageSectionGrid>
          <PageSection title="Import (replace active project)">
            <ImportYamlIntoActivePanel />
          </PageSection>
          <PageSection title="Export">
            <Stack gap="md">
              <ExportProjectYamlPanel key={activeProjectId ?? 'none'} />
              <ExportToDrivePanel key={`${activeProjectId ?? 'none'}-drive`} />
            </Stack>
          </PageSection>
        </PageSectionGrid>
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
