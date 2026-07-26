import {
  Autocomplete,
  Button,
  Group,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addChannelsToZoneMembers } from '@core/domain/zoneMembership.ts';
import {
  rankChannelsByDistance,
  resolveZoneMemberGeolocatedPoints,
  suggestChannelsInsideHull,
  zoneCentreFromPoints,
  type GeoCentre,
} from '@core/domain/growZone.ts';
import { coordsToLocator, isValidLocator, locatorToCoords } from '@core/domain/maidenhead.ts';
import { formatDistanceM } from '@core/domain/geoDistance.ts';
import { channelHasGeolocation } from '@core/domain/mapProjection.ts';
import { resolveEffectiveZoneChannelIds } from '@core/domain/zoneHierarchy.ts';
import type { Channel } from '@core/models/library.ts';
import { GeocodeError, geocodeQuery, type GeocodeProvider } from '@integrations/geocode/index.ts';
import CodeplugMap from '../CodeplugMap/CodeplugMap.tsx';
import ModePill from '../pills/ModePill.tsx';
import UseMyLocationButton from '../UseMyLocationButton/UseMyLocationButton.tsx';
import { DataTable, FormSection } from '../ui/index.ts';
import type { DataTableColumn } from '../ui/DataTable.tsx';
import { useMapSettings } from '../../hooks/useMapSettings.ts';
import { channelModesForFilter } from '../../lib/channels.ts';
import {
  channelHasLocation,
  filterChannelOptions,
  resolveChannelOptionId,
} from '../../lib/channelLookup.ts';
import { useZoneEdit } from '../../routes/library/zones/ZoneEditContext.tsx';
import ZoneEditHeader from '../../routes/library/zones/ZoneEditHeader.tsx';
import ZoneMemberEditor from './ZoneMemberEditor.tsx';

const GEOCODE_PROVIDER_OPTIONS: { value: GeocodeProvider; label: string }[] = [
  { value: 'mapbox', label: 'Mapbox' },
  { value: 'photon', label: 'Photon (OSM)' },
];

const CHANNEL_SEARCH_DEBOUNCE_MS = 500;

type SuggestionMode = 'insideHull' | 'nearLocator';

export default function GrowZoneRecommendations() {
  const { entity, library, members, setMembers, previewZone, setMapFilters } = useZoneEdit();
  const { mapboxToken } = useMapSettings();

  const [mode, setMode] = useState<SuggestionMode>('insideHull');
  const [centre, setCentre] = useState<GeoCentre | null>(null);
  const [centreInitialised, setCentreInitialised] = useState(false);
  const [locator, setLocator] = useState('');
  const [locatorError, setLocatorError] = useState<string | null>(null);
  const [addressQuery, setAddressQuery] = useState('');
  const [geocodeProvider, setGeocodeProvider] = useState<GeocodeProvider>(
    mapboxToken.trim() ? 'mapbox' : 'photon',
  );
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [channelSearch, setChannelSearch] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [debouncedChannelSearch] = useDebouncedValue(channelSearch, CHANNEL_SEARCH_DEBOUNCE_MS);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);

  const memberPoints = useMemo(
    () => resolveZoneMemberGeolocatedPoints(previewZone, library.zones, library.channels),
    [previewZone, library.zones, library.channels],
  );

  const excludeIds = useMemo(() => {
    return new Set(resolveEffectiveZoneChannelIds(previewZone, library.zones));
  }, [previewZone, library.zones]);

  const defaultCentre = useMemo(() => zoneCentreFromPoints(memberPoints), [memberPoints]);

  useEffect(() => {
    if (centreInitialised || !defaultCentre) return;
    setCentre(defaultCentre);
    setLocator(coordsToLocator(defaultCentre.lat, defaultCentre.lon, 6));
    setCentreInitialised(true);
  }, [centreInitialised, defaultCentre]);

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

  const suggestions = useMemo(() => {
    if (mode === 'insideHull') {
      return suggestChannelsInsideHull(library.channels, excludeIds, memberPoints);
    }
    if (!centre) {
      return { channelIds: [], distancesM: new Map<string, number>() };
    }
    return rankChannelsByDistance(library.channels, excludeIds, centre);
  }, [mode, library.channels, excludeIds, memberPoints, centre]);

  const suggestionRows = useMemo(() => {
    return suggestions.channelIds
      .map((id) => channelById.get(id))
      .filter((ch): ch is Channel => ch != null);
  }, [suggestions.channelIds, channelById]);

  const applyCentre = useCallback((lat: number, lon: number) => {
    setCentre({ lat, lon });
    setLocator(coordsToLocator(lat, lon, 6));
    setLocatorError(null);
    setMode('nearLocator');
  }, []);

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
    setMode('nearLocator');
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
      applyCentre(result.lat, result.lon);
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
    applyCentre(selectedChannel.location.lat, selectedChannel.location.lon);
  };

  const dimmedChannelIds = useMemo(() => {
    const visible = new Set([...excludeIds, ...suggestions.channelIds]);
    return geolocatedChannels.filter((ch) => !visible.has(ch.id)).map((ch) => ch.id);
  }, [geolocatedChannels, excludeIds, suggestions.channelIds]);

  const handleAddSelected = () => {
    if (!selectedSuggestionIds.length) return;
    setMembers(addChannelsToZoneMembers(members, selectedSuggestionIds));
    setSelectedSuggestionIds([]);
  };

  const tableColumns = useMemo((): DataTableColumn<Channel>[] => {
    const cols: DataTableColumn<Channel>[] = [];
    if (mode === 'nearLocator') {
      cols.push({
        key: 'distance',
        header: 'Distance',
        render: (ch) => {
          const metres = suggestions.distancesM.get(ch.id);
          return metres != null ? formatDistanceM(metres) : '—';
        },
        sortValue: (ch) => suggestions.distancesM.get(ch.id) ?? Number.POSITIVE_INFINITY,
      });
    }
    cols.push({
      key: 'callsign',
      header: 'Callsign',
      render: (ch) => ch.callsign || '—',
      sortValue: (ch) => ch.callsign || '',
    });
    cols.push({
      key: 'mode',
      header: 'Mode',
      render: (ch) => (
        <Group gap={4}>
          {channelModesForFilter(ch).map((m) => (
            <ModePill key={m} mode={m} />
          ))}
        </Group>
      ),
    });
    return cols;
  }, [mode, suggestions.distancesM]);

  const hullUnavailable =
    mode === 'insideHull' && (memberPoints.length === 0 || memberPoints.length === 2);

  return (
    <Stack gap="md">
      <ZoneEditHeader
        subtitle="Recommend channels inside the zone hull or near a locator."
        backTo={`/library/zones/${entity.id}`}
        backLabel="← Back to zone"
      />

      <FormSection title="Members">
        <ZoneMemberEditor
          channels={library.channels}
          zones={library.zones}
          editingZoneId={entity.id}
          members={members}
          onChange={setMembers}
          onMapFiltersChange={setMapFilters}
          mode="summary"
        />
      </FormSection>

      <FormSection
        title="Recommendations to add"
        description="Select channels to append to zone membership. Suggestions are a snapshot — they do not update automatically when channels move."
      >
        <Stack gap="sm">
          <SegmentedControl
            value={mode}
            onChange={(value) => setMode(value as SuggestionMode)}
            data={[
              { value: 'insideHull', label: 'Inside hull' },
              { value: 'nearLocator', label: 'Near locator' },
            ]}
          />
          {hullUnavailable ? (
            <Text size="sm" c="dimmed">
              {memberPoints.length === 0
                ? 'Add geolocated members to enable inside-hull suggestions.'
                : 'Inside-hull needs at least three member sites (two sites draw a line with no area). Use Near locator instead.'}
            </Text>
          ) : null}
          <DataTable
            variant="list"
            rows={suggestionRows}
            rowKey={(ch) => ch.id}
            nameColumn={{
              getName: (ch) => ch.name,
              getPath: (ch) => `/library/channels/${ch.id}`,
            }}
            columns={tableColumns}
            showSearch={false}
            selectable
            selectedKeys={selectedSuggestionIds}
            onSelectedKeysChange={setSelectedSuggestionIds}
            emptyState={
              <Text size="sm" c="dimmed">
                {mode === 'insideHull'
                  ? 'No channels inside the zone hull'
                  : 'No geolocated channels to rank — set a locator first'}
              </Text>
            }
          />
          <Group>
            <Button
              type="button"
              disabled={!selectedSuggestionIds.length}
              onClick={handleAddSelected}
            >
              Add selected to zone
            </Button>
            <Text size="sm" c="dimmed">
              {suggestionRows.length} suggestion{suggestionRows.length === 1 ? '' : 's'}
            </Text>
          </Group>
        </Stack>
      </FormSection>

      <FormSection
        title="Search criteria"
        description={
          <>
            Default locator is the zone centre from member coordinates.{' '}
            <Text component={Link} to="/reference/maidenhead" size="sm" inherit>
              Maidenhead reference
            </Text>
          </>
        }
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
            <Button
              type="button"
              variant="subtle"
              size="compact-sm"
              disabled={!defaultCentre}
              onClick={() => {
                if (!defaultCentre) return;
                applyCentre(defaultCentre.lat, defaultCentre.lon);
              }}
            >
              Reset to zone centre
            </Button>
          </Stack>

          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              Search by city or postcode, pick a channel, or click the map.
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
            <Autocomplete
              label="Channel location"
              placeholder="Search channels with coordinates…"
              value={channelSearch}
              onChange={handleChannelSearchChange}
              data={channelOptions}
              limit={20}
            />
            <Button
              type="button"
              variant="light"
              disabled={!selectedChannel}
              onClick={handleApplyChannelLocation}
            >
              Use channel location
            </Button>
          </Stack>
        </SimpleGrid>
      </FormSection>

      <FormSection title="Map">
        <CodeplugMap
          channels={library.channels}
          zones={library.zones}
          allChannels={library.channels}
          height={360}
          mapControlMode="zoneEmphasis"
          emphasisZoneId={entity.id}
          referencePosition={centre}
          dimmedChannelIds={dimmedChannelIds}
          onMapClick={(lat, lon) => applyCentre(lat, lon)}
        />
      </FormSection>
    </Stack>
  );
}
