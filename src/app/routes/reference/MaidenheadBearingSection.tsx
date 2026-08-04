import {
  Accordion,
  Autocomplete,
  Button,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useCallback, useMemo, useState } from 'react';
import type { Channel } from '@core/models/library.ts';
import {
  compassOctant,
  formatDistanceKmAndMi,
  pathMetricsBetween,
} from '@core/domain/geoDistance.ts';
import { coordsToLocator, isValidLocator, locatorToCoords } from '@core/domain/maidenhead.ts';
import { GeocodeError, geocodeQuery, type GeocodeProvider } from '@integrations/geocode/index.ts';
import MapPairPlot, { type MapPairPickTarget } from '../../components/MapPairPlot/MapPairPlot.tsx';
import { DesignSystemV2Provider, MapPanel } from '../../components/v2/index.ts';
import { mapComboboxProps } from '../../theme.ts';
import UseMyLocationButton from '../../components/UseMyLocationButton/UseMyLocationButton.tsx';
import { FormSection } from '../../components/ui/index.ts';
import {
  channelHasLocation,
  channelOptionLabel,
  filterChannelOptions,
  resolveChannelOptionId,
} from '../../lib/channelLookup.ts';

const GEOCODE_PROVIDER_OPTIONS: { value: GeocodeProvider; label: string }[] = [
  { value: 'mapbox', label: 'Mapbox' },
  { value: 'photon', label: 'Photon (OSM)' },
];

const PICK_TARGET_OPTIONS: { value: MapPairPickTarget; label: string }[] = [
  { value: 'from', label: 'From' },
  { value: 'to', label: 'To' },
];

const MORE_TARGET_OPTIONS: { value: MapPairPickTarget; label: string }[] = [
  { value: 'from', label: 'From' },
  { value: 'to', label: 'To' },
];

const CHANNEL_SEARCH_DEBOUNCE_MS = 500;
const BEARING_LOCATOR_PRECISION = 6;

function formatBearing(bearingDeg: number): string {
  const rounded = Math.round(bearingDeg);
  const padded = rounded.toString().padStart(3, '0');
  return `${padded}°T · ${compassOctant(bearingDeg)}`;
}

function formatCoord(lat: number, lon: number): string {
  return `${lat.toFixed(5)}°, ${lon.toFixed(5)}°`;
}

function formatDelta(degrees: number): string {
  const sign = degrees >= 0 ? '+' : '';
  return `${sign}${degrees.toFixed(5)}°`;
}

export interface MaidenheadBearingSectionProps {
  channels: Channel[];
  hasActiveProject: boolean;
  mapboxToken: string;
  hasMapboxToken: boolean;
  mapActive: boolean;
}

export default function MaidenheadBearingSection({
  channels,
  hasActiveProject,
  mapboxToken,
  hasMapboxToken,
  mapActive,
}: MaidenheadBearingSectionProps) {
  const [fromLocator, setFromLocator] = useState('');
  const [toLocator, setToLocator] = useState('');
  const [pickTarget, setPickTarget] = useState<MapPairPickTarget>('from');
  const [moreTarget, setMoreTarget] = useState<MapPairPickTarget>('to');
  const [addressQuery, setAddressQuery] = useState('');
  const [geocodeProvider, setGeocodeProvider] = useState<GeocodeProvider>(
    hasMapboxToken ? 'mapbox' : 'photon',
  );
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [geocodeLabel, setGeocodeLabel] = useState<string | null>(null);
  const [channelSearch, setChannelSearch] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [debouncedChannelSearch] = useDebouncedValue(channelSearch, CHANNEL_SEARCH_DEBOUNCE_MS);

  const channelById = useMemo(() => new Map(channels.map((ch) => [ch.id, ch])), [channels]);
  const selectedChannel = selectedChannelId ? channelById.get(selectedChannelId) : undefined;
  const selectedChannelHasLocation = selectedChannel ? channelHasLocation(selectedChannel) : false;
  const channelOptionsLoading =
    channelSearch.trim().length > 0 && channelSearch !== debouncedChannelSearch;
  const channelOptions = useMemo(() => {
    if (!debouncedChannelSearch.trim()) return [];
    return filterChannelOptions(channels, debouncedChannelSearch);
  }, [debouncedChannelSearch, channels]);

  const fromError = useMemo(() => {
    if (!fromLocator.trim()) return null;
    if (!isValidLocator(fromLocator)) {
      return 'Enter a valid locator (4, 6, 8, or 10 characters)';
    }
    return null;
  }, [fromLocator]);

  const toError = useMemo(() => {
    if (!toLocator.trim()) return null;
    if (!isValidLocator(toLocator)) {
      return 'Enter a valid locator (4, 6, 8, or 10 characters)';
    }
    return null;
  }, [toLocator]);

  const fromCoords = useMemo(() => {
    if (!fromLocator.trim() || !isValidLocator(fromLocator)) return null;
    return locatorToCoords(fromLocator);
  }, [fromLocator]);

  const toCoords = useMemo(() => {
    if (!toLocator.trim() || !isValidLocator(toLocator)) return null;
    return locatorToCoords(toLocator);
  }, [toLocator]);

  const metrics = useMemo(() => {
    if (!fromCoords || !toCoords) return null;
    return pathMetricsBetween(fromCoords, toCoords);
  }, [fromCoords, toCoords]);

  const applyCoords = useCallback((side: MapPairPickTarget, lat: number, lon: number) => {
    const locator = coordsToLocator(lat, lon, BEARING_LOCATOR_PRECISION);
    if (side === 'from') {
      setFromLocator(locator);
    } else {
      setToLocator(locator);
    }
  }, []);

  const handleLocatorChange = (side: MapPairPickTarget, value: string) => {
    if (side === 'from') {
      setFromLocator(value);
    } else {
      setToLocator(value);
    }
    if (!value.trim() || !isValidLocator(value)) return;
    const coords = locatorToCoords(value);
    if (!coords) return;
    const normalised = value.trim().toUpperCase().replace(/\s/g, '');
    if (side === 'from') {
      setFromLocator(normalised);
    } else {
      setToLocator(normalised);
    }
  };

  const handleMapPick = (lat: number, lon: number) => {
    applyCoords(pickTarget, lat, lon);
  };

  const handleGeocode = async () => {
    setGeocodeError(null);
    setGeocodeLabel(null);
    setGeocodeLoading(true);
    try {
      const result = await geocodeQuery(addressQuery, {
        mapboxToken,
        provider: geocodeProvider,
      });
      if (!result) {
        setGeocodeError('No results found');
        return;
      }
      applyCoords(moreTarget, result.lat, result.lon);
      setGeocodeLabel(result.label);
    } catch (err) {
      setGeocodeError(err instanceof GeocodeError ? err.message : 'Look-up failed');
    } finally {
      setGeocodeLoading(false);
    }
  };

  const handleChannelSearchChange = (value: string) => {
    setChannelSearch(value);
    const channelId = resolveChannelOptionId(value, channelOptions, channels);
    setSelectedChannelId(channelId);
  };

  const handleChannelOptionSubmit = (value: string) => {
    const channelId = resolveChannelOptionId(value, channelOptions, channels) ?? value;
    setSelectedChannelId(channelId);
    const ch = channelById.get(channelId);
    if (ch) setChannelSearch(channelOptionLabel(ch));
  };

  const handleApplyChannelLocation = () => {
    if (!selectedChannel?.location || !channelHasLocation(selectedChannel)) return;
    const { lat, lon } = selectedChannel.location;
    applyCoords(moreTarget, lat, lon);
  };

  return (
    <Stack gap="lg">
      {metrics && fromCoords && toCoords ? (
        <Stack gap={4} align="center" py="sm">
          <Text size="2rem" fw={700} ff="monospace" lh={1.2}>
            {formatBearing(metrics.bearingAB)}
          </Text>
          <Text size="lg" c="dimmed">
            {formatDistanceKmAndMi(metrics.distanceM)}
          </Text>
          <Text size="xs" c="dimmed" ta="center" maw={360}>
            From → To. Uses the centre of each locator square — coarser grids are less precise.
          </Text>
        </Stack>
      ) : (
        <Text size="sm" c="dimmed" ta="center">
          Enter <strong>From</strong> and <strong>To</strong> to see distance and bearing.
        </Text>
      )}

      <FormSection title="From">
        <Stack gap="sm">
          <TextInput
            label="Locator"
            placeholder="e.g. IO85uk"
            value={fromLocator}
            onChange={(e) => handleLocatorChange('from', e.currentTarget.value)}
            error={fromError}
          />
          <UseMyLocationButton onLocation={(lat, lon) => applyCoords('from', lat, lon)} />
        </Stack>
      </FormSection>

      <FormSection title="To">
        <TextInput
          label="Locator"
          placeholder="e.g. JO22ab"
          value={toLocator}
          onChange={(e) => handleLocatorChange('to', e.currentTarget.value)}
          error={toError}
        />
      </FormSection>

      {metrics && fromCoords && toCoords ? (
        <Stack gap="xs">
          <Title order={5}>Details</Title>
          <Table striped withTableBorder withColumnBorders layout="fixed">
            <Table.Tbody>
              <Table.Tr>
                <Table.Td fw={500}>From</Table.Td>
                <Table.Td>{fromLocator.toUpperCase()}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>To</Table.Td>
                <Table.Td>{toLocator.toUpperCase()}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>From coordinates</Table.Td>
                <Table.Td>{formatCoord(fromCoords.lat, fromCoords.lon)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>To coordinates</Table.Td>
                <Table.Td>{formatCoord(toCoords.lat, toCoords.lon)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>Distance</Table.Td>
                <Table.Td>{formatDistanceKmAndMi(metrics.distanceM)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>Bearing From → To</Table.Td>
                <Table.Td>{formatBearing(metrics.bearingAB)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>Bearing To → From</Table.Td>
                <Table.Td>{formatBearing(metrics.bearingBA)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>Δ latitude</Table.Td>
                <Table.Td>{formatDelta(toCoords.lat - fromCoords.lat)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>Δ longitude</Table.Td>
                <Table.Td>{formatDelta(toCoords.lon - fromCoords.lon)}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Stack>
      ) : null}

      <Stack gap="sm">
        <Title order={5}>Map</Title>
        <Group gap="xs" wrap="wrap" align="center">
          <Text size="sm" c="dimmed">
            Set on map:
          </Text>
          <SegmentedControl
            size="xs"
            value={pickTarget}
            onChange={(value) => setPickTarget(value as MapPairPickTarget)}
            data={PICK_TARGET_OPTIONS}
          />
        </Group>
        <Text size="sm" c="dimmed">
          Tap the map to set <strong>{pickTarget === 'from' ? 'From' : 'To'}</strong>.
        </Text>
        <DesignSystemV2Provider>
          <MapPanel title="Map" height={200}>
            <MapPairPlot
              pointFrom={fromCoords}
              pointTo={toCoords}
              pickTarget={pickTarget}
              onPick={handleMapPick}
              height="100%"
              active={mapActive}
            />
          </MapPanel>
        </DesignSystemV2Provider>
      </Stack>

      <Accordion variant="separated">
        <Accordion.Item value="more">
          <Accordion.Control>More ways to set</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <SegmentedControl
                value={moreTarget}
                onChange={(value) => setMoreTarget(value as MapPairPickTarget)}
                data={MORE_TARGET_OPTIONS}
                aria-label="Apply to"
              />
              <Text size="sm" c="dimmed">
                Look up an address or pick a channel location for{' '}
                <strong>{moreTarget === 'from' ? 'From' : 'To'}</strong>.
              </Text>

              <Stack gap="sm">
                <Title order={6}>Address look-up</Title>
                <Text size="sm" c="dimmed">
                  {hasMapboxToken
                    ? 'Enter an address or postcode. Choose Mapbox or Photon (OpenStreetMap).'
                    : 'Using Photon (OpenStreetMap). Set a Mapbox token in Settings for Mapbox.'}
                </Text>
                <SegmentedControl
                  value={geocodeProvider}
                  onChange={(value) => setGeocodeProvider(value as GeocodeProvider)}
                  data={GEOCODE_PROVIDER_OPTIONS}
                />
                <Group align="flex-end" grow>
                  <TextInput
                    label="Address or postcode"
                    placeholder="e.g. G1 1XQ, Glasgow"
                    value={addressQuery}
                    onChange={(e) => setAddressQuery(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleGeocode();
                      }
                    }}
                  />
                  <Button
                    onClick={() => void handleGeocode()}
                    loading={geocodeLoading}
                    style={{ flexShrink: 0 }}
                  >
                    Look up
                  </Button>
                </Group>
                {geocodeError ? (
                  <Text size="sm" c="red">
                    {geocodeError}
                  </Text>
                ) : null}
                {geocodeLabel ? (
                  <Text size="sm" c="dimmed">
                    {geocodeLabel}
                  </Text>
                ) : null}
              </Stack>

              <Stack gap="sm">
                <Title order={6}>Channel look-up</Title>
                <Text size="sm" c="dimmed">
                  {hasActiveProject
                    ? 'Search the active project library by channel name or callsign.'
                    : 'Open or create a project to search library channels.'}
                </Text>
                <Group align="flex-end" grow>
                  <Autocomplete
                    label="Channel"
                    placeholder="Name or callsign"
                    value={channelSearch}
                    onChange={handleChannelSearchChange}
                    onOptionSubmit={handleChannelOptionSubmit}
                    data={channelOptions}
                    disabled={!hasActiveProject}
                    rightSection={channelOptionsLoading ? <Loader size={18} /> : null}
                    filter={({ options }) => options}
                    comboboxProps={mapComboboxProps()}
                  />
                  <Button
                    onClick={handleApplyChannelLocation}
                    disabled={!hasActiveProject || !selectedChannel || !selectedChannelHasLocation}
                    style={{ flexShrink: 0 }}
                  >
                    Use location
                  </Button>
                </Group>
                {selectedChannel && !selectedChannelHasLocation ? (
                  <Text size="sm" c="dimmed">
                    This channel has no coordinates set.
                  </Text>
                ) : null}
              </Stack>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
