import { Suspense, lazy, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import LibraryInventoryHeader from '../../components/library/LibraryInventoryHeader.tsx';
import { Checkbox, DesignSystemV2Provider, Panel, TextInput } from '../../components/v2/index.ts';
import SatelliteTrackMap, {
  type SelectedPass,
} from '../../components/SatelliteTrackMap/SatelliteTrackMap.tsx';
import { useLibrary } from '../../state/useLibrary.ts';
import { useTrackingSettings } from '../../state/useTrackingSettings.ts';
import ObserverLocationSettings from './ObserverLocationSettings.tsx';
import PassGrid from './PassGrid.tsx';
import SatelliteFilter from './SatelliteFilter.tsx';
import {
  DEFAULT_WINDOW_HOURS,
  useTrackingPasses,
  type SatellitePassRow,
} from './useTrackingPasses.ts';
import { useTrackingDashboardFilters } from './useTrackingDashboardFilters.ts';
import {
  filterTrackingPasses,
  filterPassesToInterestedSatellites,
  nextPassBySatelliteId,
} from './passTime.ts';
import { enrichPassRowsWithFrequencies } from './satelliteFrequencies.ts';
import {
  computeFrequencyQualifiedSatelliteIds,
  computeInterestedSatelliteIds,
  hasSatelliteInterestFilter,
} from './interestedSatellites.ts';
import classes from './TrackingDashboardPage.module.css';
import libraryPageClasses from '../../components/library/LibraryInventoryPage.module.css';

const SatelliteGlobe = lazy(() => import('../../components/SatelliteGlobe/SatelliteGlobe.tsx'));

const MIN_WINDOW_HOURS = 1;
const MAX_WINDOW_HOURS = 168;
const MIN_DRAW_MIN = 0;
const MAX_DRAW_MIN = 60;

function clampWindowHours(value: number): number {
  if (Number.isNaN(value)) return DEFAULT_WINDOW_HOURS;
  return Math.min(MAX_WINDOW_HOURS, Math.max(MIN_WINDOW_HOURS, value));
}

function clampDrawMin(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(MAX_DRAW_MIN, Math.max(MIN_DRAW_MIN, value));
}

function toSelectedPass(row: SatellitePassRow): SelectedPass {
  return {
    satelliteName: row.satelliteName,
    noradId: row.noradId,
    tleLine1: row.tleLine1,
    tleLine2: row.tleLine2,
    aosAt: row.aosAt,
    losAt: row.losAt,
  };
}

export default function TrackingDashboardPage() {
  const {
    windowHours,
    drawBehindMin,
    drawAheadMin,
    minElevation,
    onlyWithFrequencies,
    // Satellite multi-select filter, shared by the globe and the pass grid — a globe click
    // narrows the grid, and (via SatelliteFilter, still owned inside PassGrid) a grid checkbox
    // narrows the globe's highlighted dots.
    selectedSatelliteIds,
    setWindowHours,
    setDrawBehindMin,
    setDrawAheadMin,
    setMinElevation,
    setOnlyWithFrequencies,
    setSelectedSatelliteIds,
  } = useTrackingDashboardFilters();
  const {
    passes: basePasses,
    loading,
    error,
    hasObserver,
    hasEnabledSatellites,
  } = useTrackingPasses(windowHours);
  const { settings } = useTrackingSettings();
  const { library } = useLibrary();
  const [selectedPass, setSelectedPass] = useState<SelectedPass | null>(null);

  const enabledSatelliteRecords = useMemo(
    () => library.satellites.filter((satellite) => satellite.enabled),
    [library.satellites],
  );

  const enabledSatellites = useMemo(
    () =>
      enabledSatelliteRecords.map((satellite) => ({
        id: satellite.id,
        name: satellite.name,
        noradId: satellite.noradId,
        tleLine1: satellite.tleLine1,
        tleLine2: satellite.tleLine2,
        meanMotionRevPerDay: satellite.meanMotionRevPerDay,
      })),
    [enabledSatelliteRecords],
  );

  const enabledSatelliteIds = useMemo(
    () => new Set(enabledSatelliteRecords.map((satellite) => satellite.id)),
    [enabledSatelliteRecords],
  );

  const frequencyQualifiedSatelliteIds = useMemo(
    () => computeFrequencyQualifiedSatelliteIds(enabledSatelliteRecords),
    [enabledSatelliteRecords],
  );

  const interestedSatelliteIds = useMemo(
    () =>
      computeInterestedSatelliteIds(
        enabledSatelliteIds,
        frequencyQualifiedSatelliteIds,
        selectedSatelliteIds,
        onlyWithFrequencies,
      ),
    [
      enabledSatelliteIds,
      frequencyQualifiedSatelliteIds,
      selectedSatelliteIds,
      onlyWithFrequencies,
    ],
  );

  const satelliteInterestFilterActive = hasSatelliteInterestFilter(
    onlyWithFrequencies,
    selectedSatelliteIds,
  );

  const satelliteFilterOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const pass of basePasses) {
      if (!byId.has(pass.satelliteId)) byId.set(pass.satelliteId, pass.satelliteName);
    }
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [basePasses]);

  const passes = useMemo(() => enrichPassRowsWithFrequencies(basePasses), [basePasses]);

  const handleSelectSatelliteFromGlobe = (satelliteId: string) => {
    // Toggle off if this satellite is already the sole filter; otherwise narrow to it.
    if (selectedSatelliteIds.size === 1 && selectedSatelliteIds.has(satelliteId)) {
      setSelectedSatelliteIds(new Set());
    } else {
      setSelectedSatelliteIds(new Set([satelliteId]));
    }
  };

  const minElevationValue = Number.parseFloat(minElevation);
  const hasActiveFilter = !Number.isNaN(minElevationValue) || satelliteInterestFilterActive;

  const passesInInterestScope = useMemo(
    () => filterPassesToInterestedSatellites(passes, interestedSatelliteIds),
    [passes, interestedSatelliteIds],
  );

  const filteredPasses = useMemo(
    () => filterTrackingPasses(passes, minElevation, interestedSatelliteIds),
    [passes, minElevation, interestedSatelliteIds],
  );

  const defaultMapPasses = useMemo(() => {
    // Ground-track sampling is expensive — auto-draw next pass per interested satellite when
    // satellite-level filters are active (frequency toggle or multi-select).
    if (!satelliteInterestFilterActive) return [];
    const nextMap = nextPassBySatelliteId(filteredPasses);
    return Array.from(nextMap.values()).map(toSelectedPass);
  }, [filteredPasses, satelliteInterestFilterActive]);

  return (
    <DesignSystemV2Provider>
      <div className={libraryPageClasses.page}>
        <LibraryInventoryHeader
          title="Tracking Dashboard"
          subtitle={`Upcoming satellite passes over the next ${windowHours} hours.`}
        />

        <ObserverLocationSettings />

        <Panel
          title="Calculate passes"
          sub="Pass prediction window and client-side filters for the grid below."
        >
          <div className={classes.calculatePasses}>
            <TextInput
              label="Look ahead (hours)"
              type="number"
              min={MIN_WINDOW_HOURS}
              max={MAX_WINDOW_HOURS}
              value={windowHours}
              onChange={(event) => setWindowHours(clampWindowHours(Number(event.target.value)))}
            />
            <TextInput
              label="Extend before AOS (min)"
              type="number"
              min={MIN_DRAW_MIN}
              max={MAX_DRAW_MIN}
              value={drawBehindMin}
              onChange={(event) => setDrawBehindMin(clampDrawMin(Number(event.target.value)))}
            />
            <TextInput
              label="Extend after LOS (min)"
              type="number"
              min={MIN_DRAW_MIN}
              max={MAX_DRAW_MIN}
              value={drawAheadMin}
              onChange={(event) => setDrawAheadMin(clampDrawMin(Number(event.target.value)))}
            />
            <TextInput
              label="Min elevation (°)"
              type="number"
              placeholder="0"
              value={minElevation}
              onChange={(event) => setMinElevation(event.target.value)}
            />
            <SatelliteFilter
              options={satelliteFilterOptions}
              selectedIds={selectedSatelliteIds}
              onChange={setSelectedSatelliteIds}
            />
            <label className={classes.frequencyFilter}>
              <Checkbox checked={onlyWithFrequencies} onCheckedChange={setOnlyWithFrequencies} />
              <span>Only passes with TX/RX frequencies</span>
            </label>
          </div>
        </Panel>

        <div className={classes.mapAndGlobe}>
          <Panel title="Ground track" sub="Preview a selected pass's ground track.">
            <div className={classes.map}>
              <SatelliteTrackMap
                observer={settings?.location ?? null}
                selectedPass={selectedPass}
                defaultPasses={defaultMapPasses}
                drawBehindMin={drawBehindMin}
                drawAheadMin={drawAheadMin}
              />
            </div>
          </Panel>

          {hasEnabledSatellites ? (
            <Panel title="Orbital globe" sub="Click a satellite to filter the pass grid to it.">
              <Suspense fallback={<div className={classes.globeLoading}>Loading 3D globe…</div>}>
                <SatelliteGlobe
                  observer={settings?.location ?? null}
                  satellites={enabledSatellites}
                  interestedSatelliteIds={interestedSatelliteIds}
                  highlightedSatelliteIds={selectedSatelliteIds}
                  onSelectSatellite={handleSelectSatelliteFromGlobe}
                />
              </Suspense>
            </Panel>
          ) : null}
        </div>

        {!hasEnabledSatellites ? (
          <p className={classes.empty}>
            No enabled satellites yet.{' '}
            <Link to="/library/satellite-keps">Refresh and enable some in Satellite Keps</Link>.
          </p>
        ) : !hasObserver ? (
          <p className={classes.empty}>
            Set an observer location above to calculate passes for your enabled satellites.
          </p>
        ) : (
          <PassGrid
            passes={filteredPasses}
            allPasses={passes}
            totalRowCount={
              satelliteInterestFilterActive ? passesInInterestScope.length : passes.length
            }
            loading={loading}
            error={error}
            windowLabel={`${windowHours} hours`}
            hasActiveFilter={hasActiveFilter}
            onSelectPass={(row) => setSelectedPass(toSelectedPass(row))}
          />
        )}
      </div>
    </DesignSystemV2Provider>
  );
}
