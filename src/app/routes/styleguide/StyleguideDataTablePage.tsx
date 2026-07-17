import { Button, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { DataTable, EmptyState, Page, PageHeader, PageSection } from '../../components/ui/index.ts';
import { COLUMN_PICKER_ROWS, LARGE_VIRTUAL_DEMO_ROWS, STICKY_DEMO_ROWS } from './fixtures.ts';

export default function StyleguideDataTablePage() {
  const [search, setSearch] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const filteredStickyRows = useMemo(() => {
    if (!search) return STICKY_DEMO_ROWS;
    const q = search.toLowerCase();
    return STICKY_DEMO_ROWS.filter((r) => r.name.toLowerCase().includes(q));
  }, [search]);

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
        title="DataTable — sort, sticky header, search"
        description="Full-width search, result count row, scroll inside the table; click Name or Score to sort."
      >
        <DataTable
          variant="list"
          rows={filteredStickyRows}
          totalRowCount={STICKY_DEMO_ROWS.length}
          rowKey={(row) => row.id}
          search={search}
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
        title="DataTable — large virtual list"
        description="250 rows with virtualize auto (threshold 75). Scroll to confirm sticky header and smooth tbody windowing."
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
    </Page>
  );
}
