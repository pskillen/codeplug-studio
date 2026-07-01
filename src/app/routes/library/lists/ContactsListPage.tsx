import { useMemo } from 'react';
import { Stack, Text } from '@mantine/core';
import type { AnalogContact, DigitalContact } from '@core/models/library.ts';
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
  const { nameFilter, setNameFilter } = useListNameQuery('digital-contacts');
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
        key: 'digitalId',
        header: 'ID',
        render: (c) => c.digitalId,
        sortValue: (c) => c.digitalId,
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
    ];
  }, [library]);

  return (
    <DataTable
      variant="list"
      rows={filtered}
      totalRowCount={contacts.length}
      search={nameFilter}
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

function AnalogContactsTable({ contacts }: { contacts: AnalogContact[] }) {
  const { nameFilter, setNameFilter } = useListNameQuery('analog-contacts');
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
    ];
  }, []);

  return (
    <DataTable
      variant="list"
      rows={filtered}
      totalRowCount={contacts.length}
      search={nameFilter}
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
          <AnalogContactsTable contacts={library.analogContacts} />
        </PageSection>
      </Stack>
    </ListPage>
  );
}
