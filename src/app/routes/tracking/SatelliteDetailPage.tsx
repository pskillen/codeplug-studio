import { Suspense, lazy, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { IconRefresh } from '@tabler/icons-react';
import LibraryInventoryHeader from '../../components/library/LibraryInventoryHeader.tsx';
import NextPassCard from '../../components/NextPassCard/NextPassCard.tsx';
import SatelliteLiveMap from '../../components/SatelliteLiveMap/SatelliteLiveMap.tsx';
import { Button, DesignSystemV2Provider } from '../../components/v2/index.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useSatelliteEnrichment } from '../../state/satelliteEnrichment.tsx';
import { useTrackingSettings } from '../../state/useTrackingSettings.ts';
import libraryPageClasses from '../../components/library/LibraryInventoryPage.module.css';
import { isPassActive, pickPrimaryTransmitterMode } from './passTime.ts';
import SatelliteDetailPanel from './SatelliteDetailPanel.tsx';
import SatellitePassList from './SatellitePassList.tsx';
import { useDopplerShiftedFrequencies } from './useDopplerShiftedFrequencies.ts';
import { useNowTick } from './useNowTick.ts';
import { usePassesForSatellite } from './usePassesForSatellite.ts';
import classes from './SatelliteDetailPage.module.css';

const SatelliteGlobe = lazy(() => import('../../components/SatelliteGlobe/SatelliteGlobe.tsx'));

const UPCOMING_PASSES_ANCHOR_ID = 'upcoming-passes';

const FUTURE_WINDOW_HOURS = 72;
const PAST_WINDOW_HOURS = 72;

export default function SatelliteDetailPage() {
  const { satelliteId } = useParams();
  const navigate = useNavigate();
  const { library, loading } = useLibrary();
  const { getEnrichmentForNoradId, refreshEnrichmentForNoradIds } = useSatelliteEnrichment();
  const [refreshingSatnogs, setRefreshingSatnogs] = useState(false);
  const [satnogsError, setSatnogsError] = useState<string | null>(null);
  const satellite = satelliteId
    ? (library.satellites.find((s) => s.id === satelliteId) ?? null)
    : null;
  const enrichment = satellite ? getEnrichmentForNoradId(satellite.noradId) : null;

  async function handleRefreshSatnogs() {
    if (!satellite) return;
    setRefreshingSatnogs(true);
    setSatnogsError(null);
    try {
      const result = await refreshEnrichmentForNoradIds([satellite.noradId], { refresh: true });
      if (result.failures.length > 0) {
        setSatnogsError(result.failures[0]?.message ?? 'SatNOGS refresh failed.');
      }
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
    satellite?.uplinkHz,
    satellite?.downlinkHz,
    observerLocation,
    nextPassActive,
    nowMs,
  );
  const primaryMode = pickPrimaryTransmitterMode(enrichment?.transmitters);

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
          uplinkHz={satellite.uplinkHz}
          downlinkHz={satellite.downlinkHz}
          uplinkToneHz={satellite.uplinkToneHz}
          downlinkToneHz={satellite.downlinkToneHz}
          mode={primaryMode}
          dopplerUplinkHz={doppler.uplinkHz}
          dopplerDownlinkHz={doppler.downlinkHz}
          upcomingPassesAnchorId={UPCOMING_PASSES_ANCHOR_ID}
        />

        <SatelliteDetailPanel satellite={satellite} enrichment={enrichment} />

        <div className={classes.mapAndGlobe}>
          <SatelliteLiveMap
            satelliteName={satellite.name}
            tleLine1={satellite.tleLine1}
            tleLine2={satellite.tleLine2}
            meanMotionRevPerDay={satellite.meanMotionRevPerDay}
          />
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
              />
            </Suspense>
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
