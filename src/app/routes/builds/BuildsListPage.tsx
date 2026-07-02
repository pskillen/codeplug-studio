import { Button, Group, Stack, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import { traitProfileFor } from '@core/models/traits.ts';
import { DataTable, ListPage } from '../../components/ui/index.ts';
import type { DataTableColumn } from '../../components/ui/DataTable.tsx';
import type { DataTableSortState } from '../../lib/dataTable/sort.ts';
import { filterRowsByName } from '../../hooks/useListNameQuery.ts';
import { useDebouncedNameFilter } from '../../hooks/useDebouncedNameFilter.ts';
import { DATATABLE_NAME_SORT_KEY } from '../../lib/dataTable/sort.ts';
import { useFormatBuilds } from '../../state/useFormatBuilds.ts';

export default function BuildsListPage() {
  const { builds, loading } = useFormatBuilds();
  const navigate = useNavigate();
  const [nameFilter, setNameFilter] = useState('');
  const { nameFilterInput, setNameFilter: setNameFilterInput, nameFilterPending } =
    useDebouncedNameFilter(nameFilter, setNameFilter);
  const [sort, setSort] = useState<DataTableSortState | null>({
    columnKey: DATATABLE_NAME_SORT_KEY,
    direction: 'asc',
  });
  const filtered = useMemo(
    () => filterRowsByName(builds, nameFilter, (b) => b.name),
    [builds, nameFilter],
  );

  const columns = useMemo((): DataTableColumn<FormatBuild>[] => {
    return [
      {
        key: 'format',
        header: 'Format',
        render: (b) => b.formatId,
        sortValue: (b) => b.formatId,
      },
      {
        key: 'profile',
        header: 'Profile',
        render: (b) => traitProfileFor(b.profileId)?.label ?? b.profileId,
        sortValue: (b) => traitProfileFor(b.profileId)?.label ?? b.profileId,
      },
      {
        key: 'updated',
        header: 'Updated',
        render: (b) => new Date(b.updatedAt).toLocaleString(),
        sortValue: (b) => b.updatedAt,
      },
    ];
  }, []);

  if (loading) {
    return (
      <ListPage title="Builds">
        <Text>Loading builds…</Text>
      </ListPage>
    );
  }

  return (
    <ListPage
      title="Builds"
      description="Format-specific assemblies from your library — one build per radio workflow."
      actions={
        <Button component={Link} to="/builds/new" leftSection={<IconPlus size={16} />}>
          New build
        </Button>
      }
    >
      <Stack gap="lg">
        {builds.length === 0 ? (
          <Text c="dimmed">
            No builds yet. Create one to organise library channels for a target CPS format.
          </Text>
        ) : null}
        <DataTable
          variant="list"
          rows={filtered}
          totalRowCount={builds.length}
          search={nameFilterInput}
          searchPending={nameFilterPending}
          onSearchChange={setNameFilterInput}
          searchPlaceholder="Filter name…"
          sort={sort}
          onSortChange={setSort}
          rowKey={(b) => b.id}
          nameColumn={{
            getName: (b) => b.name,
            getPath: (b) => `/builds/${b.id}`,
          }}
          columns={columns}
        />
        {builds.length === 0 ? (
          <Group>
            <Button onClick={() => navigate('/builds/new')}>Create your first build</Button>
          </Group>
        ) : null}
      </Stack>
    </ListPage>
  );
}
