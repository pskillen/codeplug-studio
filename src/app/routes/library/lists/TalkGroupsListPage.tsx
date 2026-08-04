import { useMemo } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import type { TalkGroup } from '@core/models/library.ts';
import EntityListDeleteAction from '../../../components/library/EntityListDeleteAction.tsx';
import ModePill from '../../../components/pills/ModePill.tsx';
import { Button, DesignSystemV2Provider } from '../../../components/v2/index.ts';
import { DataTable } from '../../../components/ui/index.ts';
import type { DataTableColumn } from '../../../components/ui/DataTable.tsx';
import { filterRowsByName, useListNameQuery } from '../../../hooks/useListNameQuery.ts';
import { usePersistedEntityListSort } from '../../../hooks/usePersistedEntityListSort.ts';
import { DATATABLE_NAME_SORT_KEY } from '../../../lib/dataTable/sort.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import { formatReferenceCount, referenceCount } from '../../../lib/listReferences.ts';
import { useLibrary } from '../../../state/useLibrary.ts';
import classes from './LibraryListPage.module.css';

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
        header: 'Channels / RX lists using',
        render: (tg) => {
          const channelCount = referenceCount(library, { kind: 'talkGroup', id: tg.id });
          const rglCount = library.rxGroupLists.filter((r) =>
            r.members.some((m) => m.ref.kind === 'talkGroup' && m.ref.id === tg.id),
          ).length;
          if (channelCount === 0 && rglCount === 0) return '—';
          return `${formatReferenceCount(channelCount)} / ${formatReferenceCount(rglCount)}`;
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
        render: (tg) => tg.comment || '—',
        sortValue: (tg) => tg.comment || '',
      },
      {
        key: 'actions',
        header: '',
        hideable: false,
        render: (tg) => (
          <EntityListDeleteAction kind="talkGroup" entityId={tg.id} label={tg.name} />
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
          <h1 className={classes.title}>Talk groups</h1>
          <p className={classes.description}>Loading library…</p>
        </div>
      </DesignSystemV2Provider>
    );
  }

  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <div className={classes.headerRow}>
          <div>
            <h1 className={classes.title}>Talk groups</h1>
            <p className={classes.description}>
              DMR and other digital talk groups referenced by channels and receive group lists.
            </p>
          </div>
          <div className={classes.toolbarActions}>{listActions}</div>
        </div>

        <DataTable
          variant="list"
          selectionChrome="v2"
          rows={filtered}
          totalRowCount={talkGroups.length}
          search={nameFilterInput}
          searchPending={nameFilterPending}
          onSearchChange={setNameFilter}
          searchPlaceholder="Filter name…"
          sort={sort}
          onSortChange={setSort}
          rowKey={(tg) => tg.id}
          nameColumn={{
            getName: (tg) => tg.name,
            getPath: (tg) => `/library/talk-groups/${tg.id}`,
          }}
          columns={columns}
        />
      </div>
    </DesignSystemV2Provider>
  );
}
