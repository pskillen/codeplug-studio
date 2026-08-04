import { useMemo, useState } from 'react';
import { Group } from '@mantine/core';
import { IconPlus, IconWorldSearch } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import type { AnalogContact, DigitalContact } from '@core/models/library.ts';
import { entityListColumnsKey } from '@integrations/listPrefs/keys.ts';
import DeleteAllDigitalContactsDialog from '../../../components/contacts/DeleteAllDigitalContactsDialog.tsx';
import AddFromDataSourceModal from '../../../components/library/AddFromDataSourceModal.tsx';
import EntityListDeleteAction from '../../../components/library/EntityListDeleteAction.tsx';
import ModePill from '../../../components/pills/ModePill.tsx';
import { Button, DesignSystemV2Provider, Panel } from '../../../components/v2/index.ts';
import { DataTable } from '../../../components/ui/index.ts';
import type { DataTableColumn } from '../../../components/ui/DataTable.tsx';
import {
  filterRowsByName,
  filterRowsBySearchFields,
  useListNameQuery,
} from '../../../hooks/useListNameQuery.ts';
import { usePersistedEntityListSort } from '../../../hooks/usePersistedEntityListSort.ts';
import { DATATABLE_NAME_SORT_KEY } from '../../../lib/dataTable/sort.ts';
import { CONTACT_ADD_SOURCES } from '../../../lib/contactDataSources.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import {
  formatReferenceCount,
  buildReferenceCountIndex,
  referenceCountFromIndex,
} from '../../../lib/listReferences.ts';
import { useLibrary } from '../../../state/useLibrary.ts';
import { useProjects } from '../../../state/useProjects.ts';
import classes from './LibraryListPage.module.css';

function DigitalContactsTable({
  contacts,
  library,
  onDeleteAll,
}: {
  contacts: DigitalContact[];
  library: ReturnType<typeof useLibrary>['library'];
  onDeleteAll: () => void;
}) {
  const { activeProjectId } = useProjects();
  const { nameFilter, nameFilterInput, nameFilterPending, setNameFilter } =
    useListNameQuery('digital-contacts');
  const [sort, setSort] = usePersistedEntityListSort('digital-contacts', {
    columnKey: DATATABLE_NAME_SORT_KEY,
    direction: 'asc',
  });
  const filtered = useMemo(
    () => filterRowsBySearchFields(contacts, nameFilter, [(c) => c.name, (c) => c.callsign]),
    [contacts, nameFilter],
  );
  const referenceIndex = useMemo(() => buildReferenceCountIndex(library), [library]);
  const columnStorageKey = activeProjectId
    ? entityListColumnsKey('digital-contacts', activeProjectId)
    : undefined;

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
        hideable: true,
        render: (c) =>
          formatReferenceCount(
            referenceCountFromIndex(referenceIndex, { kind: 'digitalContact', id: c.id }),
          ),
        sortValue: (c) =>
          referenceCountFromIndex(referenceIndex, { kind: 'digitalContact', id: c.id }),
      },
      {
        key: 'comment',
        header: 'Comment',
        hideable: true,
        defaultVisible: false,
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
  }, [referenceIndex]);

  return (
    <DataTable
      variant="list"
      scale="extreme"
      selectionChrome="v2"
      rows={filtered}
      totalRowCount={contacts.length}
      search={nameFilterInput}
      searchPending={nameFilterPending}
      onSearchChange={setNameFilter}
      searchPlaceholder="Filter name or callsign…"
      sort={sort}
      onSortChange={setSort}
      rowKey={(c) => c.id}
      nameColumn={{
        getName: (c) => c.name,
        getPath: (c) => `/library/digital-contacts/${c.id}`,
      }}
      columns={columns}
      columnVisibilityStorageKey={columnStorageKey}
      toolbar={
        <Group gap="xs">
          <Button
            variant="destructive"
            size="sm"
            disabled={contacts.length === 0}
            onClick={onDeleteAll}
          >
            Delete all
          </Button>
        </Group>
      }
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
  const referenceIndex = useMemo(() => buildReferenceCountIndex(library), [library]);

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
          formatReferenceCount(
            referenceCountFromIndex(referenceIndex, { kind: 'analogContact', id: c.id }),
          ),
        sortValue: (c) =>
          referenceCountFromIndex(referenceIndex, { kind: 'analogContact', id: c.id }),
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
  }, [referenceIndex]);

  return (
    <DataTable
      variant="list"
      selectionChrome="v2"
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
  const navigate = useNavigate();
  const { library, loading, deleteAllDigitalContacts } = useLibrary();
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [addFromOpen, setAddFromOpen] = useState(false);

  const listActions = (
    <Group gap="xs" className={classes.toolbarActions}>
      <Button
        variant="primary"
        leftSection={<IconPlus size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        onClick={() => navigate('/library/digital-contacts/new')}
      >
        New digital contact
      </Button>
      <Button
        variant="secondary"
        leftSection={<IconPlus size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        onClick={() => navigate('/library/analog-contacts/new')}
      >
        New analog contact
      </Button>
      <Button
        variant="secondary"
        leftSection={<IconWorldSearch size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        onClick={() => setAddFromOpen(true)}
      >
        Add from…
      </Button>
    </Group>
  );

  if (loading) {
    return (
      <DesignSystemV2Provider>
        <div className={classes.page}>
          <h1 className={classes.title}>Contacts</h1>
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
            <h1 className={classes.title}>Contacts</h1>
            <p className={classes.description}>Digital and analog contacts in one inventory.</p>
          </div>
          {listActions}
        </div>

        <Panel title={`Digital contacts (${library.digitalContacts.length})`}>
          <DigitalContactsTable
            contacts={library.digitalContacts}
            library={library}
            onDeleteAll={() => setDeleteAllOpen(true)}
          />
        </Panel>

        <Panel title={`Analog contacts (${library.analogContacts.length})`}>
          <AnalogContactsTable contacts={library.analogContacts} library={library} />
        </Panel>

        <DeleteAllDigitalContactsDialog
          opened={deleteAllOpen}
          onClose={() => setDeleteAllOpen(false)}
          contactCount={library.digitalContacts.length}
          onConfirm={deleteAllDigitalContacts}
        />

        <AddFromDataSourceModal
          opened={addFromOpen}
          onClose={() => setAddFromOpen(false)}
          sources={CONTACT_ADD_SOURCES}
        />
      </div>
    </DesignSystemV2Provider>
  );
}
