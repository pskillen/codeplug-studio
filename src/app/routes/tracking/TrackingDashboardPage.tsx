import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import LibraryInventoryHeader from '../../components/library/LibraryInventoryHeader.tsx';
import { DesignSystemV2Provider, Panel, TextInput } from '../../components/v2/index.ts';
import SatelliteTrackMap, {
  type SelectedPass,
} from '../../components/SatelliteTrackMap/SatelliteTrackMap.tsx';
import SatelliteGlobe from '../../components/SatelliteGlobe/SatelliteGlobe.tsx';
import { useLibrary } from '../../state/useLibrary.ts';
import { useTrackingSettings } from '../../state/useTrackingSettings.ts';
import ObserverLocationSettings from './ObserverLocationSettings.tsx';
import PassGrid from './PassGrid.tsx';
import {
  DEFAULT_WINDOW_HOURS,
  useTrackingPasses,
  type SatellitePassRow,
} from './useTrackingPasses.ts';
import classes from './TrackingDashboardPage.module.css';
import libraryPageClasses from '../../components/library/LibraryInventoryPage.module.css';

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
    tleLine1: row.tleLine1,
    tleLine2: row.tleLine2,
    aosAt: row.aosAt,
    losAt: row.losAt,
  };
}

export default function TrackingDashboardPage() {
  const [windowHours, setWindowHours] = useState(DEFAULT_WINDOW_HOURS);
  const { passes, loading, error, hasObserver, hasEnabledSatellites } =
    useTrackingPasses(windowHours);
  const { settings } = useTrackingSettings();
  const { library } = useLibrary();
  const [selectedPass, setSelectedPass] = useState<SelectedPass | null>(null);
  const [drawBehindMin, setDrawBehindMin] = useState(0);
  const [drawAheadMin, setDrawAheadMin] = useState(0);
  // Satellite multi-select filter, shared by the globe and the pass grid — a globe click
  // narrows the grid, and (via SatelliteFilter, still owned inside PassGrid) a grid checkbox
  // narrows the globe's highlighted dots.
  const [selectedSatelliteIds, setSelectedSatelliteIds] = useState<Set<string>>(new Set());

  const enabledSatellites = useMemo(
    () =>
      library.satellites
        .filter((satellite) => satellite.enabled)
        .map((satellite) => ({
          id: satellite.id,
          name: satellite.name,
          tleLine1: satellite.tleLine1,
          tleLine2: satellite.tleLine2,
          meanMotionRevPerDay: satellite.meanMotionRevPerDay,
        })),
    [library.satellites],
  );

  const handleSelectSatelliteFromGlobe = (satelliteId: string) => {
    setSelectedSatelliteIds((current) => {
      // Toggle off if this satellite is already the sole filter; otherwise narrow to it.
      if (current.size === 1 && current.has(satelliteId)) return new Set();
      return new Set([satelliteId]);
    });
  };

  return (
    <DesignSystemV2Provider>
      <div className={libraryPageClasses.page}>
        <LibraryInventoryHeader
          title="Tracking Dashboard"
          subtitle={`Upcoming satellite passes over the next ${windowHours} hours.`}
        />

        <ObserverLocationSettings />

        <div className={classes.windowControl}>
          <TextInput
            label="Look ahead (hours)"
            type="number"
            min={MIN_WINDOW_HOURS}
            max={MAX_WINDOW_HOURS}
            value={windowHours}
            onChange={(event) => setWindowHours(clampWindowHours(Number(event.target.value)))}
          />
        </div>

        <div className={classes.drawWindowControl}>
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
        </div>

        <div className={classes.map}>
          <SatelliteTrackMap
            observer={settings?.location ?? null}
            selectedPass={selectedPass}
            drawBehindMin={drawBehindMin}
            drawAheadMin={drawAheadMin}
          />
        </div>

        {hasEnabledSatellites ? (
          <Panel title="Orbital globe" sub="Click a satellite to filter the pass grid to it.">
            <SatelliteGlobe
              observer={settings?.location ?? null}
              satellites={enabledSatellites}
              selectedSatelliteIds={selectedSatelliteIds}
              onSelectSatellite={handleSelectSatelliteFromGlobe}
            />
          </Panel>
        ) : null}

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
            passes={passes}
            loading={loading}
            error={error}
            windowLabel={`${windowHours} hours`}
            onSelectPass={(row) => setSelectedPass(toSelectedPass(row))}
            selectedSatelliteIds={selectedSatelliteIds}
            onSelectedSatelliteIdsChange={setSelectedSatelliteIds}
          />
        )}
      </div>
    </DesignSystemV2Provider>
  );
}
