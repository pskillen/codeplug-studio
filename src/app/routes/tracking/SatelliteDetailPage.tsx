import { Link, useParams } from 'react-router-dom';
import LibraryInventoryHeader from '../../components/library/LibraryInventoryHeader.tsx';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import libraryPageClasses from '../../components/library/LibraryInventoryPage.module.css';

export default function SatelliteDetailPage() {
  const { satelliteId } = useParams();
  const { library, loading } = useLibrary();
  const satellite = satelliteId
    ? (library.satellites.find((s) => s.id === satelliteId) ?? null)
    : null;

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
        <LibraryInventoryHeader title={satellite.name} subtitle={`NORAD ${satellite.noradId}`} />
      </div>
    </DesignSystemV2Provider>
  );
}
