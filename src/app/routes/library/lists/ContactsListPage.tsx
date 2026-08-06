import { useMemo, useState } from 'react';
import { IconId, IconPlus } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import type { AnalogContact, DigitalContact } from '@core/models/library.ts';
import { entityListColumnsKey } from '@integrations/listPrefs/keys.ts';
import DeleteAllDigitalContactsDialog from '../../../components/contacts/DeleteAllDigitalContactsDialog.tsx';
import AddFromDataSourceModal from '../../../components/library/AddFromDataSourceModal.tsx';
import EntityListRowDeleteAction from '../../../components/library/EntityListRowDeleteAction.tsx';
import LibraryInventoryHeader from '../../../components/library/LibraryInventoryHeader.tsx';
import ModePill from '../../../components/pills/ModePill.tsx';
import {
  Button,
  DataTable,
  DesignSystemV2Provider,
  Panel,
  type DataTableColumn,
} from '../../../components/v2/index.ts';
import {
  filterRowsByName,
  filterRowsBySearchFields,
  useListNameQuery,
} from '../../../hooks/useListNameQuery.ts';
import { usePersistedEntityListSort } from '../../../hooks/usePersistedEntityListSort.ts';
import { DATATABLE_NAME_SORT_KEY } from '../../../lib/dataTable/sort.ts';
import { CONTACT_ADD_SOURCES } from '../../../lib/contactDataSources.ts';
import {
  createNameColumn,
  usePersistedColumnVisibility,
  v1SortToV2,
  v2SortToV1,
} from '../../../lib/libraryListTable.tsx';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import {
  formatReferenceCount,
  buildReferenceCountIndex,
  referenceCountFromIndex,
} from '../../../lib/listReferences.ts';
import { useLibrary } from '../../../state/useLibrary.ts';
import { useProjects } from '../../../state/useProjects.ts';
import classes from '../../../components/library/LibraryInventoryPage.module.css';

function DigitalContactsTable({
  contacts,
  library,
  onDeleteAll,
}: {
  contacts: DigitalContact[];
  library: ReturnType<typeof useLibrary>['library'];
  onDeleteAll: () => void;
}) {
  const navigate = useNavigate();
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

  const columnDefs = useMemo(
    () => [
      { key: 'callsign', defaultVisible: true },
      { key: 'country', defaultVisible: false },
      { key: 'channels', defaultVisible: true },
      { key: 'comment', defaultVisible: false },
    ],
    [],
  );
  const [visibleKeys, setVisibleKeys] = usePersistedColumnVisibility(columnStorageKey, columnDefs);

  const columns = useMemo((): DataTableColumn<DigitalContact>[] => {
    return [
      createNameColumn<DigitalContact>({
        getName: (c) => c.name,
        getPath: (c) => `/library/digital-contacts/${c.id}`,
      }),
      {
        key: 'mode',
        header: 'Mode',
        hideOnMobile: true,
        render: (c) => <ModePill mode={c.mode} size="xs" />,
        sortValue: (c) => c.mode,
      },
      {
        key: 'callsign',
        header: 'Callsign',
        hideable: true,
        hideOnMobile: true,
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
        hideOnMobile: true,
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
        hideOnMobile: true,
        render: (c) => c.comment || '—',
        sortValue: (c) => c.comment || '',
      },
      {
        key: 'actions',
        header: '',
        hideable: false,
        width: '40px',
        render: (c) => (
          <EntityListRowDeleteAction kind="digitalContact" entityId={c.id} label={c.name} />
        ),
      },
    ];
  }, [referenceIndex]);

  return (
    <>
      <div className={classes.toolbarActions}>
        <Button variant="ghost" size="sm" disabled={contacts.length === 0} onClick={onDeleteAll}>
          Delete all digital contacts
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={filtered}
        getRowId={(c) => c.id}
        scale="extreme"
        totalRowCount={contacts.length}
        visibleKeys={visibleKeys}
        onVisibleKeysChange={setVisibleKeys}
        search={{
          value: nameFilterInput,
          onChange: setNameFilter,
          placeholder: 'Filter name or callsign…',
          pending: nameFilterPending,
        }}
        sort={v1SortToV2(sort)}
        onSortChange={(next) => {
          const v1 = v2SortToV1(next);
          if (v1) setSort(v1);
        }}
        emptyMessage="No digital contacts in this project yet."
        filteredEmptyMessage={
          nameFilter.trim()
            ? `No digital contacts match “${nameFilter.trim()}”.`
            : 'No digital contacts match your filter.'
        }
        caption="Imported contacts may include RadioID.net provenance metadata."
        onRowActivate={(c) => navigate(`/library/digital-contacts/${c.id}`)}
      />
    </>
  );
}

function AnalogContactsTable({
  contacts,
  library,
}: {
  contacts: AnalogContact[];
  library: ReturnType<typeof useLibrary>['library'];
}) {
  const navigate = useNavigate();
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
      createNameColumn<AnalogContact>({
        getName: (c) => c.name,
        getPath: (c) => `/library/analog-contacts/${c.id}`,
      }),
      {
        key: 'code',
        header: 'CTCSS tone',
        render: (c) => c.code || '—',
        sortValue: (c) => c.code || '',
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
        width: '40px',
        render: (c) => (
          <EntityListRowDeleteAction kind="analogContact" entityId={c.id} label={c.name} />
        ),
      },
    ];
  }, [referenceIndex]);

  return (
    <DataTable
      columns={columns}
      rows={filtered}
      getRowId={(c) => c.id}
      totalRowCount={contacts.length}
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
      emptyMessage="No analog contacts in this project yet."
      filteredEmptyMessage={
        nameFilter.trim()
          ? `No analog contacts match “${nameFilter.trim()}”.`
          : 'No analog contacts match your filter.'
      }
      onRowActivate={(c) => navigate(`/library/analog-contacts/${c.id}`)}
    />
  );
}

export default function ContactsListPage() {
  const navigate = useNavigate();
  const { library, loading, deleteAllDigitalContacts } = useLibrary();
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [addFromOpen, setAddFromOpen] = useState(false);

  const digitalCount = library.digitalContacts.length;
  const analogCount = library.analogContacts.length;
  const countSubtitle = `${digitalCount.toLocaleString()} digital · ${analogCount.toLocaleString()} analog`;

  const listActions = (
    <>
      <Button
        variant="secondary"
        leftSection={<IconId size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        onClick={() => navigate('/library/contacts/add-from-radioid')}
      >
        Import from RadioID
      </Button>
      <Button
        variant="primary"
        leftSection={<IconPlus size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        onClick={() => navigate('/library/digital-contacts/new')}
      >
        New contact
      </Button>
    </>
  );

  if (loading) {
    return (
      <DesignSystemV2Provider>
        <div className={classes.page}>
          <LibraryInventoryHeader title="Contacts" subtitle="Loading library…" />
        </div>
      </DesignSystemV2Provider>
    );
  }

  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <LibraryInventoryHeader title="Contacts" subtitle={countSubtitle} actions={listActions} />

        <Panel title={`Digital contacts (${digitalCount})`}>
          <DigitalContactsTable
            contacts={library.digitalContacts}
            library={library}
            onDeleteAll={() => setDeleteAllOpen(true)}
          />
        </Panel>

        <Panel title={`Analog contacts (${analogCount})`}>
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
