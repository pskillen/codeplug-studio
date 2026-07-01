import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Group, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import type { Channel } from '@core/models/library.ts';
import {
  RepeaterDirectoryError,
  repeaterListingToChannel,
  searchBrandmeisterByCallsign,
  searchUkRepeatersByCallsign,
  searchUkRepeatersByLocator,
  type RepeaterListing,
  type RepeaterSource,
} from '@integrations/repeaters/index.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useProjects } from '../../state/useProjects.ts';
import { hzToMhzString } from '../../lib/units.ts';
import { BandPillsForRepeaterListing, ModePillsForRepeaterListing } from '../pills/index.ts';
import { FormPage, PageSection } from '../ui/index.ts';
import { findChannelByCallsign } from './findChannelByCallsign.ts';
import RepeaterListingUpdateDialog from './RepeaterListingUpdateDialog.tsx';

type SearchBy = 'callsign' | 'locator';

export interface RepeaterDirectorySearchProps {
  source: RepeaterSource;
  title: string;
  description: string;
}

export default function RepeaterDirectorySearch({
  source,
  title,
  description,
}: RepeaterDirectorySearchProps) {
  const navigate = useNavigate();
  const { activeProjectId } = useProjects();
  const { library } = useLibrary();
  const [searchBy, setSearchBy] = useState<SearchBy>('callsign');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RepeaterListing[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [updateChannel, setUpdateChannel] = useState<Channel | null>(null);
  const [updateListing, setUpdateListing] = useState<RepeaterListing | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);

  const canLocator = source === 'ukrepeater' && searchBy === 'locator';
  const sourceLabel = source === 'ukrepeater' ? 'ukrepeater.net' : 'BrandMeister';

  function existingChannel(listing: RepeaterListing): Channel | null {
    return findChannelByCallsign(library.channels, listing.callsign);
  }

  function openUpdate(listing: RepeaterListing) {
    const channel = existingChannel(listing);
    if (!channel) return;
    setUpdateChannel(channel);
    setUpdateListing(listing);
    setUpdateOpen(true);
  }

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setAdded(new Set());
    try {
      let listings: RepeaterListing[];
      if (source === 'brandmeister') {
        listings = await searchBrandmeisterByCallsign(query);
      } else if (canLocator) {
        listings = await searchUkRepeatersByLocator(query);
      } else {
        listings = await searchUkRepeatersByCallsign(query);
      }
      setResults(listings);
      if (listings.length === 0) {
        setError(`No repeaters matched your search on ${sourceLabel}.`);
      }
    } catch (err) {
      setError(
        err instanceof RepeaterDirectoryError ? err.message : 'Search failed. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(listing: RepeaterListing) {
    if (!activeProjectId) return;
    const channel = repeaterListingToChannel(listing, activeProjectId);
    const result = await persistence.putChannel(channel, null);
    if (result.ok) {
      setAdded((prev) => new Set(prev).add(listing.remoteId));
    }
  }

  const dialogChannel =
    updateChannel && updateListing
      ? (library.channels.find((c) => c.id === updateChannel.id) ?? updateChannel)
      : updateChannel;

  return (
    <FormPage
      title={title}
      description={description}
      footer={
        <Button variant="light" component={Link} to="/library/channels">
          Back to library
        </Button>
      }
    >
      <PageSection
        title="Search"
        description={`Query ${sourceLabel} and add matches to your library.`}
      >
        <Stack gap="sm">
          {source === 'ukrepeater' ? (
            <Select
              label="Search by"
              data={[
                { value: 'callsign', label: 'Repeater callsign' },
                { value: 'locator', label: 'Maidenhead locator' },
              ]}
              value={searchBy}
              onChange={(v) => setSearchBy((v as SearchBy) ?? 'callsign')}
            />
          ) : null}
          <Group align="flex-end" wrap="wrap">
            <TextInput
              label="Query"
              placeholder={canLocator ? 'e.g. IO91' : 'e.g. GB3DA'}
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSearch();
              }}
              style={{ flex: 1, minWidth: 200 }}
            />
            <Button onClick={() => void handleSearch()} loading={loading}>
              Search
            </Button>
          </Group>
          {error ? <Alert color="red">{error}</Alert> : null}
        </Stack>
      </PageSection>

      {results && results.length > 0 ? (
        <PageSection title="Results">
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Callsign</Table.Th>
                <Table.Th>Band</Table.Th>
                <Table.Th>Mode</Table.Th>
                <Table.Th>Frequencies</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {results.map((r) => {
                const isAdded = added.has(r.remoteId);
                const existing = existingChannel(r);
                return (
                  <Table.Tr key={`${r.source}:${r.remoteId}`}>
                    <Table.Td>
                      <Text fw={600}>{r.callsign}</Text>
                      {r.name ? (
                        <Text size="sm" c="dimmed">
                          {r.name}
                        </Text>
                      ) : null}
                    </Table.Td>
                    <Table.Td>
                      <BandPillsForRepeaterListing
                        rxFrequencyHz={r.rxFrequencyHz}
                        txFrequencyHz={r.txFrequencyHz}
                        wireBand={r.band}
                        size="xs"
                      />
                    </Table.Td>
                    <Table.Td>
                      <ModePillsForRepeaterListing modes={r.modes} size="xs" />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        RX {hzToMhzString(r.rxFrequencyHz) || '—'} / TX{' '}
                        {hzToMhzString(r.txFrequencyHz) || '—'} MHz
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {existing ? (
                        <Button size="compact-sm" variant="outline" onClick={() => openUpdate(r)}>
                          Update existing
                        </Button>
                      ) : (
                        <Button
                          size="compact-sm"
                          variant={isAdded ? 'light' : 'filled'}
                          disabled={isAdded}
                          onClick={() => void handleAdd(r)}
                        >
                          {isAdded ? 'Added' : 'Add to library'}
                        </Button>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
          {added.size > 0 ? (
            <Group mt="md">
              <Button variant="light" onClick={() => navigate('/library/channels')}>
                View library
              </Button>
            </Group>
          ) : null}
        </PageSection>
      ) : null}

      {dialogChannel && updateListing ? (
        <RepeaterListingUpdateDialog
          channel={dialogChannel}
          listing={updateListing}
          opened={updateOpen}
          onClose={() => setUpdateOpen(false)}
        />
      ) : null}
    </FormPage>
  );
}
