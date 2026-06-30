import 'leaflet/dist/leaflet.css';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import { Alert, Paper } from '@mantine/core';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { bandLabelForFrequencyHz } from '@core/domain/bandPlan.ts';
import { useLibrary } from '../state/useLibrary.ts';
import { defaultMarkerIcon } from '../components/map/leafletSetup.ts';
import { ListPage, PageSection } from '../components/ui/index.ts';

const UK_CENTRE: LatLngExpression = [54.5, -3];

export default function MapPage() {
  const { library, loading } = useLibrary();

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
    <ListPage
      title="Map"
      description={
        loading
          ? 'Loading channels…'
          : `${located.length} channel${located.length === 1 ? '' : 's'} with a location.`
      }
    >
      <PageSection>
        <Paper withBorder radius="md" style={{ height: 520, overflow: 'hidden' }}>
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
        </Paper>
        {!loading && located.length === 0 ? (
          <Alert color="blue" mt="md">
            No channels have a location yet. Add coordinates in the{' '}
            <Link to="/library">library</Link> or import from a repeater directory when creating a
            channel.
          </Alert>
        ) : null}
      </PageSection>
    </ListPage>
  );
}
