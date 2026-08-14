# HfPropagationGlobe

## Purpose

Renders the 3D propagation globe for the [HF/RF propagation visualiser](../../../../docs/features/hf-propagation/README.md) — D/E/F1/F2 ionospheric shells as concentric translucent spheres (`customThreeObject` / `customLayerData`), plus traced ray paths, a skip-zone ring, and a transmitter marker (`pathsData` / `pointsData` coexist with the shells). Same [`react-globe.gl`](https://github.com/vasturiano/react-globe.gl) stack as [`SatelliteGlobe`](../SatelliteGlobe/SatelliteGlobe.md).

## Props

| Prop              | Type                      | Notes                                                                                                                                                                                                                                                                                                                                 |
| ----------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layers`          | `IonosphericLayerState[]` | Layer state from `computeIonosphericLayers`. Operator hide still applies. With `environmentAtMs`, all four shells are drawn and the shader varies them by sun hemisphere (D/F1 fade at night; F2 radius drops into F1's band). Without it, a shell is drawn only when physics-`active`.                                               |
| `rays`            | `RayPathResult[]`         | Optional, default `[]`. Worker-traced paths for the primary azimuth. Mapped by `rayResultsToGlobePaths` onto `pathsData` (altitude as globe-radius units). Colour/dash from `MODE_COLORS` / `propagationPathDashLength` keyed on `PropagationMode` — not `colorForLayer`. Skip-zone ring appended when a skywave/NVIS landing exists. |
| `display`         | `ShellDisplayOptions`     | Optional. `{ exaggerationFactor, explodeEnabled, fresnelEnabled, terminatorEnabled? }`. Omit for true-scale shells (factor `1`, explode/Fresnel/terminator off). The page passes live Display-panel state. Greyline + sun marker follow `terminatorEnabled`; night-side shade follows `environmentAtMs`.                              |
| `visibleLayers`   | `LayerVisibility`         | Optional. `{ D, E, F1, F2 }` booleans, default all `true`. Operator hide is independent of TX-local physics `active`. Explode indices stay canonical by id.                                                                                                                                                                           |
| `environmentAtMs` | `number`                  | Optional. Instant for spatially varying shells, night-side shade, greyline, and sun marker. Required for terminator overlay.                                                                                                                                                                                                          |

## Usage

```tsx
import { lazy, Suspense } from 'react';

const HfPropagationGlobe = lazy(
  () => import('../../components/HfPropagationGlobe/HfPropagationGlobe.tsx'),
);

<Suspense fallback={<div>Loading 3D globe…</div>}>
  <HfPropagationGlobe
    layers={layers}
    display={{ exaggerationFactor: 2.5, explodeEnabled: false, fresnelEnabled: true }}
    visibleLayers={{ D: true, E: true, F1: true, F2: true }}
    environmentAtMs={Date.now()}
    rays={rays}
  />
</Suspense>;
```

`HfPropagationPage.tsx` renders this only when its View `SegmentedControl` is set to the `'globe'` option — the other two views (top-down, vertical slice) are separate, not-yet-implemented panels (#1171, #1172).

## Behaviour

- **Sizing:** measures its own container via `ResizeObserver` and passes explicit `width`/`height` to `Globe` — identical convention to `SatelliteGlobe` (`react-globe.gl` defaults to the _window's_ size otherwise, not its container's).
- **Shells:** one `THREE.Mesh` (unit sphere, scaled in the vertex shader, semi-transparent `MeshBasicMaterial`) per operator-visible layer in `customLayerData`. Geometry lives in `buildGlobeData.ts` (`buildShellMesh`, `displayShellRadiusUnits`) — `buildShellMesh` was moved here from `HfPropagationGlobe.tsx` so exaggeration/explode math sits next to the mesh builder. Colour still comes from `colorForLayer(id)`, not a field on `IonosphericLayerState`. Baseline opacity steps outward from D `0.28` by `0.05` per layer (E `0.23`, F1 `0.18`, F2 `0.13`); Fresnel min/max scale with the same ratio. `mesh.renderOrder` paints **outer first, inner last** (`F2→D`) so D/E are not buried — all shells share the globe origin, so Three's transparent distance-sort is insertion-unstable without this.
- **Spatial day/night:** when `environmentAtMs` is set, each shell is stamped with the subsolar point. The vertex shader mixes F2's radius from the daytime mid-altitude (250–400 km) down to the merged night band (150–400 km) on the night hemisphere; D and F1 fragment alpha go to 0 at night (D thins along the terminator). E dims but stays. This is **not** the TX-local `active` flag — that still drives the Reading-panel fc. Explode offsets stay canonical (`D=0…F2=3`) so they do not jump.
- **Display controls** (`display` prop):
  - **Altitude exaggeration** — `exaggeratedAltitudeKm` multiplies mid-altitude when `exaggerationFactor > 1` (range 1×–10×). Factor `≤ 1` is a no-op (true scale). Page default **2.5× on**.
  - **Exploded stacking** — `explodeOffsetUnits` adds `canonicalLayerIndex(id) * 0.15` globe-radius units (`D=0` … `F2=3`, canonical id order so night-time or operator-hidden F2 still sits outermost). Independent of exaggeration. Page default **off**.
  - **Fresnel shading** — per-fragment opacity `mix(0.05, 0.40, pow(1 - \|N·V\|, 2))` scaled by the layer's baseline/0.28 ratio when on; stepped baseline when off. Injected via `MeshBasicMaterial.onBeforeCompile`. `react-globe.gl`'s `customThreeObjectUpdate` only runs on data updates, not every frame, so a `requestAnimationFrame` loop pushes the enable flag; Three's built-in `cameraPosition` drives the view vector. Page default **on**.
  - **Day/night terminator** — Display toggle, default **off**. When on, `computeSolarTerminator(environmentAtMs)` feeds a dashed `pathsData` greyline (`#fff6c8`, altitude 0.014 globe-radii, above the night-shade sphere) split at the antimeridian, plus `buildSunMarkerMesh` (yellow sphere at **3×** true-scale F2 outer radius). Night-side shade (`buildNightShadeMesh`, ~0.48 alpha) is **always** on whenever `environmentAtMs` is set, so the night hemisphere stays darker even with the overlay off.
  - **Per-layer visibility** — Display-panel toggles (D/E/F1/F2) with a 12px swatch from `colorForLayer`. D/F1 remain togglable at night because they still exist on the day hemisphere.
- **Colour:** `colorForLayer(id)` in `src/core/domain/hfPropagation/layerColor.ts` — inner D `#ff6b6b` (red, contrasts against oceans) through E `#f5c451`, F1 `#3ddc97`, outer F2 `#5ec8ff` (cyan-blue). **Ray paths** use a separate `MODE_COLORS` map in `buildGlobeData.ts` (groundwave `#4d7cff`, skywave `#3ddc97`, NVIS `#f5a623`, absorbed `#8b3a3a`, escaped `#666666`) — do not merge with layer colours. Dash style in `globePathDash.ts` is keyed on `PropagationMode` (solid groundwave; dashed skywave/NVIS; sparser absorbed/escaped). Skip-zone ring is neutral `#c8c8d4`.
- **Rays / skip zone / TX:** `rays` → `pathsData` plus an isotropic skip-zone ring from `computePropagationRing` / `skipZoneOuterRadiusM` (`src/core/domain/hfPropagation/footprint.ts`) at the nearest skywave/NVIS landing. Transmitter marker is a `pointsData` point at the placeholder TX (0°, 0°), observer-style. Static mode legend overlays the globe (always visible, no hover).
- **`GLOBE_RADIUS_UNITS = 100`:** `three-globe`'s own internal scene-unit globe radius (pinned copy of `GLOBE_RADIUS` in `three-globe`'s source — not exported from the package). `customThreeObject` positions objects in these scene units, not the `0`–`1`+ altitude units `react-globe.gl`'s own `pointAltitude`/`pathPointAlt` accessors use.
- **Data:** daytime altitude bands are D 60–90 km, E 90–150 km, F1 150–250 km, F2 250–400 km. On the night hemisphere F2's lower bound drops to **150 km** (merged F-region) while D/F1 fade out. TX-local `computeIonosphericLayers` still sets `active` / `peakElectronDensity` / F2 bounds for the Reading panel and later ray tracing. `customThreeObjectUpdate` remains data-only; Fresnel + day/night live in `MeshBasicMaterial.onBeforeCompile` (`hf-shell-fresnel-daynight`). Cutaway (11a) must target those uniforms, not a custom ShaderMaterial.

## Testing

`react-globe.gl` needs a WebGL context jsdom doesn't provide, so `HfPropagationGlobe.test.tsx` mocks it to a stub component and asserts the `customLayerData`/`customThreeObject`/`customThreeObjectUpdate`/`pathsData`/`pointsData` props it receives (including that operator-hidden layers are filtered out, that an environment instant keeps D/F1 for spatial shading and adds night-shade, that terminator-on adds the sun marker plus a greyline path, and that `rays` add mode-coloured paths, a skip-zone ring, and a transmitter point). Radius / path-mapping math lives in `buildGlobeData.test.ts`. Dash fractions: `globePathDash.test.ts`. Terminator / subsolar math: `solarTerminator.test.ts`. Ring geometry: `footprint.test.ts`. Debounced Worker fetch: `usePropagationRayTrace.test.ts`.

## Related

- [HF/RF propagation visualiser hub](../../../../docs/features/hf-propagation/README.md)
- [`SatelliteGlobe`](../SatelliteGlobe/SatelliteGlobe.md) — sibling 3D globe on the Tracking Dashboard; same `react-globe.gl`/sizing/testing conventions
- [`HfPropagationPage.tsx`](../../routes/reference/HfPropagationPage.tsx) — sole caller, gates rendering on the View switcher
