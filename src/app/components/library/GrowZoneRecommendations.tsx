import { Autocomplete, Group, TextInput } from '@mantine/core';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addChannelsToZoneMembers } from '@core/domain/zoneMembership.ts';
import {
  rankChannelsByDistance,
  resolveZoneMemberGeolocatedPoints,
  suggestChannelsInsideHull,
  zoneCentreFromPoints,
  type GeoCentre,
} from '@core/domain/growZone.ts';
import { haversineDistanceM } from '@core/domain/geoDistance.ts';
import { coordsToLocator, isValidLocator, locatorToCoords } from '@core/domain/maidenhead.ts';
import { formatDistanceM } from '@core/domain/geoDistance.ts';
import { channelHasGeolocation } from '@core/domain/mapProjection.ts';
import { resolveEffectiveZoneChannelIds } from '@core/domain/zoneHierarchy.ts';
import type { Channel } from '@core/models/library.ts';
import type { GeocodeProvider } from '@integrations/geocode/index.ts';
import CodeplugMap from '../CodeplugMap/CodeplugMap.tsx';
import GeocodeCentreField from './GeocodeCentreField.tsx';
import {
  Button,
  DataTable,
  DesignSystemV2Provider,
  EditorHeader,
  MapPanel,
  Panel,
  Pill,
  SegmentedControl,
  type DataTableColumn,
} from '../v2/index.ts';
import { type ChannelMode as UiChannelMode, getModeDefinition } from '../../lib/channelModes.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { bandFromChannel } from '../../lib/bands.ts';
import { channelModesForFilter } from '../../lib/channels.ts';
import {
  channelHasLocation,
  filterChannelOptions,
  resolveChannelOptionId,
} from '../../lib/channelLookup.ts';
import { filterRowsByName } from '../../hooks/useListNameQuery.ts';
import { useMapSettings } from '../../hooks/useMapSettings.ts';
import { useZoneEdit } from '../../routes/library/zones/ZoneEditContext.tsx';
import { DSV2_TOKENS } from '../../theme-v2.ts';
import { createNameColumn } from '../../lib/libraryListTable.tsx';
import UseMyLocationButton from '../UseMyLocationButton/UseMyLocationButton.tsx';
import classes from './GrowZoneRecommendations.module.css';

const CHANNEL_SEARCH_DEBOUNCE_MS = 500;

type SuggestionMode = 'insideHull' | 'nearLocator';

function v2ModePill(mode: UiChannelMode) {
  const def = getModeDefinition(mode);
  const textColor =
    mode === 'dstar' || mode === 'dmr' || mode === 'tetra'
      ? DSV2_TOKENS.colors.pillTextLight
      : DSV2_TOKENS.colors.pillTextDark;
  return (
    <Pill key={mode} tone="semantic" color={def.color} textColor={textColor}>
      {def.label}
    </Pill>
  );
}

function nearestMemberDistanceM(
  channel: Channel,
  memberPoints: readonly (readonly [number, number])[],
): number | null {
  if (!channelHasGeolocation(channel) || memberPoints.length === 0) return null;
  let min = Number.POSITIVE_INFINITY;
  for (const [lat, lon] of memberPoints) {
    const distanceM = haversineDistanceM(channel.location!.lat, channel.location!.lon, lat, lon);
    if (distanceM < min) min = distanceM;
  }
  return min === Number.POSITIVE_INFINITY ? null : min;
}

export default function GrowZoneRecommendations() {
  const { entity, library, members, setMembers, previewZone } = useZoneEdit();
  const { mapboxToken } = useMapSettings();
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);

  const [mode, setMode] = useState<SuggestionMode>('insideHull');
  const [centreOverride, setCentreOverride] = useState<GeoCentre | null>(null);
  const [locator, setLocator] = useState('');
  const [locatorTouched, setLocatorTouched] = useState(false);
  const [locatorError, setLocatorError] = useState<string | null>(null);
  const [geocodeProvider, setGeocodeProvider] = useState<GeocodeProvider>(
    mapboxToken.trim() ? 'mapbox' : 'photon',
  );
  const [channelSearch, setChannelSearch] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [debouncedChannelSearch] = useDebouncedValue(channelSearch, CHANNEL_SEARCH_DEBOUNCE_MS);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);
  const [tableSearch, setTableSearch] = useState('');

  const memberPoints = useMemo(
    () => resolveZoneMemberGeolocatedPoints(previewZone, library.zones, library.channels),
    [previewZone, library.zones, library.channels],
  );

  const excludeIds = useMemo(() => {
    return new Set(resolveEffectiveZoneChannelIds(previewZone, library.zones));
  }, [previewZone, library.zones]);

  const defaultCentre = useMemo(() => zoneCentreFromPoints(memberPoints), [memberPoints]);
  const centre = centreOverride ?? defaultCentre;
  const displayedLocator =
    locatorTouched || !centre ? locator : coordsToLocator(centre.lat, centre.lon, 6);

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

  const filteredRows = useMemo(
    () => filterRowsByName(suggestionRows, tableSearch, (ch) => ch.name),
    [suggestionRows, tableSearch],
  );

  const applyCentre = useCallback((lat: number, lon: number) => {
    setCentreOverride({ lat, lon });
    setLocator(coordsToLocator(lat, lon, 6));
    setLocatorTouched(true);
    setLocatorError(null);
    setMode('nearLocator');
  }, []);

  const clearCentreOverride = useCallback(() => {
    setCentreOverride(null);
    setLocatorTouched(false);
    setLocator('');
    setLocatorError(null);
  }, []);

  const handleLocatorChange = (value: string) => {
    setLocatorTouched(true);
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
    setCentreOverride({ lat: coords.lat, lon: coords.lon });
    setMode('nearLocator');
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
    return [
      createNameColumn<Channel>({
        getName: (ch) => ch.name,
        getPath: (ch) => `/library/channels/${ch.id}`,
        sortValue: (ch) => ch.name,
      }),
      {
        key: 'band',
        header: 'Band',
        width: '0.8fr',
        render: (ch) => {
          const band = bandFromChannel(ch.rxFrequency, ch.txFrequency);
          if (!band) return '—';
          return (
            <Pill tone="semantic" color={band.color} textColor={DSV2_TOKENS.colors.pillTextLight}>
              {band.label}
            </Pill>
          );
        },
      },
      {
        key: 'mode',
        header: 'Mode',
        width: '0.8fr',
        render: (ch) => (
          <Group gap={4}>{channelModesForFilter(ch).map((modeKey) => v2ModePill(modeKey))}</Group>
        ),
      },
      {
        key: 'distance',
        header: 'Nearest member',
        width: '1.1fr',
        sortable: true,
        sortValue: (ch) => {
          const metres =
            suggestions.distancesM.get(ch.id) ?? nearestMemberDistanceM(ch, memberPoints);
          return metres ?? Number.POSITIVE_INFINITY;
        },
        render: (ch) => {
          const metres =
            suggestions.distancesM.get(ch.id) ?? nearestMemberDistanceM(ch, memberPoints);
          return metres != null ? formatDistanceM(metres) : '—';
        },
      },
    ];
  }, [memberPoints, suggestions.distancesM]);

  const hullUnavailable =
    mode === 'insideHull' && (memberPoints.length === 0 || memberPoints.length === 2);

  const geocodeCentre =
    centre && mode === 'nearLocator' ? { lat: centre.lat, lon: centre.lon } : null;

  return (
    <DesignSystemV2Provider>
      <div className={classes.root}>
        <EditorHeader
          crumb="Zones"
          crumbTo={`/library/zones/${entity.id}`}
          title={`Grow ${entity.name}`}
          subtitle="Channels near this zone's existing coverage, closest first."
          compact={isMobile}
        />

        <div className={[classes.scrollBody, isMobile ? classes.scrollBodyCompact : ''].join(' ')}>
          <Panel title="Suggestion mode">
            <div className={classes.modeBlock}>
              <SegmentedControl
                options={[
                  { value: 'insideHull', label: 'Inside hull' },
                  { value: 'nearLocator', label: 'Near locator' },
                ]}
                value={mode}
                onChange={(value) => setMode(value as SuggestionMode)}
              />
              {hullUnavailable ? (
                <p className={classes.hint}>
                  {memberPoints.length === 0
                    ? 'Add geolocated members to enable inside-hull suggestions.'
                    : 'Inside-hull needs at least three member sites (two sites draw a line with no area). Use Near locator instead.'}
                </p>
              ) : null}
              {mode === 'nearLocator' ? (
                <div className={classes.secondaryStack}>
                  <GeocodeCentreField
                    mapboxToken={mapboxToken}
                    centre={geocodeCentre}
                    onCentreChange={applyCentre}
                    onClearCentre={clearCentreOverride}
                    geocodeProvider={geocodeProvider}
                    onGeocodeProviderChange={setGeocodeProvider}
                  />
                  <TextInput
                    label="Maidenhead locator"
                    placeholder="e.g. IO85uk"
                    value={displayedLocator}
                    onChange={(e) => handleLocatorChange(e.currentTarget.value)}
                    error={locatorError}
                    size="sm"
                  />
                  <div className={classes.secondaryActions}>
                    <UseMyLocationButton onLocation={(lat, lon) => applyCentre(lat, lon)} />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!defaultCentre}
                      onClick={() => {
                        if (!defaultCentre) return;
                        clearCentreOverride();
                        setMode('nearLocator');
                      }}
                    >
                      Reset to zone centre
                    </Button>
                  </div>
                  <Autocomplete
                    label="Channel with location"
                    placeholder="Search channels with coordinates…"
                    value={channelSearch}
                    onChange={handleChannelSearchChange}
                    data={channelOptions}
                    limit={20}
                    size="sm"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!selectedChannel}
                    onClick={handleApplyChannelLocation}
                  >
                    Use channel location
                  </Button>
                  <p className={classes.hint}>
                    Default locator is the zone centre from member coordinates.{' '}
                    <Link to="/reference/maidenhead">Maidenhead reference</Link>
                  </p>
                </div>
              ) : null}
            </div>
          </Panel>

          <DataTable
            columns={tableColumns}
            rows={filteredRows}
            getRowId={(ch) => ch.id}
            totalRowCount={suggestionRows.length}
            resultCount={filteredRows.length}
            countLabel={(displayed) => `${displayed} candidate${displayed === 1 ? '' : 's'}`}
            search={{
              value: tableSearch,
              onChange: setTableSearch,
              placeholder: 'Search candidates…',
            }}
            selectable
            selectedKeys={selectedSuggestionIds}
            onSelectionChange={setSelectedSuggestionIds}
            bulkActions={
              <Button
                variant="primary"
                size="sm"
                disabled={!selectedSuggestionIds.length}
                onClick={handleAddSelected}
              >
                Add selected to zone
              </Button>
            }
            emptyMessage={
              mode === 'insideHull'
                ? 'No channels inside the zone hull'
                : 'No geolocated channels to rank — set a locator first'
            }
            filteredEmptyMessage={
              tableSearch.trim()
                ? `No candidates match “${tableSearch.trim()}”.`
                : 'No candidates match your filter.'
            }
          />

          <Panel title="Map preview">
            <div className={classes.mapWrap}>
              <MapPanel height={isMobile ? 200 : 360}>
                <CodeplugMap
                  channels={library.channels}
                  zones={library.zones}
                  allChannels={library.channels}
                  height="100%"
                  mapControlMode="zoneEmphasis"
                  emphasisZoneId={entity.id}
                  referencePosition={centre}
                  dimmedChannelIds={dimmedChannelIds}
                  onMapClick={(lat, lon) => applyCentre(lat, lon)}
                />
              </MapPanel>
            </div>
          </Panel>
        </div>
      </div>
    </DesignSystemV2Provider>
  );
}
