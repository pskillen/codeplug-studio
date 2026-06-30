import * as L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Vite serves bundled asset URLs; Leaflet's default relative icon paths break,
// so point the default icon at the imported asset URLs once on load.
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });
