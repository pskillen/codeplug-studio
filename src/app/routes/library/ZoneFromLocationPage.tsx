import { Autocomplete, Group, TextInput } from '@mantine/core';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  selectChannelsWithinRadius,
  zoneMembersFromChannelIds,
} from '@core/domain/proximityZone.ts';
import { channelHasGeolocation } from '@core/domain/mapProjection.ts';
import { coordsToLocator, isValidLocator, locatorToCoords } from '@core/domain/maidenhead.ts';
import { newZone } from '@core/domain/factories.ts';
import { validateZoneMembership } from '@core/domain/validation.ts';
import type { Channel } from '@core/models/library.ts';
import type { GeocodeProvider } from '@integrations/geocode/index.ts';
import CodeplugMap from '../../components/CodeplugMap/CodeplugMap.tsx';
import GeocodeCentreField from '../../components/library/GeocodeCentreField.tsx';
import UseMyLocationButton from '../../components/UseMyLocationButton/UseMyLocationButton.tsx';
import {
  Button,
  DataTable,
  DesignSystemV2Provider,
  EditorHeader,
  FormField,
  MapPanel,
  Panel,
  Pill,
  StickyFooter,
  TextInput as V2TextInput,
  type DataTableColumn,
} from '../../components/v2/index.ts';
import { type ChannelMode as UiChannelMode, getModeDefinition } from '../../lib/channelModes.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { bandFromChannel } from '../../lib/bands.ts';
import { defaultMaxDistanceKm } from '../../hooks/channelListQueryUtils.ts';
import { useMapSettings } from '../../hooks/useMapSettings.ts';
import { channelModesForFilter } from '../../lib/channels.ts';
import {
  channelHasLocation,
  channelOptionLabel,
  filterChannelOptions,
  resolveChannelOptionId,
} from '../../lib/channelLookup.ts';
import { createNameColumn } from '../../lib/libraryListTable.tsx';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { DSV2_TOKENS } from '../../theme-v2.ts';
import { hzToMhzString } from '../../lib/units.ts';
import classes from './ZoneFromLocationPage.module.css';

const CHANNEL_SEARCH_DEBOUNCE_MS = 500;
const RADIUS_CHIP_KM = [10, 25, 50, 100] as const;

interface ReferenceCentre {
  lat: number;
  lon: number;
  label?: string;
}

function kmToMilesLabel(km: number): string {
  return `${Math.round(km * 0.621371)} mi`;
}

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

export default function ZoneFromLocationPage() {
  const navigate = useNavigate();
  const { library, loading, projectId } = useLibrary();
  const { mapboxToken } = useMapSettings();
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);

  const [centre, setCentre] = useState<ReferenceCentre | null>(null);
  const [locator, setLocator] = useState('');
  const [locatorError, setLocatorError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState(defaultMaxDistanceKm());
  const [zoneName, setZoneName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [geocodeProvider, setGeocodeProvider] = useState<GeocodeProvider>(
    mapboxToken.trim() ? 'mapbox' : 'photon',
  );
  const [channelSearch, setChannelSearch] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [debouncedChannelSearch] = useDebouncedValue(channelSearch, CHANNEL_SEARCH_DEBOUNCE_MS);
  const [selectedChannelIdsOverride, setSelectedChannelIdsOverride] = useState<string[] | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const selectedChannelIds = selectedChannelIdsOverride ?? selection.channelIds;

  const dimmedChannelIds = useMemo(() => {
    const selected = new Set(selection.channelIds);
    return geolocatedChannels.filter((ch) => !selected.has(ch.id)).map((ch) => ch.id);
  }, [geolocatedChannels, selection.channelIds]);

  const applyCentre = useCallback((lat: number, lon: number, label?: string) => {
    setCentre({ lat, lon, label });
    setLocator(coordsToLocator(lat, lon, 6));
    setLocatorError(null);
    setSelectedChannelIdsOverride(null);
  }, []);

  const clearCentre = useCallback(() => {
    setCentre(null);
    setLocator('');
    setLocatorError(null);
    setSelectedChannelIdsOverride(null);
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
    if (!projectId || !centre || selectedChannelIds.length === 0) return;
    const trimmedName = resolvedZoneName.trim();
    if (!trimmedName) {
      setError('Enter a zone name');
      return;
    }

    const row = newZone(projectId, trimmedName);
    row.members = zoneMembersFromChannelIds(selectedChannelIds);

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
      .then(() => navigate(`/library/zones/${row.id}`))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to create zone');
      })
      .finally(() => setSaving(false));
  };

  const tableColumns = useMemo((): DataTableColumn<Channel>[] => {
    return [
      createNameColumn<Channel>({
        getName: (ch) => ch.name,
        getPath: (ch) => `/library/channels/${ch.id}`,
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
          <Group gap={4}>
            {channelModesForFilter(ch).map((mode) => v2ModePill(mode))}
          </Group>
        ),
      },
      {
        key: 'frequency',
        header: 'Frequency',
        width: '1fr',
        render: (ch) => hzToMhzString(ch.rxFrequency),
        sortValue: (ch) => ch.rxFrequency,
      },
    ];
  }, []);

  if (loading || !projectId) {
    return (
      <DesignSystemV2Provider>
        <p className={classes.loading}>Loading…</p>
      </DesignSystemV2Provider>
    );
  }

  const canCreate =
    centre != null &&
    selectedChannelIds.length > 0 &&
    resolvedZoneName.trim().length > 0;

  const channelsPanelTitle = centre
    ? `Channels found — ${selectedRows.length} within range`
    : 'Channels found';

  return (
    <DesignSystemV2Provider>
      <div className={classes.root}>
        <EditorHeader
          crumb="Zones"
          crumbTo="/library/zones"
          title="New zone from location"
          subtitle="Find nearby repeaters and turn them straight into a zone."
          compact={isMobile}
        />

        <div
          className={[classes.scrollBody, isMobile ? classes.scrollBodyCompact : ''].join(' ')}
        >
          <Panel title="Centre point">
            <GeocodeCentreField
              mapboxToken={mapboxToken}
              centre={centre}
              onCentreChange={applyCentre}
              onClearCentre={clearCentre}
              geocodeProvider={geocodeProvider}
              onGeocodeProviderChange={setGeocodeProvider}
            />

            <div className={classes.radiusRow}>
              <span className={classes.radiusLabel}>Radius</span>
              {RADIUS_CHIP_KM.map((km) => (
                <button
                  key={km}
                  type="button"
                  className={[
                    classes.radiusChip,
                    radiusKm === km ? classes.radiusChipActive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    setRadiusKm(km);
                    setSelectedChannelIdsOverride(null);
                  }}
                >
                  {kmToMilesLabel(km)}
                </button>
              ))}
            </div>

            <div className={classes.mapWrap}>
              <MapPanel height={isMobile ? 140 : 200}>
                <CodeplugMap
                  channels={library.channels}
                  zones={library.zones}
                  allChannels={library.channels}
                  height="100%"
                  mapControlMode="zoneFromLocation"
                  referencePosition={centre}
                  referenceRadiusM={centre ? radiusKm * 1000 : null}
                  dimmedChannelIds={centre ? dimmedChannelIds : []}
                  provisionalZone={
                    selectedChannelIds.length > 0
                      ? {
                          channelIds: selectedChannelIds,
                          label: resolvedZoneName.trim() || 'New zone',
                        }
                      : null
                  }
                  onMapClick={(lat, lon) => applyCentre(lat, lon)}
                  onChannelClick={(id) => navigate(`/library/channels/${id}`)}
                  onZoneClick={(id) => navigate(`/library/zones/${id}`)}
                />
              </MapPanel>
            </div>

            <div className={classes.secondaryStack}>
              <p className={classes.secondaryLabel}>Or set centre another way</p>
              <TextInput
                label="Maidenhead locator"
                placeholder="e.g. IO85uk"
                value={locator}
                onChange={(e) => handleLocatorChange(e.currentTarget.value)}
                error={locatorError}
                size="sm"
              />
              <div className={classes.secondaryActions}>
                <UseMyLocationButton onLocation={(lat, lon) => applyCentre(lat, lon)} />
              </div>
              <Autocomplete
                label="Channel with location"
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
                size="sm"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleApplyChannelLocation}
                disabled={!selectedChannel || !channelHasLocation(selectedChannel)}
              >
                Use channel location
              </Button>
            </div>
          </Panel>

          <Panel title={channelsPanelTitle}>
            <DataTable
              variant="embedded"
              columns={tableColumns}
              rows={selectedRows}
              getRowId={(ch) => ch.id}
              totalRowCount={selectedRows.length}
              resultCount={selectedRows.length}
              countLabel={`${selectedRows.length} channel${selectedRows.length === 1 ? '' : 's'}`}
              selectable
              selectedKeys={selectedChannelIds}
              onSelectionChange={setSelectedChannelIdsOverride}
              emptyMessage={
                centre
                  ? 'No geolocated channels within this radius.'
                  : 'Set a centre point to preview channels in range.'
              }
              onRowActivate={(ch) => navigate(`/library/channels/${ch.id}`)}
            />
          </Panel>

          <Panel title="Name this zone">
            <FormField label="Zone name">
              <V2TextInput
                variant="plain"
                value={resolvedZoneName}
                onChange={(e) => {
                  setNameEdited(true);
                  setZoneName(e.currentTarget.value);
                }}
                aria-label="Zone name"
              />
            </FormField>
          </Panel>

          {error ? <p className={classes.error}>{error}</p> : null}
        </div>

        <StickyFooter
          saveLabel={`Create zone with ${selectedChannelIds.length} channel${selectedChannelIds.length === 1 ? '' : 's'}`}
          onCancel={() => navigate('/library/zones')}
          onSave={handleCreate}
          saving={saving}
          compact={isMobile}
          statusText={
            canCreate
              ? `${selectedChannelIds.length} channel${selectedChannelIds.length === 1 ? '' : 's'} selected`
              : 'Set a centre and select channels to create'
          }
        />
      </div>
    </DesignSystemV2Provider>
  );
}
