import {
  Autocomplete,
  Button,
  Group,
  Loader,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useCallback, useMemo, useState } from 'react';
import MapLocationPicker from '../../components/MapLocationPicker/MapLocationPicker.tsx';
import UseMyLocationButton from '../../components/UseMyLocationButton/UseMyLocationButton.tsx';
import { FormSection, ListPage, PageSection } from '../../components/ui/index.ts';
import { useMapSettings } from '../../hooks/useMapSettings.ts';
import {
  channelHasLocation,
  channelOptionLabel,
  filterChannelOptions,
  resolveChannelOptionId,
} from '../../lib/channelLookup.ts';
import {
  coordsToLocator,
  isValidLocator,
  locatorToCoords,
  type LocatorPrecision,
} from '@core/domain/maidenhead.ts';
import { GeocodeError, geocodeQuery, type GeocodeProvider } from '@integrations/geocode/index.ts';
import { useProjects } from '../../state/useProjects.ts';
import { useLibrary } from '../../state/useLibrary.ts';

const PRECISION_OPTIONS: { value: string; label: string }[] = [
  { value: '4', label: '4 (field)' },
  { value: '6', label: '6 (square)' },
  { value: '8', label: '8 (subsquare)' },
  { value: '10', label: '10 (cell)' },
];

const GEOCODE_PROVIDER_OPTIONS: { value: GeocodeProvider; label: string }[] = [
  { value: 'mapbox', label: 'Mapbox' },
  { value: 'photon', label: 'Photon (OSM)' },
];

const CHANNEL_SEARCH_DEBOUNCE_MS = 500;

function parseCoord(value: string | number): number | null {
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

export default function MaidenheadReferencePage() {
  const { activeProjectId } = useProjects();
  const { library } = useLibrary();
  const { mapboxToken } = useMapSettings();
  const [locator, setLocator] = useState('');
  const [lat, setLat] = useState<string | number>('');
  const [lon, setLon] = useState<string | number>('');
  const [precision, setPrecision] = useState<LocatorPrecision>(6);
  const [addressQuery, setAddressQuery] = useState('');
  const [geocodeProvider, setGeocodeProvider] = useState<GeocodeProvider>(
    mapboxToken.trim() ? 'mapbox' : 'photon',
  );
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [geocodeLabel, setGeocodeLabel] = useState<string | null>(null);
  const [channelSearch, setChannelSearch] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [debouncedChannelSearch] = useDebouncedValue(channelSearch, CHANNEL_SEARCH_DEBOUNCE_MS);

  const channels = useMemo(
    () => (activeProjectId ? library.channels : []),
    [activeProjectId, library.channels],
  );
  const channelById = useMemo(() => new Map(channels.map((ch) => [ch.id, ch])), [channels]);
  const selectedChannel = selectedChannelId ? channelById.get(selectedChannelId) : undefined;
  const selectedChannelHasLocation = selectedChannel ? channelHasLocation(selectedChannel) : false;
  const channelOptionsLoading =
    channelSearch.trim().length > 0 && channelSearch !== debouncedChannelSearch;
  const channelOptions = useMemo(() => {
    if (!debouncedChannelSearch.trim()) return [];
    return filterChannelOptions(channels, debouncedChannelSearch);
  }, [debouncedChannelSearch, channels]);

  const hasMapboxToken = mapboxToken.trim().length > 0;
  const hasActiveProject = activeProjectId != null;

  const locatorError = useMemo(() => {
    if (!locator.trim()) return null;
    if (!isValidLocator(locator)) return 'Invalid Maidenhead locator (4, 6, 8, or 10 characters)';
    return null;
  }, [locator]);

  const mapLat = parseCoord(lat);
  const mapLon = parseCoord(lon);

  const applyCoords = useCallback(
    (latN: number, lonN: number, locatorPrecision: LocatorPrecision = precision) => {
      setLat(latN);
      setLon(lonN);
      setLocator(coordsToLocator(latN, lonN, locatorPrecision));
    },
    [precision],
  );

  const handleLocatorChange = (value: string) => {
    setLocator(value);
    if (!value.trim()) return;
    if (!isValidLocator(value)) return;
    const coords = locatorToCoords(value);
    if (coords) {
      applyCoords(coords.lat, coords.lon, precision);
      setLocator(value.trim().toUpperCase().replace(/\s/g, ''));
    }
  };

  const handleLatChange = (value: string | number) => {
    setLat(value);
    const latN = parseCoord(value);
    const lonN = parseCoord(lon);
    if (latN != null && lonN != null) {
      applyCoords(latN, lonN);
    }
  };

  const handleLonChange = (value: string | number) => {
    setLon(value);
    const latN = parseCoord(lat);
    const lonN = parseCoord(value);
    if (latN != null && lonN != null) {
      applyCoords(latN, lonN);
    }
  };

  const handlePrecisionChange = (value: string) => {
    const p = Number(value) as LocatorPrecision;
    setPrecision(p);
    const latN = parseCoord(lat);
    const lonN = parseCoord(lon);
    if (latN != null && lonN != null) {
      setLocator(coordsToLocator(latN, lonN, p));
    }
  };

  const handleMapPick = (latN: number, lonN: number) => {
    applyCoords(latN, lonN);
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
      applyCoords(result.lat, result.lon);
      setGeocodeLabel(result.label);
    } catch (err) {
      setGeocodeError(err instanceof GeocodeError ? err.message : 'Geocoding failed');
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
    const { lat: latN, lon: lonN } = selectedChannel.location;
    applyCoords(latN, lonN);
  };

  return (
    <ListPage
      title="Maidenhead converter"
      description="Convert between Maidenhead grid locators and WGS84 coordinates. Updates live as you type."
    >
      <PageSection title="Converter">
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <FormSection title="Locator">
              <TextInput
                label="Maidenhead locator"
                placeholder="e.g. IO85uk"
                value={locator}
                onChange={(e) => handleLocatorChange(e.currentTarget.value)}
                error={locatorError}
              />
              <SegmentedControl
                value={String(precision)}
                onChange={handlePrecisionChange}
                data={PRECISION_OPTIONS}
              />
            </FormSection>

            <FormSection title="Coordinates">
              <Group grow>
                <NumberInput
                  label="Latitude"
                  value={lat}
                  onChange={handleLatChange}
                  decimalScale={6}
                  min={-90}
                  max={90}
                />
                <NumberInput
                  label="Longitude"
                  value={lon}
                  onChange={handleLonChange}
                  decimalScale={6}
                  min={-180}
                  max={180}
                />
              </Group>
              <UseMyLocationButton onLocation={(latN, lonN) => applyCoords(latN, lonN)} />
            </FormSection>
          </SimpleGrid>

          <Stack gap="sm">
            <Title order={4}>Map</Title>
            <Text size="sm" c="dimmed">
              Click the map or drag the marker to set coordinates.
            </Text>
            <MapLocationPicker lat={mapLat} lon={mapLon} onPick={handleMapPick} />
          </Stack>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <Stack gap="sm">
              <Title order={4}>Address lookup</Title>
              <Text size="sm" c="dimmed">
                {hasMapboxToken
                  ? 'Geocode an address or postcode. Choose Mapbox or Photon (OpenStreetMap).'
                  : 'Using Photon (OpenStreetMap). Set a Mapbox token in Settings for Mapbox geocoding.'}
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
              <Title order={4}>Channel lookup</Title>
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
                  comboboxProps={{ zIndex: 1000 }}
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
          </SimpleGrid>
        </Stack>
      </PageSection>
    </ListPage>
  );
}
