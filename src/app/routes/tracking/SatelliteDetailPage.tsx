import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import LibraryInventoryHeader from '../../components/library/LibraryInventoryHeader.tsx';
import { Button, DesignSystemV2Provider } from '../../components/v2/index.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import libraryPageClasses from '../../components/library/LibraryInventoryPage.module.css';
import SatelliteDetailPanel from './SatelliteDetailPanel.tsx';
import SatellitePassList from './SatellitePassList.tsx';
import { usePassesForSatellite } from './usePassesForSatellite.ts';
import classes from './SatelliteDetailPage.module.css';

const FUTURE_WINDOW_HOURS = 72;
const PAST_WINDOW_HOURS = 72;

export default function SatelliteDetailPage() {
  const { satelliteId } = useParams();
  const navigate = useNavigate();
  const { library, loading } = useLibrary();
  const satellite = satelliteId
    ? (library.satellites.find((s) => s.id === satelliteId) ?? null)
    : null;

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
            <Button
              variant="secondary"
              onClick={() => navigate(`/library/satellite-keps/${satellite.id}`)}
            >
              Edit uplink/downlink…
            </Button>
          }
        />

        <SatelliteDetailPanel satellite={satellite} />

        <div className={classes.passLists}>
          <SatellitePassList
            title="Upcoming passes"
            emptyMessage={`No upcoming passes in the next ${FUTURE_WINDOW_HOURS} hours.`}
            passes={future.passes}
            loading={future.loading}
            error={future.error}
            hasObserver={future.hasObserver}
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
