import { Link, useNavigate, useParams } from 'react-router-dom';
import LibraryInventoryHeader from '../../components/library/LibraryInventoryHeader.tsx';
import { Button, DesignSystemV2Provider } from '../../components/v2/index.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import libraryPageClasses from '../../components/library/LibraryInventoryPage.module.css';
import SatelliteDetailPanel from './SatelliteDetailPanel.tsx';

export default function SatelliteDetailPage() {
  const { satelliteId } = useParams();
  const navigate = useNavigate();
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
      </div>
    </DesignSystemV2Provider>
  );
}
