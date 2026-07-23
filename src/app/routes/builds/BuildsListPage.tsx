import { Button, Group, Loader, Stack, Text, TextInput } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { radioTargetFor } from '@core/radio-targets/index.ts';
import {
  DataTable,
  GradientSegmentedControl,
  ListPage,
  PageSection,
} from '../../components/ui/index.ts';
import type { DataTableColumn } from '../../components/ui/DataTable.tsx';
import type { DataTableSortState } from '../../lib/dataTable/sort.ts';
import { filterRowsByName } from '../../hooks/useListNameQuery.ts';
import { useDebouncedNameFilter } from '../../hooks/useDebouncedNameFilter.ts';
import { DATATABLE_NAME_SORT_KEY } from '../../lib/dataTable/sort.ts';
import { useFormatBuilds } from '../../state/useFormatBuilds.ts';
import { groupFormatBuilds, type BuildsListGroupMode } from './groupFormatBuilds.ts';

const GROUP_OPTIONS = [
  { value: 'list', label: 'List' },
  { value: 'radio', label: 'By radio' },
] as const;

export default function BuildsListPage() {
  const { builds, loading } = useFormatBuilds();
  const navigate = useNavigate();
  const [committedNameFilter, setCommittedNameFilter] = useState('');
  const {
    nameFilterInput,
    nameFilter,
    setNameFilter: setNameFilterInput,
    nameFilterPending,
  } = useDebouncedNameFilter(committedNameFilter, setCommittedNameFilter);
  const [sort, setSort] = useState<DataTableSortState | null>({
    columnKey: DATATABLE_NAME_SORT_KEY,
    direction: 'asc',
  });
  const [groupMode, setGroupMode] = useState<BuildsListGroupMode>('list');
  const filtered = useMemo(
    () => filterRowsByName(builds, nameFilter, (b) => b.name),
    [builds, nameFilter],
  );
  const groups = useMemo(() => {
    if (groupMode === 'list') return null;
    return groupFormatBuilds(filtered, groupMode);
  }, [filtered, groupMode]);

  const columns = useMemo((): DataTableColumn<RadioBuild>[] => {
    return [
      {
        key: 'radio',
        header: 'Radio',
        render: (b) => radioTargetFor(b.radioTargetId)?.label ?? b.radioTargetId,
        sortValue: (b) => radioTargetFor(b.radioTargetId)?.label ?? b.radioTargetId,
      },
      {
        key: 'egress',
        header: 'Export paths',
        render: (b) =>
          radioTargetFor(b.radioTargetId)
            ?.compatibleEgress.map((entry) => entry.label)
            .join(' · ') ?? '—',
        sortValue: (b) =>
          radioTargetFor(b.radioTargetId)
            ?.compatibleEgress.map((entry) => entry.label)
            .join(' · ') ?? '',
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
      description="Named radio configurations from your library — wire names and layout per handheld. Export pathways (Web Serial, NeonPlug, CPS) are chosen per build on Export."
      actions={
        <Button component={Link} to="/builds/new" leftSection={<IconPlus size={16} />}>
          New build
        </Button>
      }
    >
      <Stack gap="lg">
        {builds.length === 0 ? (
          <Text c="dimmed">
            No builds yet. Create one for the radio you are programming — you can keep several builds
            for the same radio type (for example Team A and Team B).
          </Text>
        ) : null}
        {builds.length > 0 ? (
          <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
            <TextInput
              placeholder="Filter name…"
              value={nameFilterInput}
              onChange={(e) => setNameFilterInput(e.currentTarget.value)}
              rightSection={nameFilterPending ? <Loader size={16} /> : undefined}
              maw={360}
              style={{ flex: '1 1 12rem' }}
              aria-label="Filter builds by name"
            />
            <GradientSegmentedControl
              label="Group"
              size="xs"
              scheme="two"
              value={groupMode}
              onChange={setGroupMode}
              data={[...GROUP_OPTIONS]}
            />
          </Group>
        ) : null}
        {groupMode === 'list' ? (
          <DataTable
            variant="list"
            rows={filtered}
            totalRowCount={builds.length}
            sort={sort}
            onSortChange={setSort}
            rowKey={(b) => b.id}
            nameColumn={{
              getName: (b) => b.name,
              getPath: (b) => `/builds/${b.id}`,
            }}
            columns={columns}
          />
        ) : (
          <Stack gap="md">
            {groups?.length === 0 ? (
              <Text size="sm" c="dimmed">
                No builds match this filter.
              </Text>
            ) : null}
            {groups?.map((group) => (
              <PageSection key={group.key} title={`${group.label} (${group.builds.length})`}>
                <DataTable
                  variant="list"
                  rows={group.builds}
                  totalRowCount={group.builds.length}
                  sort={sort}
                  onSortChange={setSort}
                  rowKey={(b) => b.id}
                  nameColumn={{
                    getName: (b) => b.name,
                    getPath: (b) => `/builds/${b.id}`,
                  }}
                  columns={columns}
                />
              </PageSection>
            ))}
          </Stack>
        )}
        {builds.length === 0 ? (
          <Group>
            <Button onClick={() => navigate('/builds/new')}>Create your first build</Button>
          </Group>
        ) : null}
      </Stack>
    </ListPage>
  );
}
