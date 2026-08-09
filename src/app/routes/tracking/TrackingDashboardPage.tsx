import { useState } from 'react';
import { Link } from 'react-router-dom';
import LibraryInventoryHeader from '../../components/library/LibraryInventoryHeader.tsx';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';
import SatelliteTrackMap, {
  type SelectedPass,
} from '../../components/SatelliteTrackMap/SatelliteTrackMap.tsx';
import { useTrackingSettings } from '../../state/useTrackingSettings.ts';
import ObserverLocationSettings from './ObserverLocationSettings.tsx';
import PassGrid from './PassGrid.tsx';
import { useTrackingPasses, type SatellitePassRow } from './useTrackingPasses.ts';
import classes from './TrackingDashboardPage.module.css';
import libraryPageClasses from '../../components/library/LibraryInventoryPage.module.css';

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
  const { passes, loading, error, hasObserver, hasEnabledSatellites } = useTrackingPasses();
  const { settings } = useTrackingSettings();
  const [selectedPass, setSelectedPass] = useState<SelectedPass | null>(null);

  return (
    <DesignSystemV2Provider>
      <div className={libraryPageClasses.page}>
        <LibraryInventoryHeader
          title="Tracking Dashboard"
          subtitle="Upcoming satellite passes over the next 72 hours."
        />

        <ObserverLocationSettings />

        <div className={classes.map}>
          <SatelliteTrackMap observer={settings?.location ?? null} selectedPass={selectedPass} />
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
            passes={passes}
            loading={loading}
            error={error}
            onSelectPass={(row) => setSelectedPass(toSelectedPass(row))}
          />
        )}
      </div>
    </DesignSystemV2Provider>
  );
}
