import { IconPlus, IconRadio } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import {
  egressSummary,
  radioTargetDisplayLabel,
  radioTargetFor,
} from '@core/radio-targets/index.ts';
import {
  Button,
  DataTable,
  EmptyState,
  SearchInput,
  SegmentedControl,
  type DataTableColumn,
  type DataTableSortState,
} from '../../components/v2/index.ts';
import { Loader, Text } from '@mantine/core';
import { filterRowsByName } from '../../hooks/useListNameQuery.ts';
import { useDebouncedNameFilter } from '../../hooks/useDebouncedNameFilter.ts';
import { DATATABLE_NAME_SORT_KEY } from '../../lib/dataTable/sort.ts';
import { createNameColumn } from '../../lib/libraryListTable.tsx';
import { useFormatBuilds } from '../../state/useFormatBuilds.ts';
import BuildsByRadio from '../../components/builds/BuildsByRadio.tsx';
import classes from './BuildsListPage.module.css';

type BuildsListGroupMode = 'list' | 'radio';

const GROUP_OPTIONS = [
  { value: 'radio', label: 'Radio' },
  { value: 'list', label: 'List' },
] as const;

function summaryFor(radioTargetId: string): string {
  const target = radioTargetFor(radioTargetId);
  return target ? egressSummary(target) : '';
}

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
    key: DATATABLE_NAME_SORT_KEY,
    direction: 'asc',
  });
  const [groupMode, setGroupMode] = useState<BuildsListGroupMode>('radio');
  const filtered = useMemo(
    () => filterRowsByName(builds, nameFilter, (b) => b.name),
    [builds, nameFilter],
  );
  const radioCount = useMemo(() => new Set(builds.map((b) => b.radioTargetId)).size, [builds]);

  const columns = useMemo((): DataTableColumn<RadioBuild>[] => {
    return [
      createNameColumn<RadioBuild>({
        getName: (b) => b.name,
        getPath: (b) => `/builds/${b.id}/export`,
      }),
      {
        key: 'radio',
        header: 'Radio',
        sortable: true,
        render: (b) => radioTargetDisplayLabel(b.radioTargetId),
        sortValue: (b) => radioTargetDisplayLabel(b.radioTargetId),
      },
      {
        key: 'egress',
        header: 'Export paths',
        sortable: true,
        render: (b) => summaryFor(b.radioTargetId) || '—',
        sortValue: (b) => summaryFor(b.radioTargetId),
      },
      {
        key: 'updated',
        header: 'Updated',
        sortable: true,
        render: (b) => new Date(b.updatedAt).toLocaleString(),
        sortValue: (b) => b.updatedAt,
      },
    ];
  }, []);

  if (loading) {
    return (
      <div className={classes.page}>
        <Text>Loading builds…</Text>
      </div>
    );
  }

  return (
    <div className={classes.page}>
      <div className={classes.headerRow}>
        <div>
          <h1 className={classes.title}>Export for radio</h1>
          <p className={classes.subtitle}>
            Each build is one way of loading your library into one radio — wire names, layout, and
            export pathway. {builds.length} {builds.length === 1 ? 'build' : 'builds'} across{' '}
            {radioCount} {radioCount === 1 ? 'radio' : 'radios'}.
          </p>
        </div>
        <div className={classes.headerActions}>
          <Button
            className={classes.newBuild}
            variant="primary"
            onClick={() => navigate('/builds/new')}
            leftSection={<IconPlus size={16} stroke={1.75} />}
          >
            New build
          </Button>
        </div>
      </div>

      {builds.length === 0 ? (
        <EmptyState
          icon={<IconRadio size={20} stroke={1.75} />}
          title="No builds yet"
          description="Create a build for the radio you are programming. You can keep several builds for the same radio type (Team A / Team B)."
          action={
            <Button variant="primary" onClick={() => navigate('/builds/new')}>
              New build
            </Button>
          }
        />
      ) : (
        <>
          <div className={classes.toolbar}>
            <SearchInput
              value={nameFilterInput}
              onChange={(e) => setNameFilterInput(e.currentTarget.value)}
              placeholder="Filter builds…"
              aria-label="Filter builds by name"
              className={classes.search}
            />
            {nameFilterPending ? <Loader size="xs" /> : null}
            <span className={classes.groupLabel}>Group by</span>
            <SegmentedControl
              size="md"
              value={groupMode}
              onChange={(value) => setGroupMode(value as BuildsListGroupMode)}
              options={GROUP_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            />
          </div>

          {groupMode === 'radio' ? (
            filtered.length === 0 ? (
              <Text size="sm" c="dimmed">
                No builds match this filter.
              </Text>
            ) : (
              <BuildsByRadio builds={filtered} />
            )
          ) : (
            <DataTable
              variant="list"
              rows={filtered}
              totalRowCount={builds.length}
              sort={sort}
              onSortChange={setSort}
              getRowId={(b) => b.id}
              columns={columns}
            />
          )}
        </>
      )}
    </div>
  );
}
