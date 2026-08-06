import { useMemo } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import type { TalkGroup } from '@core/models/library.ts';
import EntityListRowDeleteAction from '../../../components/library/EntityListRowDeleteAction.tsx';
import LibraryInventoryHeader from '../../../components/library/LibraryInventoryHeader.tsx';
import ModePill from '../../../components/pills/ModePill.tsx';
import {
  Button,
  DataTable,
  DesignSystemV2Provider,
  type DataTableColumn,
} from '../../../components/v2/index.ts';
import { filterRowsByName, useListNameQuery } from '../../../hooks/useListNameQuery.ts';
import { usePersistedEntityListSort } from '../../../hooks/usePersistedEntityListSort.ts';
import { DATATABLE_NAME_SORT_KEY } from '../../../lib/dataTable/sort.ts';
import { createNameColumn, v1SortToV2, v2SortToV1 } from '../../../lib/libraryListTable.tsx';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import { formatReferenceCount, referenceCount } from '../../../lib/listReferences.ts';
import { useLibrary } from '../../../state/useLibrary.ts';
import classes from '../../../components/library/LibraryInventoryPage.module.css';

export default function TalkGroupsListPage() {
  const navigate = useNavigate();
  const { library, loading } = useLibrary();
  const { talkGroups } = library;
  const { nameFilter, nameFilterInput, nameFilterPending, setNameFilter } =
    useListNameQuery('talk-groups');
  const [sort, setSort] = usePersistedEntityListSort('talk-groups', {
    columnKey: DATATABLE_NAME_SORT_KEY,
    direction: 'asc',
  });
  const filtered = useMemo(
    () => filterRowsByName(talkGroups, nameFilter, (tg) => tg.name),
    [talkGroups, nameFilter],
  );

  const columns = useMemo((): DataTableColumn<TalkGroup>[] => {
    return [
      createNameColumn<TalkGroup>({
        getName: (tg) => tg.name,
        getPath: (tg) => `/library/talk-groups/${tg.id}`,
      }),
      {
        key: 'mode',
        header: 'Mode',
        render: (tg) => <ModePill mode={tg.mode} size="xs" />,
        sortValue: (tg) => tg.mode,
      },
      {
        key: 'digitalId',
        header: 'ID',
        render: (tg) => tg.digitalId,
        sortValue: (tg) => tg.digitalId,
      },
      {
        key: 'abbreviation',
        header: 'Abbrev',
        render: (tg) => tg.abbreviation?.trim() || '—',
        sortValue: (tg) => tg.abbreviation?.trim() || '',
      },
      {
        key: 'usage',
        header: 'Channels using',
        render: (tg) => {
          const channelCount = referenceCount(library, { kind: 'talkGroup', id: tg.id });
          const rglCount = library.rxGroupLists.filter((r) =>
            r.members.some((m) => m.ref.kind === 'talkGroup' && m.ref.id === tg.id),
          ).length;
          if (channelCount === 0 && rglCount === 0) return '—';
          return `${formatReferenceCount(channelCount)} / ${formatReferenceCount(rglCount)} RX`;
        },
        sortValue: (tg) => {
          const channelCount = referenceCount(library, { kind: 'talkGroup', id: tg.id });
          const rglCount = library.rxGroupLists.filter((r) =>
            r.members.some((m) => m.ref.kind === 'talkGroup' && m.ref.id === tg.id),
          ).length;
          return channelCount * 10_000 + rglCount;
        },
      },
      {
        key: 'comment',
        header: 'Comment',
        hideOnMobile: true,
        render: (tg) => tg.comment || '—',
        sortValue: (tg) => tg.comment || '',
      },
      {
        key: 'actions',
        header: '',
        hideable: false,
        width: '52px',
        render: (tg) => (
          <EntityListRowDeleteAction kind="talkGroup" entityId={tg.id} label={tg.name} />
        ),
      },
    ];
  }, [library]);

  const listActions = (
    <Button
      variant="primary"
      leftSection={<IconPlus size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
      onClick={() => navigate('/library/talk-groups/new')}
    >
      New talk group
    </Button>
  );

  if (loading) {
    return (
      <DesignSystemV2Provider>
        <div className={classes.page}>
          <LibraryInventoryHeader title="Talk groups" subtitle="Loading library…" />
        </div>
      </DesignSystemV2Provider>
    );
  }

  const countLabel =
    talkGroups.length === 1
      ? '1 talk group in this project'
      : `${talkGroups.length} talk groups in this project`;

  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <LibraryInventoryHeader title="Talk groups" subtitle={countLabel} actions={listActions} />

        <DataTable
          columns={columns}
          rows={filtered}
          getRowId={(tg) => tg.id}
          totalRowCount={talkGroups.length}
          search={{
            value: nameFilterInput,
            onChange: setNameFilter,
            placeholder: 'Filter name…',
            pending: nameFilterPending,
          }}
          sort={v1SortToV2(sort)}
          onSortChange={(next) => {
            const v1 = v2SortToV1(next);
            if (v1) setSort(v1);
          }}
          emptyMessage="No talk groups in this project yet."
          filteredEmptyMessage={
            nameFilter.trim()
              ? `No talk groups match “${nameFilter.trim()}”.`
              : 'No talk groups match your filter.'
          }
          onRowActivate={(tg) => navigate(`/library/talk-groups/${tg.id}`)}
        />
      </div>
    </DesignSystemV2Provider>
  );
}
