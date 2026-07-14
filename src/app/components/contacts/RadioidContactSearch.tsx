import { useMemo, useState } from 'react';
import {
  Alert,
  Anchor,
  Autocomplete,
  Button,
  Group,
  Pagination,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { DigitalContact } from '@core/models/library.ts';
import { REPEATERBOOK_COUNTRY_NAMES } from '@integrations/repeaters/repeaterbook/countryNames.ts';
import {
  findDigitalContactByDigitalId,
  mapRadioidUserToDigitalContact,
  radioidListingDisplayName,
  type RadioidDmrUserListing,
} from '@integrations/radioid/index.ts';
import { useRadioidContactSearch } from '../../hooks/useRadioidContactSearch.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useProjects } from '../../state/useProjects.ts';
import { DataTable, FormPage, PageSection } from '../ui/index.ts';
import type { DataTableColumn } from '../ui/DataTable.tsx';
import RadioidContactUpdateDialog from './RadioidContactUpdateDialog.tsx';
import RadioidContactPreviewDialog from './RadioidContactPreviewDialog.tsx';

function listingKey(listing: RadioidDmrUserListing): string {
  return String(listing.id);
}

export default function RadioidContactSearch() {
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

  const columns = useMemo((): DataTableColumn<RadioidDmrUserListing>[] => {
    function existingContact(row: RadioidDmrUserListing): DigitalContact | null {
      return findDigitalContactByDigitalId(library.digitalContacts, row.id);
    }

    return [
      {
        key: 'callsign',
        header: 'Callsign',
        render: (row) => {
          const existing = existingContact(row);
          const label = row.callsign || '—';
          if (existing) {
            return (
              <Anchor
                component="button"
                type="button"
                size="sm"
                onClick={() => openPreview(row)}
              >
                {label}
              </Anchor>
            );
          }
          return label;
        },
        sortValue: (row) => row.callsign,
      },
      {
        key: 'id',
        header: 'DMR ID',
        render: (row) => {
          const existing = existingContact(row);
          if (existing) {
            return (
              <Anchor
                component="button"
                type="button"
                size="sm"
                onClick={() => openPreview(row)}
              >
                {row.id}
              </Anchor>
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
        render: (row) => row.city || '—',
        sortValue: (row) => row.city,
      },
      {
        key: 'state',
        header: 'State',
        render: (row) => row.state || '—',
        sortValue: (row) => row.state,
      },
      {
        key: 'country',
        header: 'Country',
        render: (row) => row.country || '—',
        sortValue: (row) => row.country,
      },
      {
        key: 'actions',
        header: '',
        hideable: false,
        render: (row) => {
          const existing = existingContact(row);
          if (existing) {
            return (
              <Button size="xs" variant="outline" onClick={() => openUpdate(row)}>
                Update
              </Button>
            );
          }
          return (
            <Button size="xs" loading={adding} onClick={() => void addListings([row])}>
              Add
            </Button>
          );
        },
      },
    ];
  }, [adding, library.digitalContacts]);

  async function addListings(rows: RadioidDmrUserListing[]) {
    if (!activeProjectId) return;
    const toAdd = rows.filter((row) => !duplicateById.has(row.id));
    if (toAdd.length === 0) {
      setAddMessage('Selected contacts are already in your library.');
      return;
    }

    setAdding(true);
    setAddMessage(null);
    try {
      for (const row of toAdd) {
        const contact = mapRadioidUserToDigitalContact(row, activeProjectId);
        await persistence.putDigitalContact(contact, null);
      }
      await reload();
      setSelectedKeys([]);
      setAddMessage(
        toAdd.length === 1
          ? 'Added 1 digital contact to your library.'
          : `Added ${toAdd.length} digital contacts to your library.`,
      );
    } catch {
      setAddMessage('Could not save one or more contacts — try again.');
    } finally {
      setAdding(false);
    }
  }

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    void search(1);
  }

  const selectedListings = listings.filter((row) => selectedKeys.includes(listingKey(row)));
  const addableSelected = selectedListings.filter((row) => !duplicateById.has(row.id));
  const addableAll = listings.filter((row) => !duplicateById.has(row.id));

  return (
    <FormPage
      title="Add contact from RadioID.net"
      description={
        <>
          Search the worldwide{' '}
          <Anchor href="https://www.radioid.net/" target="_blank" rel="noreferrer">
            RadioID.net
          </Anchor>{' '}
          DMR user database and import private contacts into your library. Community data — verify
          before use on air. Respect RadioID.net acceptable use and rate limits.
        </>
      }
      onSubmit={handleSearchSubmit}
    >
      <Stack gap="lg">
        <Alert variant="light" color="blue" title="Directory disclaimer">
          RadioID.net listings are community-maintained. Studio stores contacts in your
          vendor-neutral library; format exports project metadata per build adapter.
        </Alert>

        <PageSection title="Search filters">
          <Group grow align="flex-end">
            <Autocomplete
              label="Country"
              placeholder="Start typing — e.g. United Kingdom"
              data={[...REPEATERBOOK_COUNTRY_NAMES]}
              value={filters.country}
              onChange={(value) => updateFilter('country', value)}
              limit={20}
            />
            <TextInput
              label="State / province"
              value={filters.state}
              onChange={(e) => updateFilter('state', e.currentTarget.value)}
              placeholder="Begins with…"
            />
            <TextInput
              label="City"
              value={filters.city}
              onChange={(e) => updateFilter('city', e.currentTarget.value)}
              placeholder="Begins with…"
            />
            <TextInput
              label="Callsign"
              value={filters.callsign}
              onChange={(e) => updateFilter('callsign', e.currentTarget.value)}
              placeholder="Begins with…"
            />
            <TextInput
              label="DMR ID"
              value={filters.id}
              onChange={(e) => updateFilter('id', e.currentTarget.value)}
            />
          </Group>
          <Group mt="md">
            <Button
              type="submit"
              loading={loading}
              leftSection={<IconSearch size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
            >
              Search
            </Button>
          </Group>
        </PageSection>

        {error ? (
          <Alert color="red" title="Search">
            {error}
          </Alert>
        ) : null}
        {addMessage ? (
          <Alert color="green" title="Import">
            {addMessage}
          </Alert>
        ) : null}

        {listings.length > 0 ? (
          <PageSection title={`Results (${totalCount})`}>
            <Group mb="md">
              <Button
                loading={adding}
                disabled={addableAll.length === 0}
                onClick={() => void addListings(addableAll)}
              >
                Add all on this page ({addableAll.length})
              </Button>
              <Button
                variant="light"
                loading={adding}
                disabled={addableSelected.length === 0}
                onClick={() => void addListings(addableSelected)}
              >
                Add selected ({addableSelected.length})
              </Button>
            </Group>
            <DataTable
              variant="embedded"
              rows={listings}
              rowKey={listingKey}
              nameColumn={{
                getName: radioidListingDisplayName,
                getPath: () => '#',
                render: (row) => radioidListingDisplayName(row),
              }}
              columns={columns}
              selectable
              selectedKeys={selectedKeys}
              onSelectedKeysChange={setSelectedKeys}
              showSearch={false}
            />
            {totalPages > 1 ? (
              <Group justify="center" mt="md">
                <Pagination total={totalPages} value={page} onChange={goToPage} />
              </Group>
            ) : null}
          </PageSection>
        ) : null}

        {!loading && listings.length === 0 && !error ? (
          <Text c="dimmed" size="sm">
            Enter filters and search to load DMR users from RadioID.net.
          </Text>
        ) : null}
      </Stack>

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
    </FormPage>
  );
}
