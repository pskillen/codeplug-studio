import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Group, Pagination } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { DigitalContact } from '@core/models/library.ts';
import {
  findDigitalContactByDigitalId,
  mapRadioidUserToDigitalContact,
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
import RadioidContactUpdateDialog from './RadioidContactUpdateDialog.tsx';
import RadioidContactPreviewDialog from './RadioidContactPreviewDialog.tsx';

const GATED_SELECTION_CAPTION =
  "Already-in-library rows are dimmed — use Update to refresh fields from RadioID.net. RadioID paginates server-side.";

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

  const duplicateById = useMemo(() => {
    const map = new Map<number, string>();
    for (const contact of library.digitalContacts) {
      map.set(contact.digitalId, contact.id);
    }
    return map;
  }, [library.digitalContacts]);

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
              <button type="button" className="libraryListNameLink" onClick={() => openPreview(row)}>
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
              <button type="button" className="libraryListNameLink" onClick={() => openPreview(row)}>
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
          if (existing) {
            return (
              <Button variant="outline" size="sm" onClick={() => openUpdate(row)}>
                Update
              </Button>
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
  }, [adding, library.digitalContacts]);

  async function addSingleListing(row: RadioidDmrUserListing) {
    if (!activeProjectId || duplicateById.has(row.id)) return;

    setAdding(true);
    setAddMessage(null);
    try {
      const contact = mapRadioidUserToDigitalContact(row, activeProjectId);
      await persistence.putDigitalContact(contact, null);
      await reload();
      setAddMessage('Added 1 digital contact to your library.');
    } catch {
      setAddMessage('Could not save the contact — try again.');
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
        <span>{totalCount.toLocaleString()} results — page {page} of {totalPages}</span>
        <Pagination total={totalPages} value={page} onChange={goToPage} size="sm" />
      </Group>
    ) : (
      GATED_SELECTION_CAPTION
    );

  return (
    <DirectoryIngestPage
      crumb="Contacts"
      crumbTo="/library/contacts"
      title="Search RadioID.net"
      subtitle={
        <>
          Search the worldwide{' '}
          <a href="https://www.radioid.net/" target="_blank" rel="noreferrer" className="libraryListNameLink">
            RadioID.net
          </a>{' '}
          DMR user database and import private contacts into your library. Community data — verify
          before use on air.
        </>
      }
      footer={
        <Button variant="secondary" onClick={() => navigate('/library/contacts')}>
          Back to library
        </Button>
      }
    >
      <form onSubmit={handleSearchSubmit}>
        <Panel title="Search filters">
          <StatusBanner tone="info">
            RadioID.net listings are community-maintained. Studio stores contacts in your
            vendor-neutral library; format exports project metadata per build adapter.
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
          </div>
        </Panel>
      </form>

      {error ? <StatusBanner tone="warning">{error}</StatusBanner> : null}
      {addMessage ? <StatusBanner tone="success">{addMessage}</StatusBanner> : null}

      {listings.length > 0 ? (
        <Panel title={`Results (${totalCount.toLocaleString()})`}>
          <div className={pageClasses.filterActions} style={{ marginBottom: 12 }}>
            <Button disabled={totalCount === 0} size="sm" onClick={() => openBulkImport('all')}>
              Add all results ({totalCount.toLocaleString()})
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={listings.length === 0}
              onClick={() => openBulkImport('page')}
            >
              Add this page ({listings.length})
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={selectedKeys.length === 0}
              onClick={() => openBulkImport('selected')}
            >
              Add selected ({selectedKeys.length})
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
            isRowSelectable={(row) => !duplicateById.has(row.id)}
            onRowActivate={(row) => {
              if (duplicateById.has(row.id)) openPreview(row);
            }}
          />
        </Panel>
      ) : !loading && !error ? (
        <p className={pageClasses.attribution}>Enter filters and search to load DMR users from RadioID.net.</p>
      ) : null}

      {bulkScope ? (
        <RadioidContactBulkImportDialog
          opened={bulkOpen}
          onClose={() => setBulkOpen(false)}
          onComplete={() => {
            void reload();
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
          contacts={library.digitalContacts}
        />
      ) : null}

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
