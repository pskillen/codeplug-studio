# Feature design: Satellite tracking dashboard

**Purpose:** Post-MVP product design for client-side pass prediction, SatNOGS augmentation, and Tracking Dashboard 3D/2D visualization. Hub status and tickets live in [README.md](README.md). Epic: [#860](https://github.com/pskillen/codeplug-studio/issues/860). Depends on keps library [#848](https://github.com/pskillen/codeplug-studio/issues/848).

UI “neon war room” notes below are illustrative — implement against Studio styleguide / existing map chrome.

## 1. Architectural Strategy (Client-Side Only)

Given the constraint of a React + TS + Vite stack with **no backend**, all orbital mechanics, propagation math, and visualization rendering must occur strictly in the user's browser.

- **Orbital Engine:** The standard JS library for calculating satellite positions from TLEs using the SGP4 model is `satellite.js`.
- **Performance:** Computing future passes for dozens of LEO satellites over several days requires significant CPU cycles. These calculations **must** be offloaded to Web Workers to prevent the React UI thread from freezing.
- **Data Aggregation:** Because we lack a backend database to join TLEs with radio frequencies and operational status, the browser will need to fetch and merge data from multiple external REST APIs (handling potential CORS issues, possibly relying on public APIs that allow cross-origin requests).

## 2. Feature: Local Pass Prediction Engine

Before rendering visualizations, the app needs to calculate when satellites will actually be overhead.

### Location Input UI

The UI must establish the "Observer" coordinates. This should be a persistent setting module at the top of the Tracking dashboard:

- **Auto-Detect:** Button using the HTML5 Geolocation API (`navigator.geolocation`).
- **Maidenhead Locator:** Text input for standard 4 or 6-character grid squares (e.g., `IO85`). We can use a lightweight JS utility to convert this to Lat/Lon.
- **Address Lookup:** A search bar utilizing a free, client-side-friendly geocoding API like OpenStreetMap Nominatim (`https://nominatim.openstreetmap.org/search`).
- **Map Pick:** A small minimap allowing the user to drop a pin.

### Pass Calculation (Web Worker)

Once coordinates and TLEs are known, a Web Worker sweeps time forward (e.g., 1-minute increments over the next 72 hours) using `satellite.js` to find:

- **AOS (Acquisition of Signal):** When elevation > 0°.
- **Max Elevation:** The peak of the pass.
- **LOS (Loss of Signal):** When elevation < 0°.

## 3. Feature: Rich Filtering & Data Augmentation

The output of the prediction engine feeds into a highly interactive, sortable data grid.

### Data Sources for Augmentation

TLEs only provide orbital paths, not radio capabilities. To filter by mode or check health, the client will need to query external databases:

- **SatNOGS DB API:** The most comprehensive open database. (`https://db.satnogs.org/api/`). It provides transmitter frequencies, modes (FM, AFSK, SSTV), and operational status (Alive, Dead, Re-entered).
- **Note on CORS:** If SatNOGS enforces CORS, you may need a completely free, zero-maintenance serverless proxy (like a Cloudflare Worker) just to pass the JSON to your frontend.

### The UI Data Grid

A robust table component (e.g., using TanStack Table or AG Grid) displaying upcoming passes.

- **Columns:** Satellite Name, AOS Time (Local & UTC), LOS Time, Duration, Max Elevation, Uplink/Downlink Freqs, Mode, Status.
- **Sorting:** Default by `AOS Time` (ascending).
- **Quick Filters (Checkboxes/Toggles):**
  - *Elevation:* "Only show passes > 20°" (low passes are often blocked by local terrain).
  - *Band:* 2m / 70cm / 23cm / Microwave.
  - *Mode:* FM Voice / SSB / Digital (APRS) / SSTV.
  - *Status:* "Hide inactive/dead satellites."

## 4. Feature: 3D Orbital Visualization

A "war room" style visualization of the Earth, providing an intuitive understanding of where satellites are *right now*.

### Tech Stack Recommendation

- `react-globe.gl`: A highly performant React wrapper around `Globe.gl` (which uses Three.js). It handles map tiles, 3D math, and object rendering seamlessly.

### UI/UX Design

- **Layout:** A large, responsive canvas taking up the top half of the screen or full screen with a sliding side panel.
- **The Globe:** Textured with satellite imagery or a clean, stylized vector look (e.g., dark mode neon green/blue).
- **User Location:** A distinct glowing beacon or marker on the globe.
- **Satellite Rendering:**
  - Render selected satellites as moving icons or dots.
  - **Orbit Trails:** Draw a line showing the predicted path for the next 90 minutes (one orbit).
  - **Footprint (Visibility Circle):** A translucent colored circle projected onto the Earth's surface directly beneath the satellite. If the user's location falls within this circle, they have AOS.
- **Interactivity:** Clicking a satellite on the globe filters the 2D Pass Data Grid below it to show only that specific satellite's upcoming passes.

## 5. Feature: 2D Map Visualization

While 3D is impressive, a 2D map is often easier for reading precise ground tracks (the path the satellite sweeps across a traditional map).

### Tech Stack Recommendation

- `react-leaflet`: The React standard for 2D mapping (wrapping Leaflet.js). Highly compatible with free OpenStreetMap tiles.

### UI/UX Design

- **Layout:** A toggle switch next to the 3D globe: `[ 3D Globe | 2D Map ]`.
- **Ground Tracks:** Draw the satellite's path as an SVG polyline across the map.
- **Current Position:** A custom icon moving along the path in real-time.
- **Footprint Overlay:** A dynamic, moving polygon circle around the satellite representing the RF footprint. (Note: On a 2D Mercator projection, this footprint circle distorts into an oval or complex shape at higher latitudes; libraries like Turf.js can help calculate these polygons).
- **Upcoming Passes (Static projection):** When a user clicks a specific future pass in the Data Grid, the 2D map should draw *that specific future ground track*, allowing the user to see exactly where the satellite will rise and set relative to their specific location.

## 6. Suggested Page Structure in Codeplug Studio

To keep the UI clean, this should live in its own distinct area away from the main library editing tools.

- **Sidebar Navigation:** Add a new primary nav item: `Tracking Dashboard`.
- **Top Bar:** Global settings (Location Input, Current UTC/Local Time).
- **Main Content Area (Split View):**
  - **Top Half:** Viewport toggleable between the 3D Globe and 2D Map. Features a floating toolbar for filtering which active satellites are rendered.
  - **Bottom Half:** The interactive Data Grid showing the predicted passes. Clicking a row highlights that pass/satellite in the map above.

