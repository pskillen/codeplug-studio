import { Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { DataTable, Page, PageHeader, PageSection } from '../../../components/ui/index.ts';
import { CountTile, MapPanel, Panel, Pill } from '../../../components/v2/index.ts';
import { DSV2_TOKENS } from '../../../theme-v2.ts';
import { SAMPLE_ROWS } from '../fixtures.ts';

export default function StyleguideV2DataDisplayPage() {
  return (
    <Page width="default">
      <PageHeader
        title="Data display"
        description={
          <>
            <Link to="/styleguide/v2">← Design system v2</Link>
          </>
        }
      />

      <PageSection title="CountTile" description="Summary stat grid tiles.">
        <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="sm">
          <CountTile value={42} label="Channels" />
          <CountTile value={8} label="Talk groups" />
          <CountTile value={18} total={24} label="In build" />
        </SimpleGrid>
      </PageSection>

      <PageSection title="Panel" description="Titled bordered section container.">
        <Panel title="Identity" sub="Optional description below the title.">
          <Text size="sm">Panel body content.</Text>
        </Panel>
      </PageSection>

      <PageSection title="Pill" description="Named tones plus tone=semantic escape hatch.">
        <Group gap="sm" wrap="wrap">
          <Pill tone="neutral">Neutral</Pill>
          <Pill tone="accent">Accent</Pill>
          <Pill tone="accentSolid">Accent solid</Pill>
          <Pill tone="success">Success</Pill>
          <Pill tone="warning">Warning</Pill>
          <Pill
            tone="semantic"
            color={DSV2_TOKENS.colors.band2m}
            textColor={DSV2_TOKENS.colors.pillTextLight}
          >
            2m
          </Pill>
          <Pill
            tone="semantic"
            color={DSV2_TOKENS.colors.modeDmr}
            textColor={DSV2_TOKENS.colors.pillTextLight}
          >
            DMR
          </Pill>
          <Pill tone="semantic" color={DSV2_TOKENS.colors.modeFm}>
            FM
          </Pill>
          <Pill tone="neutral" onRemove={() => undefined}>
            Zone chip
          </Pill>
          <Pill tone="dashed" onClick={() => undefined}>
            + Add to zone
          </Pill>
        </Group>
      </PageSection>

      <PageSection
        title="DataTable (re-skinned)"
        description="Existing ui/DataTable inside the v2 provider — radii/colors from themeV2."
      >
        <DataTable
          variant="list"
          rows={[...SAMPLE_ROWS]}
          totalRowCount={SAMPLE_ROWS.length}
          rowKey={(row) => row.id}
          nameColumn={{
            getName: (row) => row.name,
            getPath: (row) => `#${row.id}`,
          }}
          columns={[
            {
              key: 'id',
              header: 'Id',
              sortable: true,
              render: (row) => row.id,
              sortValue: (row) => row.id,
            },
          ]}
          emptyState={<Text size="sm">No rows</Text>}
        />
      </PageSection>

      <PageSection title="MapPanel" description="Hatch placeholder until CodeplugMap (#925).">
        <Stack gap="sm">
          <MapPanel
            title="Channel location"
            onSettingsClick={() => undefined}
            legend={
              <Text size="sm" c="dimmed">
                Placeholder map — not a live tile layer
              </Text>
            }
          />
        </Stack>
      </PageSection>
    </Page>
  );
}
