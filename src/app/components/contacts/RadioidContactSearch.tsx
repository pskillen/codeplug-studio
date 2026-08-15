import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Group, Pagination, Text } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { DigitalContact } from '@core/models/library.ts';
import {
  findDigitalContactByDigitalId,
  mapRadioidUserToDirectoryEntry,
  radioidListingDisplayName,
  type RadioidDmrUserListing,
} from '@integrations/radioid/index.ts';
import { useRadioidContactSearch } from '../../hooks/useRadioidContactSearch.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import type { RadioidBulkImportScope } from '../../lib/radioidBulkImport.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useProjects } from '../../state/useProjects.ts';
import CountryComboboxField from '../directories/CountryComboboxField.tsx';
import DirectoryIngestPage from '../directories/DirectoryIngestPage.tsx';
import pageClasses from '../directories/DirectoryIngestPage.module.css';
import {
  Button,
  DataTable,
  FormField,
  Panel,
  StatusBanner,
  TextInput,
  type DataTableColumn,
} from '../v2/index.ts';
import RadioidContactBulkImportDialog from './RadioidContactBulkImportDialog.tsx';
import RadioidEntireDatabaseImportDialog from './RadioidEntireDatabaseImportDialog.tsx';
import RadioidContactUpdateDialog from './RadioidContactUpdateDialog.tsx';
import RadioidContactPreviewDialog from './RadioidContactPreviewDialog.tsx';

const GATED_SELECTION_CAPTION =
  'IDs already in your directory are dimmed for bulk import. Library contacts use Update to refresh from RadioID.net. RadioID paginates server-side.';

const EMPTY_DIRECTORY_IDS = new Set<number>();

function listingKey(listing: RadioidDmrUserListing): string {
  return String(listing.id);
}

export default function RadioidContactSearch() {
  const navigate = useNavigate();
  const { activeProjectId } = useProjects();
  const { library, reload } = useLibrary();
  const {
    filters,
    updateFilter,
    loading,
    error,
    listings,
    page,
    totalPages,
    totalCount,
    search,
    goToPage,
  } = useRadioidContactSearch();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const [updateContact, setUpdateContact] = useState<DigitalContact | null>(null);
  const [updateListing, setUpdateListing] = useState<RadioidDmrUserListing | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [previewContact, setPreviewContact] = useState<DigitalContact | null>(null);
  const [previewListing, setPreviewListing] = useState<RadioidDmrUserListing | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [bulkScope, setBulkScope] = useState<RadioidBulkImportScope | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSessionKey, setBulkSessionKey] = useState(0);
  const [entireDbOpen, setEntireDbOpen] = useState(false);
  const [entireDbSessionKey, setEntireDbSessionKey] = useState(0);
  const [directoryDigitalIds, setDirectoryDigitalIds] =
    useState<ReadonlySet<number>>(EMPTY_DIRECTORY_IDS);

  const directoryIdsForImport = activeProjectId ? directoryDigitalIds : EMPTY_DIRECTORY_IDS;

  const duplicateById = useMemo(() => {
    const map = new Map<number, string>();
    for (const contact of library.digitalContacts) {
      map.set(contact.digitalId, contact.id);
    }
    return map;
  }, [library.digitalContacts]);

  useEffect(() => {
    if (!activeProjectId) return;
    const projectId = activeProjectId;

    let cancelled = false;

    async function loadDirectoryIds() {
      const entries = await persistence.listDigitalIdDirectoryEntries(projectId);
      if (cancelled) return;
      setDirectoryDigitalIds(new Set(entries.map((entry) => entry.digitalId)));
    }

    void loadDirectoryIds();
    const unsubscribe = persistence.subscribeDirectory((change) => {
      if (change.projectId === projectId) {
        void loadDirectoryIds();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [activeProjectId]);

  function openPreview(row: RadioidDmrUserListing) {
    const existing = findDigitalContactByDigitalId(library.digitalContacts, row.id);
    if (!existing) return;
    setPreviewContact(existing);
    setPreviewListing(row);
    setPreviewOpen(true);
  }

  function openUpdate(row: RadioidDmrUserListing) {
    const existing = findDigitalContactByDigitalId(library.digitalContacts, row.id);
    if (!existing) return;
    setUpdateContact(existing);
    setUpdateListing(row);
    setUpdateOpen(true);
  }

  function openBulkImport(scope: RadioidBulkImportScope) {
    setBulkScope(scope);
    setBulkSessionKey((key) => key + 1);
    setBulkOpen(true);
  }

  function openEntireDatabaseImport() {
    setEntireDbSessionKey((key) => key + 1);
    setEntireDbOpen(true);
  }

  const bulkListings = useMemo(() => {
    if (bulkScope === 'selected') {
      return listings.filter((row) => selectedKeys.includes(listingKey(row)));
    }
    return listings;
  }, [bulkScope, listings, selectedKeys]);

  const columns = useMemo((): DataTableColumn<RadioidDmrUserListing>[] => {
    return [
      {
        key: 'callsign',
        header: 'Callsign',
        width: '100px',
        render: (row) => {
          const existing = findDigitalContactByDigitalId(library.digitalContacts, row.id);
          const label = row.callsign || '—';
          if (existing) {
            return (
              <button
                type="button"
                className="libraryListNameLink"
                onClick={() => openPreview(row)}
              >
                {label}
              </button>
            );
          }
          return label;
        },
        sortValue: (row) => row.callsign,
      },
      {
        key: 'id',
        header: 'DMR ID',
        width: '100px',
        render: (row) => {
          const existing = findDigitalContactByDigitalId(library.digitalContacts, row.id);
          if (existing) {
            return (
              <button
                type="button"
                className="libraryListNameLink"
                onClick={() => openPreview(row)}
              >
                {row.id}
              </button>
            );
          }
          return row.id;
        },
        sortValue: (row) => row.id,
      },
      {
        key: 'name',
        header: 'Name',
        render: (row) => radioidListingDisplayName(row),
        sortValue: (row) => radioidListingDisplayName(row),
      },
      {
        key: 'city',
        header: 'City',
        hideOnMobile: true,
        render: (row) => row.city || '—',
        sortValue: (row) => row.city,
      },
      {
        key: 'state',
        header: 'State',
        hideOnMobile: true,
        render: (row) => row.state || '—',
        sortValue: (row) => row.state,
      },
      {
        key: 'country',
        header: 'Country',
        hideOnMobile: true,
        render: (row) => row.country || '—',
        sortValue: (row) => row.country,
      },
      {
        key: 'actions',
        header: '',
        width: '100px',
        hideable: false,
        align: 'right',
        render: (row) => {
          const existing = findDigitalContactByDigitalId(library.digitalContacts, row.id);
          const inDirectory = directoryIdsForImport.has(row.id);
          if (existing) {
            return (
              <Button variant="outline" size="sm" onClick={() => openUpdate(row)}>
                Update
              </Button>
            );
          }
          if (inDirectory) {
            return (
              <Text size="sm" c="dimmed">
                In directory
              </Text>
            );
          }
          return (
            <Button size="sm" loading={adding} onClick={() => void addSingleListing(row)}>
              Add
            </Button>
          );
        },
      },
    ];
  }, [adding, directoryIdsForImport, library.digitalContacts]);

  async function addSingleListing(row: RadioidDmrUserListing) {
    if (!activeProjectId || directoryIdsForImport.has(row.id)) return;

    setAdding(true);
    setAddMessage(null);
    try {
      const entry = mapRadioidUserToDirectoryEntry(row, activeProjectId);
      await persistence.putDigitalIdDirectoryEntriesBatch([entry]);
      setDirectoryDigitalIds((ids) => new Set([...ids, row.id]));
      setAddMessage('Added 1 ID to your local directory.');
    } catch {
      setAddMessage('Could not save the directory row — try again.');
    } finally {
      setAdding(false);
    }
  }

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    void search(1);
  }

  const tableCaption =
    totalPages > 1 ? (
      <Group justify="space-between" wrap="wrap" gap="sm">
        <span>
          {totalCount.toLocaleString()} results — page {page} of {totalPages}
        </span>
        <Pagination total={totalPages} value={page} onChange={goToPage} size="sm" />
      </Group>
    ) : (
      GATED_SELECTION_CAPTION
    );

  return (
    <DirectoryIngestPage
      crumb="Directory"
      crumbTo="/library/contacts/directory"
      title="Search RadioID.net"
      subtitle={
        <>
          Search the worldwide{' '}
          <a
            href="https://www.radioid.net/"
            target="_blank"
            rel="noreferrer"
            className="libraryListNameLink"
          >
            RadioID.net
          </a>{' '}
          DMR user database and import IDs into your local <strong>digital ID directory</strong>{' '}
          (shadow store). Copy into library contacts later when needed. Community data — verify
          before use on air.
        </>
      }
      footer={
        <Button variant="secondary" onClick={() => navigate('/library/contacts/directory')}>
          Back to directory
        </Button>
      }
    >
      <form onSubmit={handleSearchSubmit}>
        <Panel title="Search filters">
          <StatusBanner tone="info">
            RadioID.net listings are community-maintained. Bulk and single-row import saves to your
            local digital ID directory shadow store — not library contacts. Use library Update for
            contacts you have already copied.
          </StatusBanner>

          <div className={pageClasses.filterGrid}>
            <CountryComboboxField
              label="Country"
              value={filters.country}
              onChange={(value) => updateFilter('country', value)}
              className={pageClasses.filterField}
            />
            <FormField label="State / province" className={pageClasses.filterField}>
              <TextInput
                variant="plain"
                value={filters.state}
                onChange={(e) => updateFilter('state', e.currentTarget.value)}
                placeholder="Begins with…"
              />
            </FormField>
            <FormField label="City" className={pageClasses.filterField}>
              <TextInput
                variant="plain"
                value={filters.city}
                onChange={(e) => updateFilter('city', e.currentTarget.value)}
                placeholder="Begins with…"
              />
            </FormField>
            <FormField label="Callsign" className={pageClasses.filterField}>
              <TextInput
                variant="plain"
                value={filters.callsign}
                onChange={(e) => updateFilter('callsign', e.currentTarget.value)}
                placeholder="Begins with…"
              />
            </FormField>
            <FormField label="DMR ID" className={pageClasses.filterField}>
              <TextInput
                variant="plain"
                value={filters.id}
                onChange={(e) => updateFilter('id', e.currentTarget.value)}
              />
            </FormField>
          </div>

          <div className={pageClasses.filterActions}>
            <Button
              type="submit"
              loading={loading}
              leftSection={<IconSearch size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
            >
              Search
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={openEntireDatabaseImport}
            >
              Entire database
            </Button>
          </div>
        </Panel>
      </form>

      {error ? <StatusBanner tone="warning">{error}</StatusBanner> : null}
      {addMessage ? <StatusBanner tone="success">{addMessage}</StatusBanner> : null}

      {listings.length > 0 ? (
        <Panel title={`Results (${totalCount.toLocaleString()})`}>
          <div className={pageClasses.filterActions} style={{ marginBottom: 12 }}>
            <Button disabled={totalCount === 0} size="sm" onClick={() => openBulkImport('all')}>
              Import all results ({totalCount.toLocaleString()})
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={listings.length === 0}
              onClick={() => openBulkImport('page')}
            >
              Import this page ({listings.length})
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={selectedKeys.length === 0}
              onClick={() => openBulkImport('selected')}
            >
              Import selected ({selectedKeys.length})
            </Button>
          </div>
          <DataTable
            variant="embedded"
            rows={listings}
            getRowId={listingKey}
            columns={columns}
            caption={tableCaption}
            selectable
            selectedKeys={selectedKeys}
            onSelectionChange={setSelectedKeys}
            isRowSelectable={(row) => !directoryIdsForImport.has(row.id)}
            onRowActivate={(row) => {
              if (duplicateById.has(row.id)) openPreview(row);
            }}
          />
        </Panel>
      ) : !loading && !error ? (
        <p className={pageClasses.attribution}>
          Enter filters and search to load DMR users from RadioID.net.
        </p>
      ) : null}

      {bulkScope ? (
        <RadioidContactBulkImportDialog
          opened={bulkOpen}
          onClose={() => setBulkOpen(false)}
          onComplete={() => {
            setSelectedKeys([]);
            setAddMessage(null);
          }}
          sessionKey={bulkSessionKey}
          scope={bulkScope}
          listings={bulkListings}
          filters={filters}
          totalPages={totalPages}
          totalCount={totalCount}
          projectId={activeProjectId}
          existingDirectoryDigitalIds={directoryIdsForImport}
        />
      ) : null}

      <RadioidEntireDatabaseImportDialog
        opened={entireDbOpen}
        onClose={() => setEntireDbOpen(false)}
        onComplete={() => {
          setAddMessage('Entire database import finished — browse the directory when ready.');
        }}
        sessionKey={entireDbSessionKey}
        projectId={activeProjectId}
      />

      {updateContact && updateListing ? (
        <RadioidContactUpdateDialog
          contact={updateContact}
          listing={updateListing}
          opened={updateOpen}
          onClose={() => setUpdateOpen(false)}
          onApplied={() => {
            void reload();
            setPreviewOpen(false);
          }}
        />
      ) : null}

      <RadioidContactPreviewDialog
        contact={previewContact}
        listing={previewListing}
        opened={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onApplied={() => {
          void reload();
          setPreviewOpen(false);
        }}
      />
    </DirectoryIngestPage>
  );
}
