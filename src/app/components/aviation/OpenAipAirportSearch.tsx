import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Button,
  Card,
  Checkbox,
  Group,
  NumberInput,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { newChannel } from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
import type { AirportListing } from '@integrations/aviation/index.ts';
import { airportQueryKindHint } from '@integrations/aviation/index.ts';
import { buildAirbandImportPlan } from '@core/services/airbandImport.ts';
import {
  formatAirbandChannelName,
  isCivilAirbandHz,
  type AirbandNamePrefixKind,
} from '@core/domain/airband/index.ts';
import { validateZoneMembership } from '@core/domain/validation.ts';
import { SETTINGS_OPENAIP_SECTION_ID } from '../../lib/settingsSections.ts';
import { useOpenAipAirportSearch } from '../../hooks/useOpenAipAirportSearch.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import {
  airportFrequencyKey,
  airportListingKey,
  airportListingToAirbandInput,
  buildExistingAirbandChannelIndex,
  formatAirportDistanceKm,
  formatFrequencyMhz,
  parseAirportFrequencyKey,
} from '../../lib/openAipAirport.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useProjects } from '../../state/useProjects.ts';
import UseMyLocationButton from '../UseMyLocationButton/UseMyLocationButton.tsx';
import ZoneSelect from '../library/ZoneSelect.tsx';
import { FormPage, PageSection, SplitButton } from '../ui/index.ts';
import CodeplugMap from '../CodeplugMap/CodeplugMap.tsx';

const DEFAULT_ZONE_NAME = 'Airband';

const NAME_PREFIX_OPTIONS: { value: AirbandNamePrefixKind; label: string }[] = [
  { value: 'iata', label: 'IATA' },
  { value: 'icao', label: 'ICAO' },
  { value: 'name', label: 'Airport name' },
];

type ZoneTargetMode = 'new' | 'existing';

interface ZoneImportOptions {
  alsoCreateZone?: boolean;
  zoneName?: string;
  targetZoneId?: string;
  namePrefixKind?: AirbandNamePrefixKind;
}

function buildZoneImportOptions(
  alsoCreateZone: boolean,
  zoneTargetMode: ZoneTargetMode,
  zoneName: string,
  existingZoneId: string | null,
): ZoneImportOptions {
  if (!alsoCreateZone) return {};
  if (zoneTargetMode === 'existing') {
    return existingZoneId
      ? { alsoCreateZone: true, targetZoneId: existingZoneId }
      : { alsoCreateZone: true };
  }
  return { alsoCreateZone: true, zoneName };
}

function mapChannelsFromAirports(airports: AirportListing[]): Channel[] {
  return airports
    .filter((airport) => airport.location != null)
    .map((airport) => {
      const name = airport.iata ?? airport.icao ?? airport.name;
      const base = newChannel('map-preview', name);
      return {
        ...base,
        rxFrequency: airport.frequencies[0]?.rxFrequencyHz ?? null,
        location: airport.location,
        useLocation: true,
      };
    });
}

function frequencyKeysForAirport(airport: AirportListing): string[] {
  return airport.frequencies.map((_, index) => airportFrequencyKey(airport, index));
}

function buildSelectionsFromKeys(
  airports: AirportListing[],
  selectedKeys: Set<string>,
): Array<{ airport: AirportListing; frequencyIndices: number[] }> {
  const indicesByAirport = new Map<string, number[]>();

  for (const key of selectedKeys) {
    const parsed = parseAirportFrequencyKey(key);
    if (!parsed) continue;
    const indices = indicesByAirport.get(parsed.airportKey) ?? [];
    indices.push(parsed.frequencyIndex);
    indicesByAirport.set(parsed.airportKey, indices);
  }

  return airports
    .filter((airport) => indicesByAirport.has(airportListingKey(airport)))
    .map((airport) => {
      const airportKey = airportListingKey(airport);
      const frequencyIndices = [...new Set(indicesByAirport.get(airportKey)!)].sort(
        (a, b) => a - b,
      );
      return { airport, frequencyIndices };
    });
}

function selectableFrequencyKeys(
  airport: AirportListing,
  existingChannelByKey: ReadonlyMap<string, Channel>,
): string[] {
  return frequencyKeysForAirport(airport).filter((key) => !existingChannelByKey.has(key));
}

function FrequencyImportPreview({
  wireLabel,
  proposedName,
  frequencyMhz,
}: {
  wireLabel: string;
  proposedName: string;
  frequencyMhz: string;
}) {
  return (
    <Group gap="xs" wrap="nowrap" align="flex-start" grow>
      <Text size="sm" c="dimmed" lineClamp={2} style={{ flex: 1, minWidth: 0 }}>
        {wireLabel}
      </Text>
      <Text size="sm" c="dimmed" aria-hidden>
        →
      </Text>
      <Text size="sm" lineClamp={2} style={{ flex: 1, minWidth: 0 }}>
        {proposedName} · {frequencyMhz}
      </Text>
    </Group>
  );
}

function ExistingFrequencyRow({
  wireLabel,
  channel,
  frequencyMhz,
}: {
  wireLabel: string;
  channel: Channel;
  frequencyMhz: string;
}) {
  return (
    <Group gap="xs" wrap="nowrap" align="flex-start" grow>
      <Text size="sm" c="dimmed" lineClamp={2} style={{ flex: 1, minWidth: 0 }}>
        {wireLabel}
      </Text>
      <Text size="sm" c="dimmed" aria-hidden>
        →
      </Text>
      <Group gap={6} wrap="wrap" style={{ flex: 1, minWidth: 0 }}>
        <Anchor component={Link} to={`/library/channels/${channel.id}`} size="sm">
          {channel.name}
        </Anchor>
        <Text size="sm" c="dimmed">
          · {frequencyMhz}
        </Text>
        <Text size="xs" c="dimmed">
          In library
        </Text>
      </Group>
    </Group>
  );
}

function AirportCard({
  airport,
  referencePoint,
  selectedKeys,
  existingChannelByKey,
  namePrefixKind,
  onToggleFrequency,
  onToggleAirport,
  onSelectAllFrequencies,
  onSelectNoFrequencies,
  onAddChannels,
  onAddAsZone,
  adding,
}: {
  airport: AirportListing;
  referencePoint: { lat: number; lon: number } | null;
  selectedKeys: Set<string>;
  existingChannelByKey: ReadonlyMap<string, Channel>;
  namePrefixKind: AirbandNamePrefixKind;
  onToggleFrequency: (key: string, checked: boolean) => void;
  onToggleAirport: (checked: boolean) => void;
  onSelectAllFrequencies: () => void;
  onSelectNoFrequencies: () => void;
  onAddChannels: () => void;
  onAddAsZone: () => void;
  adding: boolean;
}) {
  const distance = formatAirportDistanceKm(airport, referencePoint);
  const codes = [airport.icao, airport.iata].filter(Boolean).join(' / ');
  const selectableKeys = selectableFrequencyKeys(airport, existingChannelByKey);
  const selectedCount = selectableKeys.filter((key) => selectedKeys.has(key)).length;
  const airportFullySelected = selectableKeys.length > 0 && selectedCount === selectableKeys.length;
  const airportPartiallySelected = selectedCount > 0 && !airportFullySelected;
  const airbandInput = useMemo(() => airportListingToAirbandInput(airport), [airport]);

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group align="flex-start" gap="sm" wrap="nowrap">
            <Checkbox
              checked={airportFullySelected}
              indeterminate={airportPartiallySelected}
              onChange={(e) => onToggleAirport(e.currentTarget.checked)}
              aria-label={`Select all frequencies for ${airport.name}`}
              mt={4}
              disabled={selectableKeys.length === 0}
            />
            <Stack gap={2}>
              <Text fw={600}>{airport.name}</Text>
              <Text size="sm" c="dimmed">
                {codes || 'No ICAO/IATA'}
                {distance ? ` · ${distance}` : ''}
                {airport.elevationM != null ? ` · ${airport.elevationM} m` : ''}
              </Text>
            </Stack>
          </Group>
          <SplitButton
            label="Add channels"
            onClick={onAddChannels}
            menuItems={[{ label: 'Add as zone', onClick: onAddAsZone }]}
            loading={adding}
            disabled={selectedCount === 0}
          />
        </Group>

        {airport.frequencies.length === 0 ? (
          <Text size="sm" c="dimmed">
            No published frequencies in OpenAIP for this airport.
          </Text>
        ) : (
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              <Anchor component="button" type="button" size="sm" onClick={onSelectAllFrequencies}>
                Select all
              </Anchor>
              {' / '}
              <Anchor component="button" type="button" size="sm" onClick={onSelectNoFrequencies}>
                Select none
              </Anchor>
            </Text>
            <Stack gap={6}>
              {airport.frequencies.map((freq, index) => {
                const key = airportFrequencyKey(airport, index);
                const frequencyMhz = formatFrequencyMhz(freq.rxFrequencyHz);
                const existingChannel = existingChannelByKey.get(key);

                if (existingChannel) {
                  return (
                    <ExistingFrequencyRow
                      key={key}
                      wireLabel={freq.service}
                      channel={existingChannel}
                      frequencyMhz={frequencyMhz}
                    />
                  );
                }

                if (!isCivilAirbandHz(freq.rxFrequencyHz)) {
                  return (
                    <Text key={key} size="sm" c="dimmed">
                      {freq.service} · {frequencyMhz} (not civil airband)
                    </Text>
                  );
                }

                const proposedName = formatAirbandChannelName(airbandInput, freq.service, {
                  namePrefixKind,
                });

                return (
                  <Checkbox
                    key={key}
                    label={
                      <FrequencyImportPreview
                        wireLabel={freq.service}
                        proposedName={proposedName}
                        frequencyMhz={frequencyMhz}
                      />
                    }
                    checked={selectedKeys.has(key)}
                    onChange={(e) => onToggleFrequency(key, e.currentTarget.checked)}
                  />
                );
              })}
            </Stack>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

export default function OpenAipAirportSearch() {
  const search = useOpenAipAirportSearch();
  const { library, reload } = useLibrary();
  const { activeProjectId } = useProjects();
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [alsoCreateZone, setAlsoCreateZone] = useState(false);
  const [zoneTargetMode, setZoneTargetMode] = useState<ZoneTargetMode>('new');
  const [zoneName, setZoneName] = useState(DEFAULT_ZONE_NAME);
  const [existingZoneId, setExistingZoneId] = useState<string | null>(null);
  const [namePrefixKind, setNamePrefixKind] = useState<AirbandNamePrefixKind>('iata');
  const [adding, setAdding] = useState(false);
  const [addingAirportKey, setAddingAirportKey] = useState<string | null>(null);
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const existingChannelByKey = useMemo(
    () => buildExistingAirbandChannelIndex(search.airports, library.channels),
    [search.airports, library.channels],
  );

  const selectableFrequencyKeysAll = useMemo(
    () =>
      search.airports.flatMap((airport) => selectableFrequencyKeys(airport, existingChannelByKey)),
    [search.airports, existingChannelByKey],
  );

  useEffect(() => {
    setSelectedKeys((prev) => {
      const next = new Set([...prev].filter((key) => !existingChannelByKey.has(key)));
      return next.size === prev.size ? prev : next;
    });
  }, [existingChannelByKey]);

  const mapChannels = useMemo(() => mapChannelsFromAirports(search.airports), [search.airports]);
  const kindHint = airportQueryKindHint(search.kind);

  function toggleFrequency(key: string, checked: boolean) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleAirportFrequencies(airport: AirportListing, checked: boolean) {
    const keys = selectableFrequencyKeys(airport, existingChannelByKey);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (checked) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  function toggleAllFrequencies(checked: boolean) {
    if (!checked) {
      setSelectedKeys(new Set());
      return;
    }
    setSelectedKeys(new Set(selectableFrequencyKeysAll));
  }

  async function persistSelections(
    selections: Array<{ airport: AirportListing; frequencyIndices: number[] }>,
    options: ZoneImportOptions,
  ) {
    if (!activeProjectId || selections.length === 0) return;

    if (options.alsoCreateZone && zoneTargetMode === 'existing' && !options.targetZoneId) {
      setAddError('Choose an existing zone or switch to New zone.');
      return;
    }

    const plan = buildAirbandImportPlan(
      library,
      activeProjectId,
      selections.map(({ airport, frequencyIndices }) => ({
        airport: airportListingToAirbandInput(airport),
        frequencyIndices,
      })),
      {
        ...options,
        forbidTransmit: true,
        namePrefixKind: options.namePrefixKind ?? namePrefixKind,
      },
    );

    if (plan.zoneTargetError) {
      setAddError(plan.zoneTargetError);
      return;
    }

    for (const channel of plan.totalChannelsToAdd) {
      await persistence.putChannel(channel, null);
    }
    for (const zone of plan.zones) {
      await persistence.putZone(zone, null);
    }

    const libraryWithNewChannels = {
      ...library,
      channels: [...library.channels, ...plan.totalChannelsToAdd],
    };

    for (const update of plan.zoneUpdates) {
      const zone = library.zones.find((row) => row.id === update.zoneId);
      if (!zone) continue;
      const updated = { ...zone, members: update.members };
      const libraryForValidation = {
        ...libraryWithNewChannels,
        zones: library.zones.map((row) => (row.id === update.zoneId ? updated : row)),
      };
      validateZoneMembership(update.zoneId, update.members, libraryForValidation);
      const result = await persistence.putZone(updated, zone.revision);
      if (!result.ok) {
        throw new Error(
          result.reason === 'revision_conflict'
            ? 'Zone was changed elsewhere. Reload and try again.'
            : 'Failed to update zone.',
        );
      }
    }

    if (plan.zoneUpdates.length > 0 || plan.zones.length > 0) {
      await reload();
    }

    const added = plan.totalChannelsToAdd.length;
    const skipped = plan.totalSkipped.length;
    let zoneSuffix = '';
    if (options.alsoCreateZone && plan.zoneUpdates.length > 0) {
      const targetName =
        library.zones.find((zone) => zone.id === plan.zoneUpdates[0]?.zoneId)?.name ?? 'zone';
      zoneSuffix = ` and added to zone "${targetName}"`;
    } else if (options.alsoCreateZone && plan.zones.length > 0) {
      zoneSuffix = ` and created zone "${plan.zones[0]?.name ?? options.zoneName ?? DEFAULT_ZONE_NAME}"`;
    }

    const skippedSuffix = skipped ? ` (${skipped} skipped as duplicates)` : '';
    if (added > 0 || zoneSuffix) {
      setAddMessage(
        added > 0
          ? `Added ${added} channel${added === 1 ? '' : 's'}${zoneSuffix}${skippedSuffix}.`
          : `No new channels were added${zoneSuffix}${skippedSuffix}.`,
      );
    } else {
      setAddMessage('No new channels were added.');
    }
    setAddError(null);

    const importedKeys = new Set(
      selections.flatMap(({ airport, frequencyIndices }) =>
        frequencyIndices.map((index) => airportFrequencyKey(airport, index)),
      ),
    );
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const key of importedKeys) next.delete(key);
      return next;
    });
  }

  async function handleAddSelections(
    selections: Array<{ airport: AirportListing; frequencyIndices: number[] }>,
    options: ZoneImportOptions,
    airportKeyForLoading?: string,
  ) {
    if (selections.length === 0) return;
    setAdding(true);
    if (airportKeyForLoading) setAddingAirportKey(airportKeyForLoading);
    setAddMessage(null);
    setAddError(null);
    try {
      await persistSelections(selections, options);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Import failed. Please try again.');
    } finally {
      setAdding(false);
      setAddingAirportKey(null);
    }
  }

  function zoneImportOptions(alsoCreateZoneOverride: boolean): ZoneImportOptions {
    return {
      ...buildZoneImportOptions(alsoCreateZoneOverride, zoneTargetMode, zoneName, existingZoneId),
      namePrefixKind,
    };
  }

  function selectionsForAirport(airport: AirportListing) {
    return buildSelectionsFromKeys([airport], selectedKeys);
  }

  async function handleAddSelected() {
    const selections = buildSelectionsFromKeys(search.airports, selectedKeys);
    await handleAddSelections(selections, zoneImportOptions(alsoCreateZone));
  }

  async function handleUseMyLocation(lat: number, lon: number) {
    await search.search('', { lat, lon });
  }

  const allFrequenciesSelected =
    selectableFrequencyKeysAll.length > 0 &&
    selectableFrequencyKeysAll.every((key) => selectedKeys.has(key));
  const someFrequenciesSelected =
    selectedKeys.size > 0 && selectedKeys.size < selectableFrequencyKeysAll.length;

  return (
    <FormPage
      title="Add airband from OpenAIP"
      description="Search OpenAIP for airport frequencies and import RX-only AM channels into your library."
      footer={
        <Button variant="light" component={Link} to="/library/channels">
          Back to library
        </Button>
      }
    >
      <PageSection title="Search" description="Query OpenAIP by location or airport identifier.">
        <Stack gap="sm">
          {!search.hasApiKey ? (
            <Alert color="yellow">
              OpenAIP API key required.{' '}
              <Anchor
                component={Link}
                to="/settings"
                state={{ scrollTo: SETTINGS_OPENAIP_SECTION_ID }}
              >
                Add your key in Settings
              </Anchor>
              .
            </Alert>
          ) : null}

          <Group align="flex-end" wrap="wrap">
            <TextInput
              label="Search"
              placeholder="ICAO, IATA, airport name, locator, or town"
              value={search.query}
              onChange={(e) => search.setQuery(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void search.search();
              }}
              style={{ flex: 1, minWidth: 220 }}
            />
            <NumberInput
              label="Radius (km)"
              value={search.radiusKm}
              onChange={(value) => search.setRadiusKm(typeof value === 'number' ? value : 50)}
              min={1}
              max={500}
              style={{ width: 120 }}
            />
            <UseMyLocationButton onLocation={(lat, lon) => void handleUseMyLocation(lat, lon)} />
            <Button
              leftSection={<IconSearch size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
              onClick={() => void search.search()}
              loading={search.loading}
              disabled={!search.hasApiKey}
            >
              Search
            </Button>
          </Group>

          {kindHint && !search.error ? (
            <Text size="sm" c="dimmed">
              {kindHint}
            </Text>
          ) : null}

          {search.error ? <Alert color="red">{search.error}</Alert> : null}
          {addError ? <Alert color="red">{addError}</Alert> : null}
          {addMessage ? <Alert color="green">{addMessage}</Alert> : null}
        </Stack>
      </PageSection>

      {search.airports.length > 0 ? (
        <PageSection title="Results">
          <Stack gap="md">
            {mapChannels.length > 0 ? (
              <CodeplugMap
                channels={mapChannels}
                zones={[]}
                allChannels={mapChannels}
                height={360}
              />
            ) : (
              <Text size="sm" c="dimmed">
                No geolocated airports to plot on the map.
              </Text>
            )}

            <Group justify="space-between" align="flex-end" wrap="wrap">
              <Checkbox
                label="Select all"
                checked={allFrequenciesSelected}
                indeterminate={someFrequenciesSelected}
                onChange={(e) => toggleAllFrequencies(e.currentTarget.checked)}
              />
              <Group align="flex-end" wrap="wrap">
                <Select
                  label="Name prefix"
                  data={NAME_PREFIX_OPTIONS}
                  value={namePrefixKind}
                  onChange={(value) =>
                    setNamePrefixKind((value as AirbandNamePrefixKind | null) ?? 'iata')
                  }
                  style={{ width: 150 }}
                />
                <Checkbox
                  label="Add to zone"
                  checked={alsoCreateZone}
                  onChange={(e) => setAlsoCreateZone(e.currentTarget.checked)}
                />
                {alsoCreateZone ? (
                  <Stack gap="xs" maw={280}>
                    <SegmentedControl
                      value={zoneTargetMode}
                      onChange={(value) => setZoneTargetMode(value as ZoneTargetMode)}
                      data={[
                        { label: 'New zone', value: 'new' },
                        {
                          label: 'Existing zone',
                          value: 'existing',
                          disabled: library.zones.length === 0,
                        },
                      ]}
                    />
                    {zoneTargetMode === 'new' ? (
                      <TextInput
                        label="Zone name"
                        value={zoneName}
                        onChange={(e) => setZoneName(e.currentTarget.value)}
                        placeholder={DEFAULT_ZONE_NAME}
                      />
                    ) : (
                      <Stack gap={4}>
                        <ZoneSelect
                          label="Zone"
                          zones={library.zones}
                          value={existingZoneId}
                          onChange={setExistingZoneId}
                        />
                        {library.zones.length === 0 ? (
                          <Text size="xs" c="dimmed">
                            No zones in this project.{' '}
                            <Anchor component={Link} to="/library/zones" size="xs">
                              Create a zone
                            </Anchor>{' '}
                            first.
                          </Text>
                        ) : null}
                      </Stack>
                    )}
                  </Stack>
                ) : null}
                <Button
                  disabled={selectedKeys.size === 0}
                  loading={adding && addingAirportKey == null}
                  onClick={() => void handleAddSelected()}
                >
                  Add selected ({selectedKeys.size})
                </Button>
              </Group>
            </Group>

            <ScrollArea.Autosize mah={720}>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                {search.airports.map((airport) => {
                  const key = airportListingKey(airport);
                  const airportSelections = selectionsForAirport(airport);
                  return (
                    <AirportCard
                      key={key}
                      airport={airport}
                      referencePoint={search.referencePoint}
                      selectedKeys={selectedKeys}
                      existingChannelByKey={existingChannelByKey}
                      namePrefixKind={namePrefixKind}
                      onToggleFrequency={toggleFrequency}
                      onToggleAirport={(checked) => toggleAirportFrequencies(airport, checked)}
                      onSelectAllFrequencies={() => toggleAirportFrequencies(airport, true)}
                      onSelectNoFrequencies={() => toggleAirportFrequencies(airport, false)}
                      onAddChannels={() => void handleAddSelections(airportSelections, {}, key)}
                      onAddAsZone={() =>
                        void handleAddSelections(airportSelections, zoneImportOptions(true), key)
                      }
                      adding={adding && addingAirportKey === key}
                    />
                  );
                })}
              </SimpleGrid>
            </ScrollArea.Autosize>
          </Stack>
        </PageSection>
      ) : null}

      <Text size="xs" c="dimmed" mt="md">
        Airport data ©{' '}
        <Anchor href="https://www.openaip.net/" target="_blank" rel="noreferrer">
          OpenAIP
        </Anchor>{' '}
        contributors. Frequencies may change with AIP amendments — RX monitoring only; not
        authoritative for aviation operations.{' '}
        <Anchor component={Link} to="/attributions" size="xs">
          Attributions
        </Anchor>
      </Text>
    </FormPage>
  );
}
