import { useMemo } from 'react';
import { Stack, Text } from '@mantine/core';
import type { AnalogContact, DigitalContact } from '@core/models/library.ts';
import EntityListDeleteAction from '../../../components/library/EntityListDeleteAction.tsx';
import ModePill from '../../../components/pills/ModePill.tsx';
import { DataTable, ListPage, PageSection } from '../../../components/ui/index.ts';
import type { DataTableColumn } from '../../../components/ui/DataTable.tsx';
import { filterRowsByName, useListNameQuery } from '../../../hooks/useListNameQuery.ts';
import { usePersistedEntityListSort } from '../../../hooks/usePersistedEntityListSort.ts';
import { DATATABLE_NAME_SORT_KEY } from '../../../lib/dataTable/sort.ts';
import { formatReferenceCount, referenceCount } from '../../../lib/listReferences.ts';
import { useLibrary } from '../../../state/useLibrary.ts';

function DigitalContactsTable({
  contacts,
  library,
}: {
  contacts: DigitalContact[];
  library: ReturnType<typeof useLibrary>['library'];
}) {
  const { nameFilter, nameFilterInput, nameFilterPending, setNameFilter } =
    useListNameQuery('digital-contacts');
  const [sort, setSort] = usePersistedEntityListSort('digital-contacts', {
    columnKey: DATATABLE_NAME_SORT_KEY,
    direction: 'asc',
  });
  const filtered = useMemo(
    () => filterRowsByName(contacts, nameFilter, (c) => c.name),
    [contacts, nameFilter],
  );

  const columns = useMemo((): DataTableColumn<DigitalContact>[] => {
    return [
      {
        key: 'mode',
        header: 'Mode',
        render: (c) => <ModePill mode={c.mode} size="xs" />,
        sortValue: (c) => c.mode,
      },
      {
        key: 'callsign',
        header: 'Callsign',
        hideable: true,
        render: (c) => c.callsign || '—',
        sortValue: (c) => c.callsign || '',
      },
      {
        key: 'digitalId',
        header: 'ID',
        render: (c) => c.digitalId,
        sortValue: (c) => c.digitalId,
      },
      {
        key: 'country',
        header: 'Country',
        hideable: true,
        defaultVisible: false,
        render: (c) => c.country || '—',
        sortValue: (c) => c.country || '',
      },
      {
        key: 'channels',
        header: 'Channels using',
        render: (c) =>
          formatReferenceCount(referenceCount(library, { kind: 'digitalContact', id: c.id })),
        sortValue: (c) => referenceCount(library, { kind: 'digitalContact', id: c.id }),
      },
      {
        key: 'comment',
        header: 'Comment',
        render: (c) => c.comment || '—',
        sortValue: (c) => c.comment || '',
      },
      {
        key: 'actions',
        header: '',
        hideable: false,
        render: (c) => (
          <EntityListDeleteAction kind="digitalContact" entityId={c.id} label={c.name} />
        ),
      },
    ];
  }, [library]);

  return (
    <DataTable
      variant="list"
      rows={filtered}
      totalRowCount={contacts.length}
      search={nameFilterInput}
      searchPending={nameFilterPending}
      onSearchChange={setNameFilter}
      searchPlaceholder="Filter name…"
      sort={sort}
      onSortChange={setSort}
      rowKey={(c) => c.id}
      nameColumn={{
        getName: (c) => c.name,
        getPath: (c) => `/library/digital-contacts/${c.id}`,
      }}
      columns={columns}
    />
  );
}

function AnalogContactsTable({
  contacts,
  library,
}: {
  contacts: AnalogContact[];
  library: ReturnType<typeof useLibrary>['library'];
}) {
  const { nameFilter, nameFilterInput, nameFilterPending, setNameFilter } =
    useListNameQuery('analog-contacts');
  const [sort, setSort] = usePersistedEntityListSort('analog-contacts', {
    columnKey: DATATABLE_NAME_SORT_KEY,
    direction: 'asc',
  });
  const filtered = useMemo(
    () => filterRowsByName(contacts, nameFilter, (c) => c.name),
    [contacts, nameFilter],
  );

  const columns = useMemo((): DataTableColumn<AnalogContact>[] => {
    return [
      {
        key: 'code',
        header: 'Code',
        render: (c) => c.code || '—',
        sortValue: (c) => c.code || '',
      },
      {
        key: 'comment',
        header: 'Comment',
        render: (c) => c.comment || '—',
        sortValue: (c) => c.comment || '',
      },
      {
        key: 'channels',
        header: 'Channels using',
        render: (c) =>
          formatReferenceCount(referenceCount(library, { kind: 'analogContact', id: c.id })),
        sortValue: (c) => referenceCount(library, { kind: 'analogContact', id: c.id }),
      },
      {
        key: 'actions',
        header: '',
        hideable: false,
        render: (c) => (
          <EntityListDeleteAction kind="analogContact" entityId={c.id} label={c.name} />
        ),
      },
    ];
  }, [library]);

  return (
    <DataTable
      variant="list"
      rows={filtered}
      totalRowCount={contacts.length}
      search={nameFilterInput}
      searchPending={nameFilterPending}
      onSearchChange={setNameFilter}
      searchPlaceholder="Filter name…"
      sort={sort}
      onSortChange={setSort}
      rowKey={(c) => c.id}
      nameColumn={{
        getName: (c) => c.name,
        getPath: (c) => `/library/analog-contacts/${c.id}`,
      }}
      columns={columns}
    />
  );
}

export default function ContactsListPage() {
  const { library, loading } = useLibrary();

  if (loading) {
    return (
      <ListPage title="Contacts">
        <Text>Loading library…</Text>
      </ListPage>
    );
  }

  return (
    <ListPage title="Contacts" description="Digital and analog contacts in one inventory.">
      <Stack gap="lg">
        <PageSection title={`Digital contacts (${library.digitalContacts.length})`}>
          <DigitalContactsTable contacts={library.digitalContacts} library={library} />
        </PageSection>

        <PageSection title={`Analog contacts (${library.analogContacts.length})`}>
          <AnalogContactsTable contacts={library.analogContacts} library={library} />
        </PageSection>
      </Stack>
    </ListPage>
  );
}
