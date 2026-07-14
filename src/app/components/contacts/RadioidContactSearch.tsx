import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Anchor, Button, Group, Pagination, Stack, Text, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import {
  findDigitalContactByDigitalId,
  mapRadioidUserToDigitalContact,
  type RadioidDmrUserListing,
} from '@integrations/radioid/index.ts';
import { useRadioidContactSearch } from '../../hooks/useRadioidContactSearch.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useProjects } from '../../state/useProjects.ts';
import { DataTable, FormPage, PageSection } from '../ui/index.ts';
import type { DataTableColumn } from '../ui/DataTable.tsx';

function listingKey(listing: RadioidDmrUserListing): string {
  return String(listing.id);
}

function displayName(listing: RadioidDmrUserListing): string {
  const full = [listing.fname, listing.surname].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (listing.name?.trim()) return listing.name.trim();
  return listing.callsign || '—';
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

  const duplicateById = useMemo(() => {
    const map = new Map<number, string>();
    for (const contact of library.digitalContacts) {
      map.set(contact.digitalId, contact.id);
    }
    return map;
  }, [library.digitalContacts]);

  const columns = useMemo((): DataTableColumn<RadioidDmrUserListing>[] => {
    return [
      {
        key: 'callsign',
        header: 'Callsign',
        render: (row) => row.callsign || '—',
        sortValue: (row) => row.callsign,
      },
      {
        key: 'id',
        header: 'DMR ID',
        render: (row) => row.id,
        sortValue: (row) => row.id,
      },
      {
        key: 'name',
        header: 'Name',
        render: (row) => displayName(row),
        sortValue: (row) => displayName(row),
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
          const existing = findDigitalContactByDigitalId(library.digitalContacts, row.id);
          if (existing) {
            return (
              <Button
                component={Link}
                to={`/library/digital-contacts/${existing.id}`}
                variant="light"
                size="xs"
              >
                Open
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
      footer={
        selectedKeys.length > 0 ? (
          <Button
            loading={adding}
            disabled={addableSelected.length === 0}
            onClick={() => void addListings(addableSelected)}
          >
            Add selected ({addableSelected.length})
          </Button>
        ) : undefined
      }
    >
      <Stack gap="lg">
        <Alert variant="light" color="blue" title="Directory disclaimer">
          RadioID.net listings are community-maintained. Studio stores contacts in your
          vendor-neutral library; format exports project metadata per build adapter.
        </Alert>

        <PageSection title="Search filters">
          <Group grow align="flex-end">
            <TextInput
              label="DMR ID"
              value={filters.id}
              onChange={(e) => updateFilter('id', e.currentTarget.value)}
            />
            <TextInput
              label="Callsign"
              value={filters.callsign}
              onChange={(e) => updateFilter('callsign', e.currentTarget.value)}
              placeholder="Begins with…"
            />
            <TextInput
              label="City"
              value={filters.city}
              onChange={(e) => updateFilter('city', e.currentTarget.value)}
            />
            <TextInput
              label="State / province"
              value={filters.state}
              onChange={(e) => updateFilter('state', e.currentTarget.value)}
            />
            <TextInput
              label="Country"
              value={filters.country}
              onChange={(e) => updateFilter('country', e.currentTarget.value)}
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
            <DataTable
              variant="embedded"
              rows={listings}
              rowKey={listingKey}
              nameColumn={{
                getName: displayName,
                getPath: () => '#',
                render: (row) => displayName(row),
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
    </FormPage>
  );
}
