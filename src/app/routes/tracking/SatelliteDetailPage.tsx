import { Suspense, lazy, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { IconRefresh } from '@tabler/icons-react';
import { mergeSatnogsTransmittersIntoSatellite } from '@core/domain/satnogs/mergeSatnogsTransmitters.ts';
import { mapSatnogsTransmitter } from '@core/domain/satnogs/parseSatnogsTransmitters.ts';
import { fetchSatnogsTransmittersForNoradId } from '@integrations/satellites/satnogsClient.ts';
import LibraryInventoryHeader from '../../components/library/LibraryInventoryHeader.tsx';
import NextPassCard from '../../components/NextPassCard/NextPassCard.tsx';
import SatelliteLiveMap from '../../components/SatelliteLiveMap/SatelliteLiveMap.tsx';
import { Button, DesignSystemV2Provider, TextInput } from '../../components/v2/index.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useTrackingSettings } from '../../state/useTrackingSettings.ts';
import libraryPageClasses from '../../components/library/LibraryInventoryPage.module.css';
import { isPassActive } from './passTime.ts';
import SatelliteDetailPanel from './SatelliteDetailPanel.tsx';
import SatellitePassList from './SatellitePassList.tsx';
import { useDopplerShiftedFrequencies } from './useDopplerShiftedFrequencies.ts';
import { useNowTick } from './useNowTick.ts';
import { usePassesForSatellite } from './usePassesForSatellite.ts';
import { DEFAULT_ORBIT_TRAIL_MULTIPLE } from '../../components/SatelliteLiveMap/orbitTrail.ts';
import {
  clampGlobeTrailMinutes,
  GLOBE_TRAIL_STEP_MIN,
  MAX_GLOBE_TRAIL_MIN,
  MIN_GLOBE_TRAIL_MIN,
} from '../../components/SatelliteGlobe/orbitTrail.ts';
import classes from './SatelliteDetailPage.module.css';

const SatelliteGlobe = lazy(() => import('../../components/SatelliteGlobe/SatelliteGlobe.tsx'));

const UPCOMING_PASSES_ANCHOR_ID = 'upcoming-passes';

const FUTURE_WINDOW_HOURS = 72;
const PAST_WINDOW_HOURS = 72;
const DETAIL_GLOBE_LOOK_BEHIND_MIN = 30;
const DETAIL_GLOBE_LOOK_AHEAD_MIN = 60;
const MIN_ORBIT_TRAIL_MULTIPLE = 0.25;
const MAX_ORBIT_TRAIL_MULTIPLE = 3;
const ORBIT_TRAIL_STEP = 0.25;

function clampOrbitTrailMultiple(value: number): number {
  if (Number.isNaN(value)) return DEFAULT_ORBIT_TRAIL_MULTIPLE;
  const clamped = Math.min(MAX_ORBIT_TRAIL_MULTIPLE, Math.max(MIN_ORBIT_TRAIL_MULTIPLE, value));
  return Math.round(clamped / ORBIT_TRAIL_STEP) * ORBIT_TRAIL_STEP;
}

export default function SatelliteDetailPage() {
  const { satelliteId } = useParams();
  const navigate = useNavigate();
  const { library, loading, reload } = useLibrary();
  const [refreshingSatnogs, setRefreshingSatnogs] = useState(false);
  const [satnogsError, setSatnogsError] = useState<string | null>(null);
  const [globeLookBehindMin, setGlobeLookBehindMin] = useState(DETAIL_GLOBE_LOOK_BEHIND_MIN);
  const [globeLookAheadMin, setGlobeLookAheadMin] = useState(DETAIL_GLOBE_LOOK_AHEAD_MIN);
  const [orbitTrailMultiple, setOrbitTrailMultiple] = useState(DEFAULT_ORBIT_TRAIL_MULTIPLE);
  const satellite = satelliteId
    ? (library.satellites.find((s) => s.id === satelliteId) ?? null)
    : null;

  async function handleRefreshSatnogs() {
    if (!satellite) return;
    setRefreshingSatnogs(true);
    setSatnogsError(null);
    try {
      const raw = await fetchSatnogsTransmittersForNoradId(satellite.noradId, { refresh: true });
      const merged = mergeSatnogsTransmittersIntoSatellite(
        satellite,
        raw.map(mapSatnogsTransmitter),
      );
      await persistence.putSatellite(merged.satellite, satellite.revision);
      await reload();
    } catch (err) {
      setSatnogsError(err instanceof Error ? err.message : 'SatNOGS refresh failed.');
    } finally {
      setRefreshingSatnogs(false);
    }
  }

  // Fixed at mount rather than recomputed every render — the pass lists refresh via the
  // hook's own debounce/effect cycle, not by chasing a moving "now" on each render.
  const [now] = useState(() => Date.now());
  const futureWindow = {
    fromAt: new Date(now).toISOString(),
    toAt: new Date(now + FUTURE_WINDOW_HOURS * 60 * 60 * 1000).toISOString(),
  };
  const pastWindow = {
    fromAt: new Date(now - PAST_WINDOW_HOURS * 60 * 60 * 1000).toISOString(),
    toAt: new Date(now).toISOString(),
  };

  const future = usePassesForSatellite(satellite, futureWindow);
  const past = usePassesForSatellite(satellite, pastWindow);

  const nowMs = useNowTick(1000);
  const { settings } = useTrackingSettings();
  const observerLocation = settings?.location
    ? { latDeg: settings.location.lat, lonDeg: settings.location.lon }
    : null;
  const nextPass = future.passes[0] ?? null;
  const nextPassActive = nextPass ? isPassActive(nowMs, nextPass.aosAt, nextPass.losAt) : false;
  const doppler = useDopplerShiftedFrequencies(
    satellite,
    (satellite?.transmitters ?? []).map((t) => ({
      id: t.id,
      uplinkHz: t.uplinkHz,
      downlinkHz: t.downlinkHz,
    })),
    observerLocation,
    nextPassActive,
    nowMs,
  );

  if (loading) {
    return (
      <DesignSystemV2Provider>
        <div className={libraryPageClasses.page}>
          <LibraryInventoryHeader title="Satellite" subtitle="Loading library…" />
        </div>
      </DesignSystemV2Provider>
    );
  }

  if (!satellite) {
    return (
      <DesignSystemV2Provider>
        <div className={libraryPageClasses.page}>
          <LibraryInventoryHeader title="Satellite not found" />
          <p>
            This satellite isn't in your library.{' '}
            <Link to="/library/satellite-keps">Back to Satellite Keps</Link>.
          </p>
        </div>
      </DesignSystemV2Provider>
    );
  }

  return (
    <DesignSystemV2Provider>
      <div className={libraryPageClasses.page}>
        <LibraryInventoryHeader
          title={satellite.name}
          subtitle={`NORAD ${satellite.noradId}`}
          actions={
            <>
              <Button
                variant="secondary"
                leftSection={<IconRefresh size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
                onClick={() => void handleRefreshSatnogs()}
                disabled={refreshingSatnogs}
              >
                {refreshingSatnogs ? 'Refreshing SatNOGS…' : 'Refresh SatNOGS'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate(`/library/satellite-keps/${satellite.id}`)}
              >
                Edit uplink/downlink…
              </Button>
            </>
          }
        />
        {satnogsError ? <p className={classes.satnogsError}>{satnogsError}</p> : null}

        <NextPassCard
          satelliteName={satellite.name}
          nextPass={nextPass}
          nowMs={nowMs}
          hasObserver={future.hasObserver}
          transmitters={satellite.transmitters
            .filter((t) => !t.dismissed)
            .map((t) => {
              const shifted = doppler.find((d) => d.id === t.id);
              return {
                id: t.id,
                label: t.label,
                mode: t.mode,
                uplinkHz: t.uplinkHz,
                downlinkHz: t.downlinkHz,
                uplinkToneHz: t.uplinkToneHz,
                downlinkToneHz: t.downlinkToneHz,
                dopplerUplinkHz: shifted?.uplinkHz ?? null,
                dopplerDownlinkHz: shifted?.downlinkHz ?? null,
              };
            })}
          upcomingPassesAnchorId={UPCOMING_PASSES_ANCHOR_ID}
        />

        <SatelliteDetailPanel satellite={satellite} />

        <div className={classes.mapAndGlobe}>
          <div className={classes.mapViewport}>
            <SatelliteLiveMap
              satelliteName={satellite.name}
              tleLine1={satellite.tleLine1}
              tleLine2={satellite.tleLine2}
              meanMotionRevPerDay={satellite.meanMotionRevPerDay}
              orbitTrailMultiple={orbitTrailMultiple}
            />
            <div className={classes.renderControls}>
              <TextInput
                label="Orbits ahead/behind"
                type="number"
                min={MIN_ORBIT_TRAIL_MULTIPLE}
                max={MAX_ORBIT_TRAIL_MULTIPLE}
                step={ORBIT_TRAIL_STEP}
                value={orbitTrailMultiple}
                onChange={(event) =>
                  setOrbitTrailMultiple(clampOrbitTrailMultiple(Number(event.target.value)))
                }
              />
            </div>
          </div>
          <div className={classes.mapViewport}>
            <div className={classes.globeContainer}>
              <Suspense fallback={<div className={classes.globeLoading}>Loading 3D globe…</div>}>
                <SatelliteGlobe
                  observer={settings?.location ?? null}
                  satellites={[
                    {
                      id: satellite.id,
                      name: satellite.name,
                      noradId: satellite.noradId,
                      tleLine1: satellite.tleLine1,
                      tleLine2: satellite.tleLine2,
                      meanMotionRevPerDay: satellite.meanMotionRevPerDay,
                    },
                  ]}
                  interestedSatelliteIds={new Set([satellite.id])}
                  highlightedSatelliteIds={new Set()}
                  pollIntervalMs={2000}
                  lookBehindMin={globeLookBehindMin}
                  lookAheadMin={globeLookAheadMin}
                />
              </Suspense>
            </div>
            <div className={classes.renderControls}>
              <TextInput
                label="Look behind (min)"
                type="number"
                min={MIN_GLOBE_TRAIL_MIN}
                max={MAX_GLOBE_TRAIL_MIN}
                step={GLOBE_TRAIL_STEP_MIN}
                value={globeLookBehindMin}
                onChange={(event) =>
                  setGlobeLookBehindMin(
                    clampGlobeTrailMinutes(Number(event.target.value), globeLookBehindMin),
                  )
                }
              />
              <TextInput
                label="Look ahead (min)"
                type="number"
                min={MIN_GLOBE_TRAIL_MIN}
                max={MAX_GLOBE_TRAIL_MIN}
                step={GLOBE_TRAIL_STEP_MIN}
                value={globeLookAheadMin}
                onChange={(event) =>
                  setGlobeLookAheadMin(
                    clampGlobeTrailMinutes(Number(event.target.value), globeLookAheadMin),
                  )
                }
              />
            </div>
          </div>
        </div>

        <div className={classes.passLists}>
          <SatellitePassList
            id={UPCOMING_PASSES_ANCHOR_ID}
            title="Upcoming passes"
            emptyMessage={`No upcoming passes in the next ${FUTURE_WINDOW_HOURS} hours.`}
            passes={future.passes}
            loading={future.loading}
            error={future.error}
            hasObserver={future.hasObserver}
            countdownRowLimit={3}
          />
          <SatellitePassList
            title="Past passes"
            emptyMessage={`No passes in the last ${PAST_WINDOW_HOURS} hours.`}
            passes={past.passes}
            loading={past.loading}
            error={past.error}
            hasObserver={past.hasObserver}
          />
        </div>
      </div>
    </DesignSystemV2Provider>
  );
}
