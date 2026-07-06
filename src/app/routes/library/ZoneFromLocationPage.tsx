import {
  Autocomplete,
  Anchor,
  Button,
  Group,
  Loader,
  SegmentedControl,
  SimpleGrid,
  Slider,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  selectChannelsWithinRadius,
  zoneMembersFromChannelIds,
} from '@core/domain/proximityZone.ts';
import { channelHasGeolocation } from '@core/domain/mapProjection.ts';
import { coordsToLocator, isValidLocator, locatorToCoords } from '@core/domain/maidenhead.ts';
import { formatDistanceM } from '@core/domain/geoDistance.ts';
import { newZone } from '@core/domain/factories.ts';
import { validateZoneMembership } from '@core/domain/validation.ts';
import type { Channel } from '@core/models/library.ts';
import { GeocodeError, geocodeQuery, type GeocodeProvider } from '@integrations/geocode/index.ts';
import CodeplugMap from '../../components/CodeplugMap/CodeplugMap.tsx';
import ModePill from '../../components/pills/ModePill.tsx';
import UseMyLocationButton from '../../components/UseMyLocationButton/UseMyLocationButton.tsx';
import { DataTable, FormPage, FormSection } from '../../components/ui/index.ts';
import type { DataTableColumn } from '../../components/ui/DataTable.tsx';
import { defaultMaxDistanceKm } from '../../hooks/channelListQueryUtils.ts';
import { useMapSettings } from '../../hooks/useMapSettings.ts';
import { channelModesForFilter } from '../../lib/channels.ts';
import { DISTANCE_FILTER_MARKS_KM } from '../../lib/channels.ts';
import {
  channelHasLocation,
  channelOptionLabel,
  filterChannelOptions,
  resolveChannelOptionId,
} from '../../lib/channelLookup.ts';
import { primaryButtonStyle, secondaryButtonStyle } from '../../components/fields/styles.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { zonePivotPath } from './zonePivotQuery.ts';

const GEOCODE_PROVIDER_OPTIONS: { value: GeocodeProvider; label: string }[] = [
  { value: 'mapbox', label: 'Mapbox' },
  { value: 'photon', label: 'Photon (OSM)' },
];

const CHANNEL_SEARCH_DEBOUNCE_MS = 500;

interface ReferenceCentre {
  lat: number;
  lon: number;
  label?: string;
}

export default function ZoneFromLocationPage() {
  const navigate = useNavigate();
  const { library, loading, projectId } = useLibrary();
  const { mapboxToken } = useMapSettings();

  const [centre, setCentre] = useState<ReferenceCentre | null>(null);
  const [locator, setLocator] = useState('');
  const [locatorError, setLocatorError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState(defaultMaxDistanceKm());
  const [zoneName, setZoneName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [addressQuery, setAddressQuery] = useState('');
  const [geocodeProvider, setGeocodeProvider] = useState<GeocodeProvider>(
    mapboxToken.trim() ? 'mapbox' : 'photon',
  );
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [channelSearch, setChannelSearch] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [debouncedChannelSearch] = useDebouncedValue(channelSearch, CHANNEL_SEARCH_DEBOUNCE_MS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMapboxToken = mapboxToken.trim().length > 0;
  const distanceMarks = DISTANCE_FILTER_MARKS_KM.map((km) => ({ value: km, label: `${km}` }));

  const geolocatedChannels = useMemo(
    () => library.channels.filter((ch) => channelHasGeolocation(ch)),
    [library.channels],
  );

  const channelById = useMemo(
    () => new Map(library.channels.map((ch) => [ch.id, ch])),
    [library.channels],
  );

  const channelOptions = useMemo(
    () => filterChannelOptions(geolocatedChannels, debouncedChannelSearch),
    [geolocatedChannels, debouncedChannelSearch],
  );

  const selectedChannel = selectedChannelId ? channelById.get(selectedChannelId) : undefined;

  const selection = useMemo(() => {
    if (!centre) {
      return { channelIds: [] as string[], distancesM: new Map<string, number>() };
    }
    return selectChannelsWithinRadius(library.channels, centre, radiusKm);
  }, [centre, radiusKm, library.channels]);

  const selectedRows = useMemo(() => {
    return selection.channelIds
      .map((id) => channelById.get(id))
      .filter((ch): ch is Channel => ch != null);
  }, [selection.channelIds, channelById]);

  const dimmedChannelIds = useMemo(() => {
    const selected = new Set(selection.channelIds);
    return geolocatedChannels.filter((ch) => !selected.has(ch.id)).map((ch) => ch.id);
  }, [geolocatedChannels, selection.channelIds]);

  const applyCentre = useCallback((lat: number, lon: number, label?: string) => {
    setCentre({ lat, lon, label });
    setLocator(coordsToLocator(lat, lon, 6));
    setLocatorError(null);
  }, []);

  const suggestedZoneName = useMemo(() => {
    if (!centre) return '';
    if (centre.label) return centre.label;
    return `Zone near ${coordsToLocator(centre.lat, centre.lon, 6)}`;
  }, [centre]);

  const resolvedZoneName = nameEdited ? zoneName : suggestedZoneName;

  const handleLocatorChange = (value: string) => {
    setLocator(value);
    const normalised = value.trim();
    if (!normalised) {
      setLocatorError(null);
      return;
    }
    if (!isValidLocator(normalised)) {
      setLocatorError('Invalid locator');
      return;
    }
    const coords = locatorToCoords(normalised);
    if (!coords) {
      setLocatorError('Invalid locator');
      return;
    }
    setLocatorError(null);
    setCentre({ lat: coords.lat, lon: coords.lon });
  };

  const handleGeocode = async () => {
    setGeocodeError(null);
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
      applyCentre(result.lat, result.lon, result.label);
    } catch (err) {
      setGeocodeError(err instanceof GeocodeError ? err.message : 'Geocoding failed');
    } finally {
      setGeocodeLoading(false);
    }
  };

  const handleChannelSearchChange = (value: string) => {
    setChannelSearch(value);
    const channelId = resolveChannelOptionId(value, channelOptions, geolocatedChannels);
    setSelectedChannelId(channelId);
  };

  const handleApplyChannelLocation = () => {
    if (!selectedChannel?.location || !channelHasLocation(selectedChannel)) return;
    applyCentre(selectedChannel.location.lat, selectedChannel.location.lon, selectedChannel.name);
  };

  const handleCreate = () => {
    if (!projectId || !centre || selection.channelIds.length === 0) return;
    const trimmedName = resolvedZoneName.trim();
    if (!trimmedName) {
      setError('Enter a zone name');
      return;
    }

    const row = newZone(projectId, trimmedName);
    row.members = zoneMembersFromChannelIds(selection.channelIds);

    try {
      validateZoneMembership(row.id, row.members, {
        ...library,
        zones: [...library.zones, row],
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid zone membership');
      return;
    }

    setSaving(true);
    void persistence
      .putZone(row, null)
      .then(() => navigate(zonePivotPath({ pivot: 'zone', zoneId: row.id })))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to create zone');
      })
      .finally(() => setSaving(false));
  };

  const tableColumns = useMemo((): DataTableColumn<Channel>[] => {
    return [
      {
        key: 'callsign',
        header: 'Callsign',
        render: (ch) => ch.callsign || '—',
        sortValue: (ch) => ch.callsign || '',
      },
      {
        key: 'distance',
        header: 'Distance',
        render: (ch) => {
          const metres = selection.distancesM.get(ch.id);
          return metres != null ? formatDistanceM(metres) : '—';
        },
        sortValue: (ch) => selection.distancesM.get(ch.id) ?? Number.POSITIVE_INFINITY,
      },
      {
        key: 'mode',
        header: 'Mode',
        render: (ch) => (
          <Group gap={4}>
            {channelModesForFilter(ch).map((mode) => (
              <ModePill key={mode} mode={mode} />
            ))}
          </Group>
        ),
      },
    ];
  }, [selection.distancesM]);

  if (loading || !projectId) {
    return (
      <FormPage title="New zone from location">
        <Loader size="sm" />
      </FormPage>
    );
  }

  const canCreate =
    centre != null && selection.channelIds.length > 0 && resolvedZoneName.trim().length > 0;

  return (
    <FormPage
      title="New zone from location"
      description={
        <Anchor component={Link} to="/library/zones" size="sm">
          ← Back to zones
        </Anchor>
      }
    >
      <Stack gap="md">
        <FormSection
          title="Reference position"
          description="Set the centre point for the proximity search. Channels without coordinates are excluded."
        >
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Stack gap="sm">
              <TextInput
                label="Maidenhead locator"
                placeholder="e.g. IO85uk"
                value={locator}
                onChange={(e) => handleLocatorChange(e.currentTarget.value)}
                error={locatorError}
              />
              <UseMyLocationButton onLocation={(lat, lon) => applyCentre(lat, lon)} />
            </Stack>

            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                {hasMapboxToken
                  ? 'Search by city or postcode (Mapbox or Photon).'
                  : 'Search by city or postcode (Photon). Add a Mapbox token in Settings for Mapbox.'}
              </Text>
              <SegmentedControl
                value={geocodeProvider}
                onChange={(value) => setGeocodeProvider(value as GeocodeProvider)}
                data={GEOCODE_PROVIDER_OPTIONS}
              />
              <Group align="flex-end" grow>
                <TextInput
                  label="City or postcode"
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
                  type="button"
                  variant="light"
                  onClick={() => void handleGeocode()}
                  loading={geocodeLoading}
                >
                  Search
                </Button>
              </Group>
              {geocodeError ? (
                <Text size="sm" c="red">
                  {geocodeError}
                </Text>
              ) : null}
            </Stack>
          </SimpleGrid>

          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Or pick a channel with location
            </Text>
            <Group align="flex-end" grow>
              <Autocomplete
                label="Channel"
                placeholder="Search channels…"
                data={channelOptions}
                value={channelSearch}
                onChange={handleChannelSearchChange}
                onOptionSubmit={(value) => {
                  const channelId =
                    resolveChannelOptionId(value, channelOptions, geolocatedChannels) ?? value;
                  setSelectedChannelId(channelId);
                  const ch = channelById.get(channelId);
                  if (ch) setChannelSearch(channelOptionLabel(ch));
                }}
                limit={25}
              />
              <Button
                type="button"
                variant="light"
                onClick={handleApplyChannelLocation}
                disabled={!selectedChannel || !channelHasLocation(selectedChannel)}
              >
                Use channel location
              </Button>
            </Group>
          </Stack>
        </FormSection>

        <FormSection title="Radius">
          <Text size="sm" c="dimmed" mb="xs">
            Include channels within {radiusKm} km of the reference centre.
          </Text>
          <Slider
            value={radiusKm}
            onChange={setRadiusKm}
            min={DISTANCE_FILTER_MARKS_KM[0]}
            max={DISTANCE_FILTER_MARKS_KM[DISTANCE_FILTER_MARKS_KM.length - 1]}
            marks={distanceMarks}
            label={(value) => `${value} km`}
          />
        </FormSection>

        <FormSection title="Map preview">
          <Text size="sm" c="dimmed" mb="xs">
            Click the map to set the reference centre. Channels outside the radius are dimmed.
          </Text>
          <CodeplugMap
            channels={library.channels}
            zones={library.zones}
            allChannels={library.channels}
            height={420}
            mapControlMode="zoneFromLocation"
            referencePosition={centre}
            referenceRadiusM={centre ? radiusKm * 1000 : null}
            dimmedChannelIds={centre ? dimmedChannelIds : []}
            provisionalZone={
              selection.channelIds.length > 0
                ? { channelIds: selection.channelIds, label: resolvedZoneName.trim() || 'New zone' }
                : null
            }
            onMapClick={(lat, lon) => applyCentre(lat, lon)}
            onChannelClick={(id) => navigate(`/library/channels/${id}`)}
            onZoneClick={(id) => navigate(zonePivotPath({ pivot: 'zone', zoneId: id }))}
          />
          {!centre ? (
            <Text size="sm" c="dimmed" mt="xs">
              Set a reference position to preview channels in range.
            </Text>
          ) : null}
        </FormSection>

        <FormSection title="Selected channels">
          <Text size="sm" c="dimmed" mb="xs">
            {centre
              ? `${selection.channelIds.length} channel${selection.channelIds.length === 1 ? '' : 's'} within ${radiusKm} km (nearest first).`
              : 'No reference position set.'}
          </Text>
          <DataTable
            variant="list"
            rows={selectedRows}
            rowKey={(ch) => ch.id}
            nameColumn={{
              getName: (ch) => ch.name,
              getPath: (ch) => `/library/channels/${ch.id}`,
            }}
            columns={tableColumns}
            showSearch={false}
            emptyState={
              <Text size="sm" c="dimmed">
                {centre
                  ? 'No geolocated channels within this radius.'
                  : 'Set a reference position first.'}
              </Text>
            }
          />
        </FormSection>

        <FormSection title="Zone name">
          <TextInput
            label="Name"
            value={resolvedZoneName}
            onChange={(e) => {
              setNameEdited(true);
              setZoneName(e.currentTarget.value);
            }}
          />
        </FormSection>

        <div>
          {error ? (
            <Text size="sm" c="red" mb="xs">
              {error}
            </Text>
          ) : null}
          <Group gap="sm">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !canCreate}
              style={primaryButtonStyle}
            >
              {saving ? 'Creating…' : 'Create zone'}
            </button>
            <Link to="/library/zones" style={secondaryButtonStyle}>
              Cancel
            </Link>
          </Group>
        </div>
      </Stack>
    </FormPage>
  );
}
