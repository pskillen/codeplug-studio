import { ActionIcon, Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { IconArrowDown, IconArrowUp } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { DataTable, EmptyState, Page, PageHeader, PageSection } from '../../components/ui/index.ts';
import { ICON_STROKE } from '../../lib/iconSizes.ts';
import { COLUMN_PICKER_ROWS, LARGE_VIRTUAL_DEMO_ROWS, STICKY_DEMO_ROWS } from './fixtures.ts';

const EXTREME_DEMO_ROWS = Array.from({ length: 10_000 }, (_, i) => ({
  id: String(i + 1),
  name: `Contact ${String(i + 1).padStart(5, '0')}`,
  score: (i * 13) % 100,
}));

const CALLSIGN_DEMO_ROWS = [
  {
    id: '1',
    name: 'Stornoway repeater',
    callsign: 'GB3DA',
    exportName: 'GB3DA-DMR',
    defaultWire: 'GB3DA Stornoway',
  },
  {
    id: '2',
    name: 'Inverness repeater',
    callsign: 'GB3IV',
    exportName: 'GB3IV',
    defaultWire: 'GB3IV Inverness',
  },
];

export default function StyleguideDataTablePage() {
  const [search, setSearch] = useState('');
  const [searchPending, setSearchPending] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [activateLog, setActivateLog] = useState('none');
  const [externalFilter, setExternalFilter] = useState('');
  const [orderRows, setOrderRows] = useState([
    { id: 'z1', name: 'Alpha zone' },
    { id: 'z2', name: 'Bravo zone' },
    { id: 'z3', name: 'Charlie zone' },
  ]);
  const [extremeSearch, setExtremeSearch] = useState('');

  const filteredStickyRows = useMemo(() => {
    if (!search) return STICKY_DEMO_ROWS;
    const q = search.toLowerCase();
    return STICKY_DEMO_ROWS.filter((r) => r.name.toLowerCase().includes(q));
  }, [search]);

  const embeddedRows = useMemo(() => {
    const q = externalFilter.trim().toLowerCase();
    if (!q) return COLUMN_PICKER_ROWS;
    return COLUMN_PICKER_ROWS.filter((r) => r.name.toLowerCase().includes(q));
  }, [externalFilter]);

  const extremeFiltered = useMemo(() => {
    const q = extremeSearch.trim().toLowerCase();
    if (!q) return EXTREME_DEMO_ROWS;
    return EXTREME_DEMO_ROWS.filter((r) => r.name.toLowerCase().includes(q));
  }, [extremeSearch]);

  const moveOrderRow = (id: string, direction: 'up' | 'down') => {
    setOrderRows((prev) => {
      const index = prev.findIndex((row) => row.id === id);
      if (index < 0) return prev;
      const swapWith = direction === 'up' ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[swapWith]] = [next[swapWith]!, next[index]!];
      return next;
    });
  };

  return (
    <Page width="default">
      <PageHeader
        title="Styleguide — DataTable"
        description={
          <>
            <Link to="/styleguide">← Styleguide</Link> · Roles A (entity list) and D (extreme)
          </>
        }
      />

      <PageSection title="DataTable — empty">
        <DataTable
          variant="list"
          rows={[]}
          rowKey={(row: { id: string }) => row.id}
          nameColumn={{
            getName: (row: { id: string; name: string }) => row.name,
            getPath: () => '#',
          }}
          columns={[]}
          emptyState={<EmptyState message="No channels yet" />}
        />
      </PageSection>

      <PageSection
        title="DataTable — sort, sticky header, search (+ pending)"
        description="Full-width search, result count row, scroll inside the table; click Name or Score to sort. Toggle pending to show the search spinner."
      >
        <Group mb="sm">
          <Button size="compact-sm" variant="light" onClick={() => setSearchPending((v) => !v)}>
            searchPending: {searchPending ? 'true' : 'false'}
          </Button>
        </Group>
        <DataTable
          variant="list"
          rows={filteredStickyRows}
          totalRowCount={STICKY_DEMO_ROWS.length}
          rowKey={(row) => row.id}
          search={search}
          searchPending={searchPending}
          onSearchChange={setSearch}
          searchPlaceholder="Filter demo channels…"
          nameColumn={{
            getName: (row) => row.name,
            getPath: (row) => `#channel-${row.id}`,
          }}
          columns={[
            {
              key: 'score',
              header: 'Score',
              render: (row) => row.score,
              sortValue: (row) => row.score,
            },
          ]}
        />
      </PageSection>

      <PageSection title="DataTable — column picker">
        <DataTable
          variant="list"
          rows={COLUMN_PICKER_ROWS}
          totalRowCount={COLUMN_PICKER_ROWS.length}
          rowKey={(row) => row.id}
          nameColumn={{
            getName: (row) => row.name,
            getPath: (row) => `#${row.id}`,
          }}
          columns={[
            {
              key: 'score',
              header: 'Score',
              render: (row) => row.score,
              sortValue: (row) => row.score,
              hideable: true,
              defaultVisible: true,
            },
            {
              key: 'note',
              header: 'Note',
              render: (row) => row.note,
              hideable: true,
              defaultVisible: false,
            },
          ]}
          columnVisibilityStorageKey="styleguide-datatable-columns"
        />
      </PageSection>

      <PageSection title="DataTable — selection and footer toolbar">
        <DataTable
          variant="list"
          rows={COLUMN_PICKER_ROWS}
          totalRowCount={COLUMN_PICKER_ROWS.length}
          rowKey={(row) => row.id}
          selectable
          selectedKeys={selectedKeys}
          onSelectedKeysChange={setSelectedKeys}
          nameColumn={{
            getName: (row) => row.name,
            getPath: (row) => `#${row.id}`,
          }}
          columns={[
            {
              key: 'score',
              header: 'Score',
              render: (row) => row.score,
              sortValue: (row) => row.score,
            },
          ]}
          toolbar={
            <Button variant="light" size="compact-sm" disabled={selectedKeys.length === 0}>
              Sample bulk action
            </Button>
          }
        />
        <Text size="sm" c="dimmed" mt="xs">
          Selected: {selectedKeys.length ? selectedKeys.join(', ') : 'none'}
        </Text>
      </PageSection>

      <PageSection
        title="DataTable — callsign + custom name render"
        description="Channels-style dual linked columns and stacked export-name subtext (wire-preview charm)."
      >
        <DataTable
          variant="list"
          rows={CALLSIGN_DEMO_ROWS}
          totalRowCount={CALLSIGN_DEMO_ROWS.length}
          rowKey={(row) => row.id}
          callsignColumn={{
            getName: (row) => row.callsign,
            getPath: (row) => `#${row.id}`,
          }}
          nameColumn={{
            getName: (row) => row.name,
            getPath: (row) => `#${row.id}`,
            render: (row) => (
              <Stack gap={2}>
                <Text size="sm" fw={500}>
                  {row.name}
                </Text>
                <Text size="xs" c="dimmed">
                  Export: {row.exportName} · default {row.defaultWire}
                </Text>
              </Stack>
            ),
          }}
          columns={[]}
        />
      </PageSection>

      <PageSection
        title="DataTable — onRowActivate"
        description="Click a row — name renders as plain text (not a link)."
      >
        <DataTable
          variant="list"
          rows={COLUMN_PICKER_ROWS}
          totalRowCount={COLUMN_PICKER_ROWS.length}
          rowKey={(row) => row.id}
          onRowActivate={(row) => setActivateLog(row.name)}
          nameColumn={{
            getName: (row) => row.name,
            getPath: () => '#',
          }}
          columns={[
            {
              key: 'score',
              header: 'Score',
              render: (row) => row.score,
              sortValue: (row) => row.score,
            },
          ]}
        />
        <Text size="sm" c="dimmed" mt="xs">
          Last activated: {activateLog}
        </Text>
      </PageSection>

      <PageSection
        title="DataTable — embedded + external filter"
        description="showSearch false; filter lives above the table (APRS assignment pattern)."
      >
        <TextInput
          label="External filter"
          placeholder="Filter…"
          value={externalFilter}
          onChange={(e) => setExternalFilter(e.currentTarget.value)}
          mb="sm"
          maw={320}
        />
        <DataTable
          variant="embedded"
          showSearch={false}
          rows={embeddedRows}
          totalRowCount={COLUMN_PICKER_ROWS.length}
          rowKey={(row) => row.id}
          nameColumn={{
            getName: (row) => row.name,
            getPath: (row) => `#${row.id}`,
          }}
          columns={[
            {
              key: 'score',
              header: 'Score',
              render: (row) => row.score,
              sortValue: (row) => row.score,
            },
          ]}
        />
      </PageSection>

      <PageSection
        title="DataTable — reorderMode + reorder column"
        description="Reorder mode (Zones): column sort locked; arrows mutate export order. Sort… permanently rewrites order."
      >
        <DataTable
          variant="list"
          reorderMode
          rows={orderRows}
          totalRowCount={orderRows.length}
          rowKey={(row) => row.id}
          nameColumn={{
            getName: (row) => row.name,
            getPath: (row) => `#${row.id}`,
          }}
          columns={[
            {
              key: 'reorder',
              header: 'Order',
              hideable: false,
              render: (row) => {
                const index = orderRows.findIndex((r) => r.id === row.id);
                return (
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      aria-label={`Move ${row.name} up`}
                      disabled={index <= 0}
                      onClick={() => moveOrderRow(row.id, 'up')}
                    >
                      <IconArrowUp size={14} stroke={ICON_STROKE} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      aria-label={`Move ${row.name} down`}
                      disabled={index < 0 || index >= orderRows.length - 1}
                      onClick={() => moveOrderRow(row.id, 'down')}
                    >
                      <IconArrowDown size={14} stroke={ICON_STROKE} />
                    </ActionIcon>
                  </Group>
                );
              },
            },
          ]}
        />
      </PageSection>

      <PageSection
        title="DataTable — storedOrder (hybrid browse)"
        description="Optional hybrid: default export order with elevated header; temporary Name sort + Return to export order. Prefer reorderMode when the list’s only job is agreed order."
      >
        <DataTable
          variant="list"
          storedOrder={{
            columnKey: 'exportOrder',
            label: 'Export order',
            restoreLabel: 'Return to export order',
          }}
          rows={orderRows}
          totalRowCount={orderRows.length}
          rowKey={(row) => row.id}
          nameColumn={{
            getName: (row) => row.name,
            getPath: (row) => `#${row.id}`,
          }}
          columns={[
            {
              key: 'exportOrder',
              header: 'Export order',
              hideable: false,
              render: (row) => {
                const index = orderRows.findIndex((r) => r.id === row.id);
                return (
                  <Group gap={4} wrap="nowrap">
                    <Text size="sm" c="dimmed" w={20}>
                      {index + 1}
                    </Text>
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      aria-label={`Move ${row.name} up`}
                      disabled={index <= 0}
                      onClick={() => moveOrderRow(row.id, 'up')}
                    >
                      <IconArrowUp size={14} stroke={ICON_STROKE} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      aria-label={`Move ${row.name} down`}
                      disabled={index < 0 || index >= orderRows.length - 1}
                      onClick={() => moveOrderRow(row.id, 'down')}
                    >
                      <IconArrowDown size={14} stroke={ICON_STROKE} />
                    </ActionIcon>
                  </Group>
                );
              },
            },
          ]}
        />
      </PageSection>

      <PageSection title="DataTable — filtered empty">
        <DataTable
          variant="list"
          rows={[]}
          totalRowCount={12}
          rowKey={(row: { id: string }) => row.id}
          nameColumn={{
            getName: (row: { id: string; name: string }) => row.name,
            getPath: () => '#',
          }}
          columns={[]}
          search=""
          onSearchChange={() => {}}
          filteredEmptyMessage="No matches for current filter"
        />
      </PageSection>

      <PageSection
        title="DataTable — large virtual list (A auto)"
        description="250 rows with virtualize auto (threshold 75)."
      >
        <DataTable
          variant="list"
          rows={LARGE_VIRTUAL_DEMO_ROWS}
          totalRowCount={LARGE_VIRTUAL_DEMO_ROWS.length}
          rowKey={(row) => row.id}
          nameColumn={{
            getName: (row) => row.name,
            getPath: (row) => `#${row.id}`,
          }}
          columns={[
            {
              key: 'score',
              header: 'Score',
              render: (row) => row.score,
              sortValue: (row) => row.score,
            },
          ]}
        />
      </PageSection>

      <PageSection
        title="DataTable — extreme scale (D)"
        description="10_000 stub rows with scale=extreme (always virtualise). Cheap plain-text cells. Product target ~200k contacts may need indexed search later."
      >
        <DataTable
          variant="list"
          scale="extreme"
          rows={extremeFiltered}
          totalRowCount={EXTREME_DEMO_ROWS.length}
          rowKey={(row) => row.id}
          search={extremeSearch}
          onSearchChange={setExtremeSearch}
          searchPlaceholder="Filter contacts…"
          nameColumn={{
            getName: (row) => row.name,
            getPath: (row) => `#${row.id}`,
          }}
          columns={[
            {
              key: 'score',
              header: 'Score',
              render: (row) => row.score,
              sortValue: (row) => row.score,
            },
          ]}
        />
      </PageSection>
    </Page>
  );
}
