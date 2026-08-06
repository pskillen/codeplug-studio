import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Anchor, MultiSelect } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { Channel } from '@core/models/library.ts';
import { coordsToLocator } from '@core/domain/maidenhead.ts';
import { toTitleCase } from '@core/domain/titleCase.ts';
import { reverseGeocode, GeocodeError } from '@integrations/geocode/index.ts';
import {
  normaliseRepeaterBookCountry,
  repeaterBookRegionForCountry,
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
import CountryComboboxField from '../directories/CountryComboboxField.tsx';
import DirectoryIngestPage from '../directories/DirectoryIngestPage.tsx';
import pageClasses from '../directories/DirectoryIngestPage.module.css';
import CodeplugMap from '../CodeplugMap/CodeplugMap.tsx';
import {
  Button,
  Checkbox,
  DataTable,
  FormField,
  MapPanel,
  ModalShell,
  Panel,
  SegmentedControl,
  StatusBanner,
  TextInput,
  ToggleSwitch,
  type DataTableColumn,
} from '../v2/index.ts';
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

const REGION_OPTIONS = [
  { label: 'North America', value: 'na' as const },
  { label: 'Rest of world', value: 'row' as const },
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

const GATED_SELECTION_CAPTION =
  "Already-in-library rows are dimmed and can't be re-added — use Update to refresh their frequency/tone from the directory.";

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
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
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

  const resultColumns = useMemo((): DataTableColumn<(typeof rows)[number]>[] => {
    return [
      {
        key: 'callsign',
        header: 'Callsign',
        width: '120px',
        render: (row) => {
          const id = libraryChannelIdForRow(row);
          if (id) {
            return (
              <Link to={`/library/channels/${id}`} className="libraryListNameLink">
                {row.listing.callsign}
              </Link>
            );
          }
          return <strong>{row.listing.callsign}</strong>;
        },
        sortValue: (row) => row.listing.callsign,
      },
      {
        key: 'band',
        header: 'Band',
        width: '88px',
        render: (row) => (
          <BandPillsForRepeaterListing
            rxFrequencyHz={row.listing.rxFrequencyHz}
            txFrequencyHz={row.listing.txFrequencyHz}
            wireBand={row.listing.band}
            size="xs"
          />
        ),
      },
      {
        key: 'location',
        header: capabilities.locationLabel,
        render: (row) => displayListingName(row.listing, useTitleCaseNames),
        sortValue: (row) => displayListingName(row.listing, useTitleCaseNames),
      },
      {
        key: 'status',
        header: 'Status',
        width: '100px',
        render: (row) => (
          <span style={{ color: isOperationalStatus(row.listing.status) ? undefined : '#c2410c' }}>
            {displayListingStatus(row.listing, useTitleCaseNames)}
          </span>
        ),
      },
      {
        key: 'mode',
        header: 'Mode',
        width: '100px',
        hideOnMobile: true,
        render: (row) => <ModePillsForRepeaterListing modes={row.listing.modes} size="xs" />,
      },
      {
        key: 'frequencies',
        header: 'Frequencies',
        hideOnMobile: true,
        render: (row) =>
          formatListingFrequencies(row.listing.rxFrequencyHz, row.listing.txFrequencyHz),
      },
      {
        key: 'locator',
        header: 'Locator',
        width: '80px',
        hideOnMobile: true,
        render: (row) => listingDisplayLocator(row.listing) ?? '—',
      },
      {
        key: 'actions',
        header: '',
        width: '140px',
        hideable: false,
        align: 'right',
        render: (row) => {
          const { listing } = row;
          const isAdded = added.has(row.key);
          const libraryChannelId = libraryChannelIdForRow(row);
          if (row.existing) {
            return (
              <Button variant="outline" size="sm" onClick={() => openUpdate(listing)}>
                Update
              </Button>
            );
          }
          if (isAdded && libraryChannelId) {
            return (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/library/channels/${libraryChannelId}`)}
              >
                Open
              </Button>
            );
          }
          return (
            <Button
              variant={isAdded ? 'secondary' : 'primary'}
              size="sm"
              disabled={isAdded || adding}
              loading={adding}
              onClick={() => void handleAdd(listing)}
            >
              {isAdded ? 'Added' : 'Add'}
            </Button>
          );
        },
      },
    ];
  }, [added, addedChannelIds, adding, capabilities.locationLabel, useTitleCaseNames, rows]);

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
    const selected = new Set(selectedKeys);
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
      setSelectedKeys([]);
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
    <DirectoryIngestPage
      crumb="Channels"
      crumbTo="/library/channels"
      title={title}
      subtitle={description}
      footer={
        <Button variant="secondary" onClick={() => navigate('/library/channels')}>
          Back to library
        </Button>
      }
    >
      <Panel title="Search" sub={`Query ${sourceMeta.label} and add matches to your library.`}>
        {isRepeaterbook && !search.hasToken ? (
          <StatusBanner tone="warning">
            RepeaterBook token required.{' '}
            <Link
              to="/settings"
              state={{ scrollTo: SETTINGS_REPEATERBOOK_SECTION_ID }}
              className="libraryListNameLink"
            >
              Add your token in Settings
            </Link>
            .
          </StatusBanner>
        ) : null}

        {capabilities.regionSelector ? (
          <div className={pageClasses.filterGrid}>
            <FormField label="Region" className={pageClasses.filterField}>
              <SegmentedControl
                options={REGION_OPTIONS}
                value={search.region}
                onChange={(value) => search.setRegion(value)}
              />
            </FormField>
            {search.region === 'na' ? (
              <FormField label="State ID (FIPS)" className={pageClasses.filterField}>
                <TextInput
                  variant="plain"
                  placeholder="e.g. 06 for California"
                  value={search.stateId}
                  onChange={(e) => search.setStateId(e.currentTarget.value)}
                />
              </FormField>
            ) : null}
            {capabilities.countryAutocomplete ? (
              <CountryComboboxField
                label={search.region === 'row' ? 'Country' : 'Country (optional)'}
                value={search.country}
                onChange={search.setCountry}
                placeholder={
                  search.region === 'row'
                    ? 'Start typing — e.g. United Kingdom'
                    : 'United States or Canada'
                }
                className={pageClasses.filterFieldWide}
              />
            ) : (
              <FormField
                label={search.region === 'row' ? 'Country' : 'Country (optional)'}
                className={pageClasses.filterFieldWide}
              >
                <TextInput
                  variant="plain"
                  placeholder={
                    search.region === 'row' ? 'e.g. Switzerland' : 'United States or Canada'
                  }
                  value={search.country}
                  onChange={(e) => search.setCountry(e.currentTarget.value)}
                />
              </FormField>
            )}
          </div>
        ) : null}

        {locationHint ? <p className={pageClasses.attribution}>{locationHint}</p> : null}

        {capabilities.locatorFilter ? (
          <FormField
            label="Locator filter"
            hint="Client-side Maidenhead prefix filter (e.g. JO22) to narrow large country result sets."
            className={pageClasses.filterField}
          >
            <TextInput
              variant="plain"
              placeholder="e.g. JO22"
              value={search.locatorFilter}
              onChange={(e) => search.setLocatorFilter(e.currentTarget.value.toUpperCase())}
            />
          </FormField>
        ) : null}

        <div className={pageClasses.filterGrid}>
          <FormField label="Search" className={pageClasses.filterFieldWide}>
            <TextInput
              variant="plain"
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
            />
          </FormField>
          {capabilities.bandFilter ? (
            <FormField label="Band filter" className={pageClasses.filterField}>
              <MultiSelect
                placeholder="Any band"
                data={BAND_OPTIONS}
                value={search.bandFilter}
                onChange={search.setBandFilter}
                clearable
                variant="unstyled"
              />
            </FormField>
          ) : null}
          {capabilities.geometryFilter ? (
            <FormField label="Geometry" className={pageClasses.filterField}>
              <SegmentedControl
                options={GEOMETRY_FILTER_OPTIONS}
                value={search.geometryFilter}
                onChange={(value) => search.setGeometryFilter(value)}
              />
            </FormField>
          ) : null}
          {capabilities.modeFilter ? (
            <FormField label="Mode filter" className={pageClasses.filterField}>
              <MultiSelect
                placeholder="Any mode"
                data={UK_MODE_FILTER_OPTIONS}
                value={search.modeFilter}
                onChange={search.setModeFilter}
                clearable
                variant="unstyled"
              />
            </FormField>
          ) : null}
        </div>

        <div className={pageClasses.filterActions}>
          {capabilities.operationalOnly ? (
            <ToggleSwitch
              label="Operational only"
              checked={search.operationalOnly}
              onChange={search.setOperationalOnly}
            />
          ) : null}
          {capabilities.titleCaseNames ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <Checkbox
                checked={search.titleCaseNames}
                onCheckedChange={search.setTitleCaseNames}
                aria-label="Title case names"
              />
              Title case names
            </label>
          ) : null}
          {isBrandmeister ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <Checkbox
                checked={importTalkGroups}
                onCheckedChange={setImportTalkGroups}
                aria-label="Import talk groups and RX group list"
              />
              Import talk groups and RX group list
            </label>
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
        </div>

        {kindHint && !search.error ? <p className={pageClasses.attribution}>{kindHint}</p> : null}

        {search.error ? (
          <StatusBanner tone="warning">
            {search.error}{' '}
            <Anchor href={sourceMeta.url} target="_blank" rel="noopener noreferrer">
              {sourceMeta.label}
            </Anchor>
          </StatusBanner>
        ) : null}

        {addMessage ? <StatusBanner tone="success">{addMessage}</StatusBanner> : null}
      </Panel>

      {rows.length > 0 ? (
        <Panel title="Results">
          {mapChannels.length > 0 ? (
            <MapPanel title="Results map" height={360}>
              <CodeplugMap
                channels={mapChannels}
                zones={[]}
                allChannels={mapChannels}
                height="100%"
              />
            </MapPanel>
          ) : null}
          {mapSkippedCount > 0 ? (
            <p className={pageClasses.attribution}>
              {mapSkippedCount} listing{mapSkippedCount === 1 ? '' : 's'} without coordinates not
              shown on map.
            </p>
          ) : null}
          <DataTable
            variant="embedded"
            rows={rows}
            getRowId={(row) => row.key}
            columns={resultColumns}
            caption={GATED_SELECTION_CAPTION}
            selectable
            selectedKeys={selectedKeys}
            onSelectionChange={setSelectedKeys}
            isRowSelectable={(row) => !row.existing}
            bulkActions={
              <>
                <Button
                  size="sm"
                  disabled={selectedKeys.length === 0 || adding}
                  loading={adding}
                  onClick={() => void handleAddSelected()}
                >
                  Add selected ({selectedKeys.length})
                </Button>
                {added.size > 0 ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate('/library/channels')}
                  >
                    View library
                  </Button>
                ) : null}
              </>
            }
          />
        </Panel>
      ) : null}

      <p className={pageClasses.attribution}>
        Data from{' '}
        <a href={sourceMeta.url} target="_blank" rel="noopener noreferrer">
          {sourceMeta.label}
        </a>
        {sourceMeta.attributionSuffix}
      </p>

      {dialogChannel && updateListing ? (
        <RepeaterListingUpdateDialog
          channel={dialogChannel}
          listing={updateListing}
          mapOptions={mapOptions}
          opened={updateOpen}
          onClose={() => setUpdateOpen(false)}
        />
      ) : null}

      <ModalShell
        open={Boolean(tgLookupProgress)}
        onClose={() => undefined}
        title="Loading BrandMeister talk groups"
        dismissible={false}
      >
        <BrandMeisterTalkGroupLookupProgressBar progress={tgLookupProgress} />
      </ModalShell>
    </DirectoryIngestPage>
  );
}
