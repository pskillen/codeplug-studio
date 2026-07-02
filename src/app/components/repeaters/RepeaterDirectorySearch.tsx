import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Group,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { Channel } from '@core/models/library.ts';
import { coordsToLocator } from '@core/domain/maidenhead.ts';
import { toTitleCase } from '@core/domain/titleCase.ts';
import {
  repeaterListingToChannel,
  type BrandMeisterTalkGroupLookupProgress,
  type MapListingOptions,
  type RepeaterListing,
  type RepeaterSource,
} from '@integrations/repeaters/index.ts';
import { useRepeaterDirectorySearch } from '../../hooks/useRepeaterDirectorySearch.ts';
import { isSimplex } from '../../lib/channels.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { isOperationalStatus, queryKindHint } from '../../lib/repeaters.ts';
import { repeaterSearchCapabilities } from '../../lib/repeaterSearchCapabilities.ts';
import { hzToMhzString } from '../../lib/units.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useProjects } from '../../state/useProjects.ts';
import UseMyLocationButton from '../UseMyLocationButton/UseMyLocationButton.tsx';
import { BandPillsForRepeaterListing, ModePillsForRepeaterListing } from '../pills/index.ts';
import { FormPage, PageSection } from '../ui/index.ts';
import CodeplugMap from '../CodeplugMap/CodeplugMap.tsx';
import { findChannelByCallsign } from './findChannelByCallsign.ts';
import { buildRepeaterDirectoryRows } from './repeaterDirectoryRows.ts';
import RepeaterListingUpdateDialog from './RepeaterListingUpdateDialog.tsx';
import BrandMeisterTalkGroupLookupProgressBar from './BrandMeisterTalkGroupLookupProgressBar.tsx';
import {
  formatBrandMeisterImportMessage,
  persistBrandMeisterImport,
} from '../../lib/brandmeisterImport.ts';

const BAND_OPTIONS = [
  { value: '2M', label: '2 m' },
  { value: '70CM', label: '70 cm' },
  { value: '4M', label: '4 m' },
  { value: '6M', label: '6 m' },
  { value: '23CM', label: '23 cm' },
];

export interface RepeaterDirectorySearchProps {
  source: RepeaterSource;
  title: string;
  description: string;
}

function listingKey(listing: RepeaterListing): string {
  return `${listing.source}:${listing.remoteId}`;
}

function formatListingFrequencies(rxHz: number | null, txHz: number | null): string {
  if (isSimplex(rxHz, txHz)) {
    const freq = hzToMhzString(rxHz) || '—';
    return `Simplex ${freq} MHz`;
  }
  return `RX ${hzToMhzString(rxHz) || '—'} / TX ${hzToMhzString(txHz) || '—'} MHz`;
}

function displayListingName(listing: RepeaterListing, titleCaseNames: boolean): string {
  if (!listing.name) return '—';
  return titleCaseNames ? toTitleCase(listing.name) : listing.name;
}

function displayListingStatus(listing: RepeaterListing, titleCaseNames: boolean): string {
  if (!listing.status) return '—';
  return titleCaseNames ? toTitleCase(listing.status) : listing.status;
}

export default function RepeaterDirectorySearch({
  source,
  title,
  description,
}: RepeaterDirectorySearchProps) {
  const navigate = useNavigate();
  const { activeProjectId } = useProjects();
  const { library } = useLibrary();
  const search = useRepeaterDirectorySearch(source);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [addedChannelIds, setAddedChannelIds] = useState<Record<string, string>>({});
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const [updateChannel, setUpdateChannel] = useState<Channel | null>(null);
  const [updateListing, setUpdateListing] = useState<RepeaterListing | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [importTalkGroups, setImportTalkGroups] = useState(true);
  const [adding, setAdding] = useState(false);
  const [tgLookupProgress, setTgLookupProgress] =
    useState<BrandMeisterTalkGroupLookupProgress | null>(null);

  const isUk = source === 'ukrepeater';
  const capabilities = repeaterSearchCapabilities(source);
  const sourceLabel = isUk ? 'ukrepeater.net' : 'BrandMeister';
  const sourceUrl = isUk ? 'https://ukrepeater.net' : 'https://brandmeister.network';

  const mapOptions: MapListingOptions = useMemo(
    () => ({
      titleCaseText: isUk ? search.titleCaseNames : false,
      omitComment: !isUk,
    }),
    [isUk, search.titleCaseNames],
  );

  function existingChannel(listing: RepeaterListing): Channel | null {
    return findChannelByCallsign(library.channels, listing.callsign);
  }

  const rows = useMemo(
    () => buildRepeaterDirectoryRows(search.listings, library.channels, listingKey),
    [search.listings, library.channels],
  );

  const mapChannels = useMemo(() => {
    if (!isUk || !activeProjectId || search.listings.length === 0) return [];
    return search.listings
      .filter((listing) => listing.location != null)
      .map((listing) => repeaterListingToChannel(listing, activeProjectId, mapOptions));
  }, [isUk, activeProjectId, search.listings, mapOptions]);

  const mapSkippedCount = useMemo(() => {
    if (!isUk) return 0;
    return search.listings.filter((listing) => listing.location == null).length;
  }, [isUk, search.listings]);

  function recordListingAdded(key: string, channelId: string) {
    setAdded((prev) => new Set(prev).add(key));
    setAddedChannelIds((prev) => ({ ...prev, [key]: channelId }));
  }

  function openUpdate(listing: RepeaterListing) {
    const channel = existingChannel(listing);
    if (!channel) return;
    setUpdateChannel(channel);
    setUpdateListing(listing);
    setUpdateOpen(true);
  }

  function toggleRow(key: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    const keys = rows.filter((r) => !r.existing).map((r) => r.key);
    setSelected(new Set(keys));
  }

  async function handleAdd(listing: RepeaterListing) {
    if (!activeProjectId) return;
    setAdding(true);
    setAddMessage(null);
    try {
      if (source === 'brandmeister') {
        const result = await persistBrandMeisterImport({
          listing,
          projectId: activeProjectId,
          library,
          mapOptions,
          importTalkGroups,
          persistence,
          onTalkGroupLookupProgress: importTalkGroups ? setTgLookupProgress : undefined,
        });
        if (!result.ok) {
          setAddMessage(result.message);
          return;
        }
        setAdded((prev) => new Set(prev).add(listingKey(listing)));
        setAddMessage(formatBrandMeisterImportMessage(result));
        return;
      }
      const channel = repeaterListingToChannel(listing, activeProjectId, mapOptions);
      const result = await persistence.putChannel(channel, null);
      if (result.ok) {
        recordListingAdded(listingKey(listing), channel.id);
        setAddMessage(`Added ${listing.callsign}. Open the channel editor from the results row.`);
      }
    } finally {
      setAdding(false);
      setTgLookupProgress(null);
    }
  }

  async function handleAddSelected() {
    if (!activeProjectId) return;
    setAdding(true);
    let addedCount = 0;
    let skipped = 0;
    const warnings: string[] = [];
    let workingLibrary = library;
    try {
      for (const row of rows) {
        if (!selected.has(row.key)) continue;
        if (row.existing) {
          skipped++;
          continue;
        }
        if (source === 'brandmeister') {
          const result = await persistBrandMeisterImport({
            listing: row.listing,
            projectId: activeProjectId,
            library: workingLibrary,
            mapOptions,
            importTalkGroups,
            persistence,
            onTalkGroupLookupProgress: importTalkGroups ? setTgLookupProgress : undefined,
          });
          if (result.ok) {
            addedCount++;
            workingLibrary = result.library;
            setAdded((prev) => new Set(prev).add(row.key));
            if (result.warning) warnings.push(result.warning);
          } else {
            skipped++;
          }
          continue;
        }
        const channel = repeaterListingToChannel(row.listing, activeProjectId, mapOptions);
        const result = await persistence.putChannel(channel, null);
        if (result.ok) {
          addedCount++;
          recordListingAdded(row.key, channel.id);
        } else {
          skipped++;
        }
      }
      setAddMessage(
        addedCount > 0
          ? `Added ${addedCount} channel${addedCount === 1 ? '' : 's'}${skipped ? ` (${skipped} skipped)` : ''}${warnings.length ? `. ${warnings[0]}` : ''}.`
          : 'No channels were added.',
      );
      setSelected(new Set());
      if (addedCount > 0 && !isUk) {
        navigate('/library/channels');
      }
    } finally {
      setAdding(false);
      setTgLookupProgress(null);
    }
  }

  async function handleUseMyLocation(lat: number, lon: number) {
    const locator = coordsToLocator(lat, lon, 4);
    search.setQuery(locator);
    await search.search(locator);
  }

  const kindHint = isUk ? queryKindHint(search.kind) : null;

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
          <Group align="flex-end" wrap="wrap">
            <TextInput
              label="Search"
              placeholder={
                capabilities.unifiedQuery ? 'Callsign, locator, band (2m), or town' : 'e.g. GB3RF'
              }
              value={search.query}
              onChange={(e) => search.setQuery(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void search.search();
              }}
              style={{ flex: 1, minWidth: 200 }}
            />
            {capabilities.bandFilter ? (
              <Select
                label="Band filter"
                placeholder="Any band"
                data={BAND_OPTIONS}
                value={search.bandFilter}
                onChange={search.setBandFilter}
                clearable
                style={{ minWidth: 120 }}
              />
            ) : null}
            {capabilities.operationalOnly ? (
              <Switch
                label="Operational only"
                checked={search.operationalOnly}
                onChange={(e) => search.setOperationalOnly(e.currentTarget.checked)}
              />
            ) : null}
            {capabilities.titleCaseNames ? (
              <Checkbox
                label="Title case names"
                checked={search.titleCaseNames}
                onChange={(e) => search.setTitleCaseNames(e.currentTarget.checked)}
              />
            ) : null}
            {!isUk ? (
              <Checkbox
                label="Import talk groups and RX group list"
                checked={importTalkGroups}
                onChange={(e) => setImportTalkGroups(e.currentTarget.checked)}
              />
            ) : null}
            {capabilities.useMyLocation ? (
              <UseMyLocationButton onLocation={(lat, lon) => void handleUseMyLocation(lat, lon)} />
            ) : null}
            <Button
              leftSection={<IconSearch size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
              onClick={() => void search.search()}
              loading={search.loading}
            >
              Search
            </Button>
          </Group>

          {kindHint ? (
            <Text size="sm" c="dimmed">
              {kindHint}
            </Text>
          ) : null}

          {search.error ? (
            <Alert color="red">
              {search.error}{' '}
              <Anchor href={sourceUrl} target="_blank" rel="noopener noreferrer">
                {sourceLabel}
              </Anchor>
            </Alert>
          ) : null}

          {addMessage ? <Alert color="green">{addMessage}</Alert> : null}
        </Stack>
      </PageSection>

      {rows.length > 0 ? (
        <PageSection title="Results">
          {isUk ? (
            <Stack gap="xs" mb="md">
              <CodeplugMap
                channels={mapChannels}
                zones={[]}
                allChannels={mapChannels}
                height={360}
              />
              {mapSkippedCount > 0 ? (
                <Text size="sm" c="dimmed">
                  {mapSkippedCount} listing{mapSkippedCount === 1 ? '' : 's'} without coordinates
                  not shown on map.
                </Text>
              ) : null}
            </Stack>
          ) : null}
          <ScrollArea>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>
                    <Checkbox
                      aria-label="Select all addable"
                      checked={
                        rows.filter((r) => !r.existing).length > 0 &&
                        rows.filter((r) => !r.existing).every((r) => selected.has(r.key))
                      }
                      indeterminate={
                        selected.size > 0 &&
                        !rows.filter((r) => !r.existing).every((r) => selected.has(r.key))
                      }
                      onChange={(e) => toggleAll(e.currentTarget.checked)}
                    />
                  </Table.Th>
                  <Table.Th>Callsign</Table.Th>
                  <Table.Th>Band</Table.Th>
                  <Table.Th>{capabilities.locationLabel}</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Mode</Table.Th>
                  <Table.Th>Frequencies</Table.Th>
                  {capabilities.locatorColumn ? <Table.Th>Locator</Table.Th> : null}
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row) => {
                  const { listing } = row;
                  const isAdded = added.has(row.key);
                  const disabled = Boolean(row.existing);
                  return (
                    <Table.Tr key={row.key} opacity={disabled ? 0.6 : 1}>
                      <Table.Td>
                        <Checkbox
                          checked={selected.has(row.key)}
                          disabled={disabled}
                          onChange={(e) => toggleRow(row.key, e.currentTarget.checked)}
                          aria-label={`Select ${listing.callsign}`}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text fw={600}>{listing.callsign}</Text>
                      </Table.Td>
                      <Table.Td>
                        <BandPillsForRepeaterListing
                          rxFrequencyHz={listing.rxFrequencyHz}
                          txFrequencyHz={listing.txFrequencyHz}
                          wireBand={listing.band}
                          size="xs"
                        />
                      </Table.Td>
                      <Table.Td>
                        {displayListingName(listing, isUk && search.titleCaseNames)}
                      </Table.Td>
                      <Table.Td>
                        <Text
                          size="sm"
                          c={isOperationalStatus(listing.status) ? undefined : 'orange'}
                        >
                          {displayListingStatus(listing, isUk && search.titleCaseNames)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <ModePillsForRepeaterListing modes={listing.modes} size="xs" />
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {formatListingFrequencies(listing.rxFrequencyHz, listing.txFrequencyHz)}
                        </Text>
                      </Table.Td>
                      {capabilities.locatorColumn ? (
                        <Table.Td>{listing.locator ?? '—'}</Table.Td>
                      ) : null}
                      <Table.Td>
                        {row.existing ? (
                          <Button
                            size="compact-sm"
                            variant="outline"
                            onClick={() => openUpdate(listing)}
                          >
                            Update existing
                          </Button>
                        ) : isAdded && addedChannelIds[row.key] ? (
                          <Button
                            size="compact-sm"
                            variant="light"
                            component={Link}
                            to={`/library/channels/${addedChannelIds[row.key]}`}
                          >
                            Open channel
                          </Button>
                        ) : (
                          <Button
                            size="compact-sm"
                            variant={isAdded ? 'light' : 'filled'}
                            disabled={isAdded || adding}
                            loading={adding}
                            onClick={() => void handleAdd(listing)}
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
          </ScrollArea>

          <Group justify="space-between" mt="md">
            <Button
              disabled={selected.size === 0 || adding}
              loading={adding}
              onClick={() => void handleAddSelected()}
            >
              Add selected ({selected.size})
            </Button>
            {added.size > 0 ? (
              <Button variant="light" onClick={() => navigate('/library/channels')}>
                View library
              </Button>
            ) : null}
          </Group>
        </PageSection>
      ) : null}

      <Text size="xs" c="dimmed">
        Data from{' '}
        <Anchor href={sourceUrl} target="_blank" rel="noopener noreferrer">
          {sourceLabel}
        </Anchor>
        {isUk
          ? ' (RSGB ETCC beta API). For amateur programming convenience — not authoritative for emergency operations.'
          : '. For amateur programming convenience — not authoritative for emergency operations.'}
      </Text>

      {dialogChannel && updateListing ? (
        <RepeaterListingUpdateDialog
          channel={dialogChannel}
          listing={updateListing}
          mapOptions={mapOptions}
          opened={updateOpen}
          onClose={() => setUpdateOpen(false)}
        />
      ) : null}

      <Modal
        opened={Boolean(tgLookupProgress)}
        onClose={() => {}}
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        title="Loading BrandMeister talk groups"
      >
        <BrandMeisterTalkGroupLookupProgressBar progress={tgLookupProgress} />
      </Modal>
    </FormPage>
  );
}
