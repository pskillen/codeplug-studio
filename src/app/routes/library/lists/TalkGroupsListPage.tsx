import { useMemo } from 'react';
import { Text } from '@mantine/core';
import type { TalkGroup } from '@core/models/library.ts';
import ModePill from '../../../components/pills/ModePill.tsx';
import { DataTable, ListPage } from '../../../components/ui/index.ts';
import type { DataTableColumn } from '../../../components/ui/DataTable.tsx';
import { filterRowsByName, useListNameQuery } from '../../../hooks/useListNameQuery.ts';
import { usePersistedEntityListSort } from '../../../hooks/usePersistedEntityListSort.ts';
import { DATATABLE_NAME_SORT_KEY } from '../../../lib/dataTable/sort.ts';
import { formatReferenceCount, referenceCount } from '../../../lib/listReferences.ts';
import { useLibrary } from '../../../state/useLibrary.ts';

export default function TalkGroupsListPage() {
  const { library, loading } = useLibrary();
  const { talkGroups } = library;
  const { nameFilter, setNameFilter } = useListNameQuery('talk-groups');
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
    ];
  }, [library]);

  if (loading) {
    return (
      <ListPage title="Talk groups">
        <Text>Loading library…</Text>
      </ListPage>
    );
  }

  return (
    <ListPage title="Talk groups">
      <DataTable
        variant="list"
        rows={filtered}
        totalRowCount={talkGroups.length}
        search={nameFilter}
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
    </ListPage>
  );
}
