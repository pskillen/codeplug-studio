import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Autocomplete,
  Button,
  Checkbox,
  Group,
  Input,
  Modal,
  MultiSelect,
  ScrollArea,
  SegmentedControl,
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
import { reverseGeocode, GeocodeError } from '@integrations/geocode/index.ts';
import {
  normaliseRepeaterBookCountry,
  repeaterBookRegionForCountry,
  REPEATERBOOK_COUNTRY_NAMES,
} from '@integrations/repeaters/repeaterbook/countryNames.ts';
import {
  repeaterListingToChannel,
  type BrandMeisterTalkGroupLookupProgress,
  type ListingGeometryFilter,
  type MapListingOptions,
  type RepeaterListing,
  type RepeaterSource,
} from '@integrations/repeaters/index.ts';
import { useRepeaterDirectorySearch } from '../../hooks/useRepeaterDirectorySearch.ts';
import { useMapSettings } from '../../hooks/useMapSettings.ts';
import { isSimplex } from '../../lib/channels.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { isOperationalStatus, queryKindHint } from '../../lib/repeaters.ts';
import { repeaterSearchCapabilities } from '../../lib/repeaterSearchCapabilities.ts';
import { SETTINGS_REPEATERBOOK_SECTION_ID } from '../../lib/settingsSections.ts';
import { modeFilterOptions } from '../../lib/channelModes.ts';
import { hzToMhzString } from '../../lib/units.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useProjects } from '../../state/useProjects.ts';
import { listingDisplayLocator } from '@integrations/repeaters/listingLocator.ts';
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

const GEOMETRY_FILTER_OPTIONS: { label: string; value: ListingGeometryFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Simplex', value: 'simplex' },
  { label: 'Split', value: 'split' },
];

const SOURCE_META: Record<
  RepeaterSource,
  { label: string; url: string; attributionSuffix: string }
> = {
  ukrepeater: {
    label: 'ukrepeater.net',
    url: 'https://ukrepeater.net',
    attributionSuffix:
      ' (RSGB ETCC beta API). For amateur programming convenience — not authoritative for emergency operations.',
  },
  brandmeister: {
    label: 'BrandMeister',
    url: 'https://brandmeister.network',
    attributionSuffix:
      '. For amateur programming convenience — not authoritative for emergency operations.',
  },
  irts: {
    label: 'IRTS',
    url: 'https://www.irts.ie/cgi/repeater.cgi',
    attributionSuffix:
      '. For amateur programming convenience — not authoritative for emergency operations.',
  },
  repeaterbook: {
    label: 'RepeaterBook',
    url: 'https://www.repeaterbook.com/',
    attributionSuffix:
      ' — data courtesy of RepeaterBook.com. For amateur programming convenience — not a substitute for RepeaterBook search.',
  },
};

const UK_MODE_FILTER_OPTIONS = modeFilterOptions().filter((o) => o.value !== 'other');

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
  const { mapboxToken } = useMapSettings();
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
  const [locationHint, setLocationHint] = useState<string | null>(null);

  const isUk = source === 'ukrepeater';
  const isBrandmeister = source === 'brandmeister';
  const isRepeaterbook = source === 'repeaterbook';
  const sourceMeta = SOURCE_META[source];
  const capabilities = repeaterSearchCapabilities(source);
  const useTitleCaseNames = capabilities.titleCaseNames && search.titleCaseNames;

  useEffect(() => {
    if (source !== 'irts') return;
    void search.search('');
    // Load ROI catalogue on mount; filters apply on subsequent searches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const mapOptions: MapListingOptions = useMemo(
    () => ({
      titleCaseText: useTitleCaseNames,
      omitComment: isBrandmeister,
    }),
    [useTitleCaseNames, isBrandmeister],
  );

  function existingChannel(listing: RepeaterListing): Channel | null {
    return findChannelByCallsign(library.channels, listing.callsign);
  }

  const rows = useMemo(
    () => buildRepeaterDirectoryRows(search.listings, library.channels, listingKey),
    [search.listings, library.channels],
  );

  const mapChannels = useMemo(() => {
    if (!activeProjectId || search.listings.length === 0) return [];
    return search.listings
      .filter((listing) => listing.location != null)
      .map((listing) => repeaterListingToChannel(listing, activeProjectId, mapOptions));
  }, [activeProjectId, search.listings, mapOptions]);

  const mapSkippedCount = useMemo(
    () => search.listings.filter((listing) => listing.location == null).length,
    [search.listings],
  );

  function libraryChannelIdForRow(row: (typeof rows)[number]): string | null {
    return row.existing?.id ?? addedChannelIds[row.key] ?? null;
  }

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
    } finally {
      setAdding(false);
      setTgLookupProgress(null);
    }
  }

  async function handleUseMyLocation(lat: number, lon: number) {
    const locator = coordsToLocator(lat, lon, 4);
    if (isRepeaterbook) {
      search.setLocatorFilter(locator);
      setLocationHint(null);
      try {
        const reverse = await reverseGeocode(
          { lat, lon },
          { mapboxToken: mapboxToken.trim() || undefined },
        );
        const country = normaliseRepeaterBookCountry(reverse?.country);
        if (country) {
          search.setCountry(country);
          search.setRegion(repeaterBookRegionForCountry(country));
          setLocationHint(
            reverse?.label
              ? `Near ${reverse.label} — locator filter ${locator}`
              : `Locator ${locator}`,
          );
          await search.search();
          return;
        }
        setLocationHint(
          `Locator filter set to ${locator}. Pick a country from the list and search again.`,
        );
      } catch (err) {
        setLocationHint(
          err instanceof GeocodeError
            ? `${err.message} Locator filter set to ${locator}.`
            : `Could not look up country. Locator filter set to ${locator}.`,
        );
      }
      return;
    }

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
        description={`Query ${sourceMeta.label} and add matches to your library.`}
      >
        <Stack gap="sm">
          {isRepeaterbook && !search.hasToken ? (
            <Alert color="yellow">
              RepeaterBook token required.{' '}
              <Anchor
                component={Link}
                to="/settings"
                state={{ scrollTo: SETTINGS_REPEATERBOOK_SECTION_ID }}
              >
                Add your token in Settings
              </Anchor>
              .
            </Alert>
          ) : null}

          {capabilities.regionSelector ? (
            <Group align="flex-end" wrap="wrap">
              <Input.Wrapper label="Region">
                <SegmentedControl
                  value={search.region}
                  onChange={(value) => search.setRegion(value as 'na' | 'row')}
                  data={[
                    { label: 'North America', value: 'na' },
                    { label: 'Rest of world', value: 'row' },
                  ]}
                />
              </Input.Wrapper>
              {search.region === 'na' ? (
                <TextInput
                  label="State ID (FIPS)"
                  placeholder="e.g. 06 for California"
                  value={search.stateId}
                  onChange={(e) => search.setStateId(e.currentTarget.value)}
                  style={{ minWidth: 160 }}
                />
              ) : null}
              {capabilities.countryAutocomplete ? (
                <Autocomplete
                  label={search.region === 'row' ? 'Country' : 'Country (optional)'}
                  placeholder={
                    search.region === 'row'
                      ? 'Start typing — e.g. United Kingdom'
                      : 'United States or Canada'
                  }
                  data={[...REPEATERBOOK_COUNTRY_NAMES]}
                  value={search.country}
                  onChange={search.setCountry}
                  limit={20}
                  style={{ flex: 1, minWidth: 220 }}
                />
              ) : (
                <TextInput
                  label={search.region === 'row' ? 'Country' : 'Country (optional)'}
                  placeholder={
                    search.region === 'row' ? 'e.g. Switzerland' : 'United States or Canada'
                  }
                  value={search.country}
                  onChange={(e) => search.setCountry(e.currentTarget.value)}
                  style={{ flex: 1, minWidth: 180 }}
                />
              )}
            </Group>
          ) : null}

          {locationHint ? (
            <Text size="sm" c="dimmed">
              {locationHint}
            </Text>
          ) : null}

          {capabilities.locatorFilter ? (
            <TextInput
              label="Locator filter"
              description="Client-side Maidenhead prefix filter (e.g. JO22) to narrow large country result sets."
              placeholder="e.g. JO22"
              value={search.locatorFilter}
              onChange={(e) => search.setLocatorFilter(e.currentTarget.value.toUpperCase())}
              style={{ maxWidth: 200 }}
            />
          ) : null}

          <Group align="flex-end" wrap="wrap">
            <TextInput
              label="Search"
              placeholder={
                capabilities.unifiedQuery
                  ? 'Callsign, locator, or town'
                  : source === 'irts'
                    ? 'Callsign or location (optional)'
                    : isRepeaterbook
                      ? 'Callsign (optional; % wildcards supported)'
                      : 'e.g. GB3RF'
              }
              value={search.query}
              onChange={(e) => search.setQuery(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void search.search();
              }}
              style={{ flex: 1, minWidth: 200 }}
            />
            {capabilities.bandFilter ? (
              <MultiSelect
                label="Band filter"
                placeholder="Any band"
                data={BAND_OPTIONS}
                value={search.bandFilter}
                onChange={search.setBandFilter}
                clearable
                style={{ minWidth: 140 }}
              />
            ) : null}
            {capabilities.geometryFilter ? (
              <Input.Wrapper label="Geometry">
                <SegmentedControl
                  value={search.geometryFilter}
                  onChange={(value) => search.setGeometryFilter(value as ListingGeometryFilter)}
                  data={GEOMETRY_FILTER_OPTIONS}
                  style={{ minWidth: 200 }}
                />
              </Input.Wrapper>
            ) : null}
            {capabilities.modeFilter ? (
              <MultiSelect
                label="Mode filter"
                placeholder="Any mode"
                data={UK_MODE_FILTER_OPTIONS}
                value={search.modeFilter}
                onChange={search.setModeFilter}
                clearable
                style={{ minWidth: 140 }}
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
            {isBrandmeister ? (
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
              disabled={isRepeaterbook && !search.hasToken}
            >
              Search
            </Button>
          </Group>

          {kindHint && !search.error ? (
            <Text size="sm" c="dimmed">
              {kindHint}
            </Text>
          ) : null}

          {search.error ? (
            <Alert color="red">
              {search.error}{' '}
              <Anchor href={sourceMeta.url} target="_blank" rel="noopener noreferrer">
                {sourceMeta.label}
              </Anchor>
            </Alert>
          ) : null}

          {addMessage ? <Alert color="green">{addMessage}</Alert> : null}
        </Stack>
      </PageSection>

      {rows.length > 0 ? (
        <PageSection title="Results">
          <Stack gap="xs" mb="md">
            {mapChannels.length > 0 ? (
              <CodeplugMap
                channels={mapChannels}
                zones={[]}
                allChannels={mapChannels}
                height={360}
              />
            ) : null}
            {mapSkippedCount > 0 ? (
              <Text size="sm" c="dimmed">
                {mapSkippedCount} listing{mapSkippedCount === 1 ? '' : 's'} without coordinates not
                shown on map.
              </Text>
            ) : null}
          </Stack>
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
                  <Table.Th>Locator</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row) => {
                  const { listing } = row;
                  const isAdded = added.has(row.key);
                  const disabled = Boolean(row.existing);
                  const libraryChannelId = libraryChannelIdForRow(row);
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
                        {libraryChannelId ? (
                          <Anchor
                            component={Link}
                            to={`/library/channels/${libraryChannelId}`}
                            fw={600}
                          >
                            {listing.callsign}
                          </Anchor>
                        ) : (
                          <Text fw={600}>{listing.callsign}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <BandPillsForRepeaterListing
                          rxFrequencyHz={listing.rxFrequencyHz}
                          txFrequencyHz={listing.txFrequencyHz}
                          wireBand={listing.band}
                          size="xs"
                        />
                      </Table.Td>
                      <Table.Td>{displayListingName(listing, useTitleCaseNames)}</Table.Td>
                      <Table.Td>
                        <Text
                          size="sm"
                          c={isOperationalStatus(listing.status) ? undefined : 'orange'}
                        >
                          {displayListingStatus(listing, useTitleCaseNames)}
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
                      <Table.Td>{listingDisplayLocator(listing) ?? '—'}</Table.Td>
                      <Table.Td>
                        {row.existing ? (
                          <Button
                            size="compact-sm"
                            variant="outline"
                            onClick={() => openUpdate(listing)}
                          >
                            Update existing
                          </Button>
                        ) : isAdded && libraryChannelId ? (
                          <Button
                            size="compact-sm"
                            variant="light"
                            component={Link}
                            to={`/library/channels/${libraryChannelId}`}
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
        <Anchor href={sourceMeta.url} target="_blank" rel="noopener noreferrer">
          {sourceMeta.label}
        </Anchor>
        {sourceMeta.attributionSuffix}
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
