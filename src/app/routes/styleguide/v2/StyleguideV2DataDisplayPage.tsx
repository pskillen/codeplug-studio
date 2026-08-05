import { Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import MapLocationPicker from '../../../components/MapLocationPicker/MapLocationPicker.tsx';
import { DataTable, Page, PageHeader, PageSection } from '../../../components/ui/index.ts';
import {
  Button,
  CountTile,
  DataTable as DataTableV2,
  MapPanel,
  Panel,
  Pill,
  RowActionIcon,
} from '../../../components/v2/index.ts';
import { ICON_SIZE_ACTION } from '../../../lib/iconSizes.ts';
import { DSV2_TOKENS } from '../../../theme-v2.ts';
import { LARGE_VIRTUAL_DEMO_ROWS, SAMPLE_ROWS, STICKY_DEMO_ROWS } from '../fixtures.ts';

interface NestedDemoRow {
  id: string;
  name: string;
  children?: NestedDemoRow[];
}

const NESTED_DEMO_ROWS: NestedDemoRow[] = [
  {
    id: 'zone-1',
    name: 'Zone: Highlands',
    children: [
      { id: 'ch-1', name: 'GB3DA Stornoway' },
      { id: 'ch-2', name: 'GB3IV Inverness' },
    ],
  },
  {
    id: 'zone-2',
    name: 'Zone: Central Belt',
    children: [{ id: 'ch-3', name: 'GB7GM Glasgow' }],
  },
];

export default function StyleguideV2DataDisplayPage() {
  const [dataTableSearch, setDataTableSearch] = useState('');
  const [dataTableSelected, setDataTableSelected] = useState<string[]>([]);
  const [reorderRows, setReorderRows] = useState(() => STICKY_DEMO_ROWS.slice(0, 5));
  const [reorderSelected, setReorderSelected] = useState<string[]>([]);
  const [activatedRow, setActivatedRow] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<string[]>([]);

  const filteredDataTableRows = STICKY_DEMO_ROWS.filter((row) =>
    row.name.toLowerCase().includes(dataTableSearch.toLowerCase()),
  );

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

      <PageSection title="RowActionIcon" description="Icon-only row action, stops propagation.">
        <Group gap="xs">
          <RowActionIcon
            icon={<IconPencil size={ICON_SIZE_ACTION} />}
            onClick={() => undefined}
            label="Edit"
          />
          <RowActionIcon
            icon={<IconTrash size={ICON_SIZE_ACTION} />}
            onClick={() => undefined}
            label="Delete"
            tone="destructive"
          />
          <RowActionIcon
            icon={<IconTrash size={ICON_SIZE_ACTION} />}
            onClick={() => undefined}
            label="Delete (disabled)"
            disabled
          />
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

      <PageSection
        title="DataTable (v2)"
        description="New v2 port: sort, search, counts. Fork of the DS spec — selection/reorder/nesting land in later commits."
      >
        <DataTableV2
          rows={filteredDataTableRows}
          getRowId={(row) => row.id}
          totalRowCount={STICKY_DEMO_ROWS.length}
          resultCount={filteredDataTableRows.length}
          search={{
            value: dataTableSearch,
            onChange: setDataTableSearch,
            placeholder: 'Filter channels…',
          }}
          selectable
          selectedKeys={dataTableSelected}
          onSelectionChange={setDataTableSelected}
          isRowSelectable={(row) => row.score > 0}
          onClearSelection={() => setDataTableSelected([])}
          bulkActions={
            <Button variant="secondary" size="sm" onClick={() => setDataTableSelected([])}>
              Delete selected
            </Button>
          }
          columns={[
            {
              key: 'name',
              header: 'Name',
              render: (row) => row.name,
              sortable: true,
              sortValue: (row) => row.name,
            },
            {
              key: 'score',
              header: 'Score',
              render: (row) => row.score,
              sortable: true,
              sortValue: (row) => row.score,
              align: 'right',
              width: '100px',
              dim: true,
            },
          ]}
          caption="Header click cycles ascending → descending → unsorted."
        />
      </PageSection>

      <PageSection
        title="DataTable (v2) — reorderMode + bulkReorder"
        description="Column sort disabled; per-row and bulk Move up/down mutate the agreed order."
      >
        <DataTableV2
          rows={reorderRows}
          getRowId={(row) => row.id}
          reorderMode
          onReorder={setReorderRows}
          selectable
          bulkReorder
          selectedKeys={reorderSelected}
          onSelectionChange={setReorderSelected}
          onClearSelection={() => setReorderSelected([])}
          columns={[{ key: 'name', header: 'Name', render: (row) => row.name }]}
        />
      </PageSection>

      <PageSection
        title="DataTable (v2) — nested + row activate"
        description="Expand/collapse lead column; whole-row click opens a detail (wire-preview shape)."
      >
        <Stack gap="xs">
          {activatedRow ? (
            <Text size="sm" c="dimmed">
              Activated: {activatedRow}
            </Text>
          ) : null}
          <DataTableV2
            rows={NESTED_DEMO_ROWS}
            getRowId={(row) => row.id}
            nested
            getChildren={(row) => row.children}
            getRowVariant={(row) => (row.children?.length ? 'nestParent' : undefined)}
            onRowActivate={(row) => setActivatedRow(row.name)}
            columns={[{ key: 'name', header: 'Name', render: (row) => row.name }]}
          />
        </Stack>
      </PageSection>

      <PageSection
        title="DataTable (v2) — scale=extreme + column visibility"
        description="Sticky header over a max-height scroll region; hideable columns via Show/hide cols."
      >
        <DataTableV2
          rows={LARGE_VIRTUAL_DEMO_ROWS}
          getRowId={(row) => row.id}
          scale="extreme"
          visibleKeys={visibleKeys}
          onVisibleKeysChange={setVisibleKeys}
          totalRowCount={LARGE_VIRTUAL_DEMO_ROWS.length}
          columns={[
            { key: 'name', header: 'Name', render: (row) => row.name },
            {
              key: 'score',
              header: 'Score',
              render: (row) => row.score,
              align: 'right',
              width: '90px',
            },
            {
              key: 'note',
              header: 'Note',
              render: () => '—',
              hideable: true,
              defaultVisible: false,
              width: '80px',
              dim: true,
            },
          ]}
        />
      </PageSection>

      <PageSection
        title="MapPanel"
        description="Hatch placeholder (no children) and live map inside v2 chrome."
      >
        <Stack gap="lg">
          <MapPanel
            title="Empty state"
            onSettingsClick={() => undefined}
            legend={
              <Text size="sm" c="dimmed">
                Hatch placeholder when no map children are passed
              </Text>
            }
          />
          <MapPanel
            title="Channel location"
            height={280}
            legend={
              <Text size="sm" c="dimmed">
                Live OpenStreetMap tiles via MapLocationPicker
              </Text>
            }
          >
            <MapLocationPicker
              lat={56.5}
              lon={-4.0}
              onPick={() => undefined}
              height="100%"
              active
            />
          </MapPanel>
        </Stack>
      </PageSection>
    </Page>
  );
}
