import 'leaflet/dist/leaflet.css';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { bandLabelForFrequencyHz } from '@core/domain/bandPlan.ts';
import { useLibrary } from '../state/useLibrary.ts';
import { defaultMarkerIcon } from '../components/map/leafletSetup.ts';

const UK_CENTRE: LatLngExpression = [54.5, -3];

export default function MapPage() {
  const { library, loading, projectId } = useLibrary();

  if (!projectId) {
    return (
      <section>
        <h1 style={{ marginTop: 0 }}>Map</h1>
        <p style={{ color: '#52606d' }}>
          Select or create a project on the <Link to="/">Projects</Link> page first.
        </p>
      </section>
    );
  }

  const located = library.channels
    .filter((c) => c.useLocation && c.location !== null)
    .map((c) => ({
      id: c.id,
      name: c.name,
      band: bandLabelForFrequencyHz(c.rxFrequency),
      lat: c.location!.lat,
      lon: c.location!.lon,
    }));

  const bounds: LatLngBoundsExpression | undefined =
    located.length > 0 ? located.map((c) => [c.lat, c.lon] as [number, number]) : undefined;

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Map</h1>
      <p style={{ color: '#52606d' }}>
        {loading
          ? 'Loading channels…'
          : `${located.length} channel${located.length === 1 ? '' : 's'} with a location.`}
      </p>
      <div
        style={{
          height: 520,
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid #e4e7eb',
        }}
      >
        <MapContainer
          center={UK_CENTRE}
          zoom={5}
          bounds={bounds}
          boundsOptions={{ padding: [40, 40], maxZoom: 11 }}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {located.map((c) => (
            <Marker key={c.id} position={[c.lat, c.lon]} icon={defaultMarkerIcon}>
              <Popup>
                <strong>{c.name}</strong>
                <br />
                {c.band}
                <br />
                <Link to={`/library/channels/${c.id}`}>Edit channel</Link>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      {!loading && located.length === 0 && (
        <p style={{ color: '#7b8794', marginTop: '0.75rem' }}>
          No channels have a location yet. Add one in the <Link to="/library">Library</Link> or
          import from the <Link to="/repeaters">Repeaters</Link> directory.
        </p>
      )}
    </section>
  );
}
