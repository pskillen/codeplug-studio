import { Link } from 'react-router-dom';
import LibraryInventoryHeader from '../../components/library/LibraryInventoryHeader.tsx';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';
import ObserverLocationSettings from './ObserverLocationSettings.tsx';
import PassGrid from './PassGrid.tsx';
import { useTrackingPasses } from './useTrackingPasses.ts';
import classes from './TrackingDashboardPage.module.css';
import libraryPageClasses from '../../components/library/LibraryInventoryPage.module.css';

export default function TrackingDashboardPage() {
  const { passes, loading, error, hasObserver, hasEnabledSatellites } = useTrackingPasses();

  return (
    <DesignSystemV2Provider>
      <div className={libraryPageClasses.page}>
        <LibraryInventoryHeader
          title="Tracking Dashboard"
          subtitle="Upcoming satellite passes over the next 72 hours."
        />

        <ObserverLocationSettings />

        <div className={classes.viewportPlaceholder}>
          Ground-track map coming soon — pick a pass below to preview it here.
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
          <PassGrid passes={passes} loading={loading} error={error} />
        )}
      </div>
    </DesignSystemV2Provider>
  );
}
