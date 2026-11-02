import { useMediaQuery } from '@mantine/hooks';
import { IconCurrentLocation } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { bandFromFrequencyMhz } from '@core/domain/bandCatalog.ts';
import {
  formatBearingLabel,
  formatCoordParam,
  formatDistanceInUnit,
  parseLatLon,
  rankByDistance,
  unitToMetres,
  type DistanceUnit,
} from '@core/domain/fieldGeo.ts';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import { repeaterListingToChannel } from '@integrations/repeaters/index.ts';
import FieldMap, {
  type FieldMapMarker,
  type FieldMapPin,
} from '../../components/FieldTools/FieldMap.tsx';
import MapToolLayout from '../../components/FieldTools/MapToolLayout.tsx';
import PlaceInput from '../../components/FieldTools/PlaceInput.tsx';
import { Button, Pill } from '../../components/v2/index.ts';
import { useDistanceUnit } from '../../hooks/useDistanceUnit.ts';
import { useGeolocation } from '../../hooks/useGeolocation.ts';
import { useNearbyQuery } from '../../hooks/useNearbyQuery.ts';
import { useUkRepeatersNear } from '../../hooks/useUkRepeatersNear.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { getModeDefinition } from '../../lib/channelModes.ts';
import {
  NEARBY_BAND_CHOICES,
  NEARBY_MODE_CHOICES,
  applyNearbyFilters,
  buildNearbyItems,
  type NearbyItem,
} from '../../lib/nearbyRepeaters.ts';
import { placeFromCoords, type Place } from '../../lib/resolvePlace.ts';
import { hzToMhzString } from '../../lib/units.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useProjects } from '../../state/useProjects.ts';
import { DSV2_TOKENS } from '../../theme-v2.ts';
import Chip from './Chip.tsx';
import classes from './FieldTools.module.css';

const RADIUS_CHOICES = [10, 25, 50, 100] as const;
const PIN_COLOUR = '#4f8cff';
const MARKER_COLOUR = '#e8890c';
const MAX_ROWS = 60;

function radiusKmToChoice(km: number, unit: DistanceUnit): number {
  return unit === 'mi' ? Math.round(km / 1.609344) : Math.round(km);
}

function modePill(mode: ChannelMode) {
  const def = getModeDefinition(mode);
  const light = mode === 'dstar' || mode === 'dmr' || mode === 'tetra';
  return (
    <Pill
      key={mode}
      tone="semantic"
      color={def.color}
      textColor={light ? DSV2_TOKENS.colors.pillTextLight : DSV2_TOKENS.colors.pillTextDark}
    >
      {def.label}
    </Pill>
  );
}

function bandPill(item: NearbyItem) {
  const band = item.rxFrequencyHz != null ? bandFromFrequencyMhz(item.rxFrequencyHz / 1e6) : null;
  if (!band) return null;
  return (
    <Pill key={band.id} tone="semantic" color={band.color} textColor="#fff">
      {band.id}
    </Pill>
  );
}

/** Nearby repeaters: pick a point, set radius / source / filters, see a nearest-first list. */
export default function NearbyPage() {
  const [params, setParams] = useSearchParams();
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY, false, {
    getInitialValueInEffect: false,
  });
  const { activeProjectId, activeProject } = useProjects();
  const { library } = useLibrary();
  const { requestLocation, loading: gpsLoading, error: gpsError } = useGeolocation();
  const [unit, setUnit] = useDistanceUnit();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(!isMobile);
  const rowRefs = useRef(new Map<string, HTMLElement>());

  const hasProject = activeProjectId != null;
  const channels = hasProject ? library.channels : [];

  const point = parseLatLon(params.get('lat'), params.get('lon'));
  const pointLabel = params.get('pl') || undefined;
  const {
    radiusKm,
    sources,
    bands,
    modes,
    operationalOnly,
    setRadiusKm,
    toggleSource,
    toggleBand,
    toggleMode,
    setOperationalOnly,
  } = useNearbyQuery();

  const patch = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(changes)) {
            if (v == null || v === '') next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const setPoint = useCallback(
    (p: Place) => {
      patch({ lat: formatCoordParam(p.lat), lon: formatCoordParam(p.lon), pl: p.label });
      setSelectedKey(null);
    },
    [patch],
  );

  const locateMe = useCallback(async () => {
    const r = await requestLocation();
    if (r) setPoint(placeFromCoords(r.lat, r.lon, 'gps', 'My location'));
  }, [requestLocation, setPoint]);

  // Start at the user's position unless the URL already carries a point.
  useEffect(() => {
    if (point) return;
    void requestLocation().then((r) => {
      if (r) setPoint(placeFromCoords(r.lat, r.lon, 'gps', 'My location'));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const radiusM = radiusKm * 1000;
  const uk = useUkRepeatersNear(point, radiusM, sources.includes('ukrepeater'));

  const ranked = useMemo(() => {
    if (!point) return [];
    const items = applyNearbyFilters(
      buildNearbyItems({ listings: uk.listings, channels, sources }),
      { bands, modes, operationalOnly },
    );
    return rankByDistance(items, point, (i) => i.location, radiusM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    point?.lat,
    point?.lon,
    uk.listings,
    channels,
    sources,
    bands,
    modes,
    operationalOnly,
    radiusM,
  ]);

  const shown = ranked.slice(0, MAX_ROWS);
  const radiusLabel = `${radiusKmToChoice(radiusKm, unit)} ${unit}`;

  const pins: FieldMapPin[] = point
    ? [
        {
          id: 'point',
          lat: point.lat,
          lon: point.lon,
          label: '',
          colour: PIN_COLOUR,
          draggable: true,
        },
      ]
    : [];
  const markers: FieldMapMarker[] = shown.map((r, i) => ({
    id: r.item.key,
    lat: r.item.location.lat,
    lon: r.item.location.lon,
    label: String(i + 1),
    colour: MARKER_COLOUR,
    selected: r.item.key === selectedKey,
  }));

  const selectKey = (key: string, scroll: boolean) => {
    setSelectedKey(key);
    if (scroll) rowRefs.current.get(key)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const addItems = async (items: NearbyItem[]) => {
    if (!activeProjectId) return;
    setAdding(true);
    setAddMessage(null);
    let ok = 0;
    const done = new Set<string>();
    try {
      for (const item of items) {
        if (!item.listing || item.inLibrary || added.has(item.key)) continue;
        const channel = repeaterListingToChannel(item.listing, activeProjectId, {
          titleCaseText: true,
        });
        const result = await persistence.putChannel(channel, null);
        if (result.ok) {
          ok++;
          done.add(item.key);
        }
      }
      setAdded((prev) => new Set([...prev, ...done]));
      setAddMessage(
        ok > 0 ? `Added ${ok} channel${ok === 1 ? '' : 's'} to your library.` : 'Nothing to add.',
      );
    } finally {
      setAdding(false);
    }
  };

  const addable = shown.filter(
    (r) => r.item.listing && !r.item.inLibrary && !added.has(r.item.key),
  );

  const placeInput = (
    <PlaceInput
      label="Search point"
      placeholder="Address, postcode, locator or callsign"
      place={point ? placeFromCoords(point.lat, point.lon, 'map', pointLabel) : null}
      onPlace={(p) => p && setPoint(p)}
      channels={channels}
      allowGps
    />
  );

  const filters = (
    <div className={classes.card}>
      <div className={classes.chipRow}>
        <span className={classes.chipLabel}>Radius</span>
        <div className={classes.chips} role="group" aria-label="Radius">
          {RADIUS_CHOICES.map((n) => {
            const km = unitToMetres(n, unit) / 1000;
            return (
              <Chip key={n} active={Math.abs(radiusKm - km) < 0.5} onClick={() => setRadiusKm(km)}>
                {n} {unit}
              </Chip>
            );
          })}
        </div>
      </div>
      <div className={classes.chipRow}>
        <span className={classes.chipLabel}>Unit</span>
        <div className={classes.chips} role="group" aria-label="Distance unit">
          {(['mi', 'km'] as const).map((u) => (
            <Chip key={u} active={u === unit} onClick={() => setUnit(u)}>
              {u}
            </Chip>
          ))}
        </div>
      </div>
      <div className={classes.chipRow}>
        <span className={classes.chipLabel}>Source</span>
        <div className={classes.chips} role="group" aria-label="Source">
          <Chip active={sources.includes('ukrepeater')} onClick={() => toggleSource('ukrepeater')}>
            ukrepeater.net
          </Chip>
          <Chip
            active={sources.includes('library')}
            disabled={!hasProject}
            title={hasProject ? undefined : 'Open a project to search its library'}
            onClick={() => toggleSource('library')}
          >
            My library
          </Chip>
        </div>
      </div>
      <div className={classes.chipRow}>
        <span className={classes.chipLabel}>Filter</span>
        <div className={classes.chips} role="group" aria-label="Band, mode and status filters">
          {NEARBY_BAND_CHOICES.map((b) => (
            <Chip key={b.id} active={bands.includes(b.id)} onClick={() => toggleBand(b.id)}>
              {b.label}
            </Chip>
          ))}
          {NEARBY_MODE_CHOICES.map((m) => (
            <Chip key={m.id} active={modes.includes(m.id)} onClick={() => toggleMode(m.id)}>
              {m.label}
            </Chip>
          ))}
          <Chip active={operationalOnly} onClick={() => setOperationalOnly(!operationalOnly)}>
            Operational
          </Chip>
        </div>
      </div>
    </div>
  );

  const summary = (
    <div className={classes.summary}>
      <span className={classes.summaryTitle}>
        {!point
          ? gpsLoading
            ? 'Finding you…'
            : 'Pick a point'
          : uk.loading
            ? 'Searching…'
            : `${ranked.length} repeater${ranked.length === 1 ? '' : 's'} within ${radiusLabel}`}
      </span>
      <span className={classes.status}>nearest first</span>
    </div>
  );

  const bulkAdd =
    hasProject && addable.length > 0 ? (
      <Button
        variant="secondary"
        size="sm"
        loading={adding}
        onClick={() => void addItems(addable.map((r) => r.item))}
      >
        + Add {addable.length} to {activeProject?.name ?? 'project'}
      </Button>
    ) : null;

  const list = (
    <>
      {gpsError && !point ? (
        <div className={classes.error} role="alert">
          {gpsError}. Search for a place above instead, or tap the map.
        </div>
      ) : null}
      {uk.error ? (
        <div className={classes.error} role="alert">
          {uk.error}
        </div>
      ) : null}
      {addMessage ? <div className={classes.status}>{addMessage}</div> : null}
      {point && !uk.loading && shown.length === 0 ? (
        <div className={classes.empty}>
          No repeaters within {radiusLabel}. Try a larger radius or fewer filters.
        </div>
      ) : null}
      <div className={classes.list} role="list">
        {shown.map((r, i) => {
          const item = r.item;
          const selected = item.key === selectedKey;
          const isIn = item.inLibrary || added.has(item.key);
          return (
            <div
              key={item.key}
              role="listitem"
              ref={(el) => {
                if (el) rowRefs.current.set(item.key, el);
                else rowRefs.current.delete(item.key);
              }}
              tabIndex={0}
              aria-current={selected || undefined}
              className={[classes.row, selected ? classes.rowSelected : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => selectKey(item.key, false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  selectKey(item.key, false);
                }
              }}
            >
              <span className={classes.rank}>{i + 1}</span>
              <span className={classes.rowMain}>
                <span className={classes.rowTitle}>
                  <strong>{item.callsign}</strong>
                  {item.name}
                </span>
                <span className={classes.rowMeta}>
                  {bandPill(item)}
                  {item.modes.map(modePill)}
                  {item.rxFrequencyHz != null ? (
                    <span className={classes.mono}>{hzToMhzString(item.rxFrequencyHz)}</span>
                  ) : null}
                  {isIn ? <span className={classes.inLibrary}>✓ In library</span> : null}
                </span>
              </span>
              <span className={classes.rowDistance}>
                <strong>{formatDistanceInUnit(r.distanceM, unit)}</strong>
                <span>{formatBearingLabel(r.bearingDeg)}</span>
              </span>
              {hasProject && item.listing && !isIn ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={adding}
                  onClick={(e) => {
                    e.stopPropagation();
                    void addItems([item]);
                  }}
                >
                  + Add
                </Button>
              ) : (
                <span />
              )}
            </div>
          );
        })}
      </div>
      {ranked.length > shown.length ? (
        <div className={classes.status}>
          Showing the nearest {shown.length} of {ranked.length}. Narrow the radius or filters to see
          the rest.
        </div>
      ) : null}
    </>
  );

  return (
    <MapToolLayout
      title="Repeaters near a point"
      description="What can I hit from here? Nothing is saved unless you add a repeater to your project."
      mapHint="Click the map or drag the pin to move the point"
      mapOverlay={placeInput}
      desktopLead={
        <>
          {placeInput}
          <div>
            <Button
              variant="primary"
              size="sm"
              loading={gpsLoading}
              leftSection={<IconCurrentLocation size={16} stroke={1.75} />}
              onClick={() => void locateMe()}
            >
              Use my location
            </Button>
          </div>
        </>
      }
      showViewToggle
      sheetHeader={summary}
      sheetLabel="Nearby repeaters"
      initialSnap="half"
      map={
        <FieldMap
          pins={pins}
          markers={markers}
          ring={point ? { lat: point.lat, lon: point.lon, radiusM } : null}
          onMapClick={(lat, lon) => setPoint(placeFromCoords(lat, lon, 'map'))}
          onPinDrag={(_id, lat, lon) => setPoint(placeFromCoords(lat, lon, 'map'))}
          onMarkerClick={(key) => selectKey(key, true)}
          fitKey={point ? `${point.lat},${point.lon},${radiusKm}` : 'none'}
          fitInsetBottomPx={isMobile ? 300 : 0}
        />
      }
    >
      {isMobile ? (
        <div>
          <Chip active={filtersOpen} onClick={() => setFiltersOpen((o) => !o)}>
            {`${radiusLabel} · ${sources.length === 2 ? 'all sources' : sources[0] === 'library' ? 'My library' : 'ukrepeater.net'}${
              bands.length + modes.length + (operationalOnly ? 1 : 0) > 0
                ? ` · ${bands.length + modes.length + (operationalOnly ? 1 : 0)} filters`
                : ''
            } ${filtersOpen ? '▴' : '▾'}`}
          </Chip>
        </div>
      ) : null}
      {filtersOpen || !isMobile ? filters : null}
      {!isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {summary}
          {bulkAdd}
        </div>
      ) : (
        bulkAdd
      )}
      {list}
    </MapToolLayout>
  );
}
