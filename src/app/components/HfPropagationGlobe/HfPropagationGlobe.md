# HfPropagationGlobe

## Purpose

Renders the 3D propagation globe for the [HF/RF propagation visualiser](../../../../docs/features/hf-propagation/README.md) — currently the D/E/F1/F2 ionospheric shells as concentric translucent spheres, using [`react-globe.gl`](https://github.com/vasturiano/react-globe.gl)'s `customThreeObject`/`customLayerData` extension point (`three`/`three-globe` underneath, same stack as [`SatelliteGlobe`](../SatelliteGlobe/SatelliteGlobe.md)). Ray paths and a transmitter marker are planned for a later phase (#1170).

## Props

| Prop              | Type                      | Notes                                                                                                                                                                                                      |
| ----------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layers`          | `IonosphericLayerState[]` | Day/night-aware layer state from `computeIonosphericLayers`. A shell is drawn only when `active` **and** the operator has not hidden it.                                                                   |
| `display`         | `ShellDisplayOptions`     | Optional. `{ exaggerationFactor, explodeEnabled, fresnelEnabled, terminatorEnabled? }`. Omit for true-scale shells (factor `1`, explode/Fresnel/terminator off). The page passes live Display-panel state. |
| `visibleLayers`   | `LayerVisibility`         | Optional. `{ D, E, F1, F2 }` booleans, default all `true`. Operator hide is independent of physics `active` (day/night). Explode indices stay canonical by id.                                             |
| `environmentAtMs` | `number`                  | Optional. Instant for the greyline ring, night-side shade, and sun marker. Required when `display.terminatorEnabled` is true.                                                                              |

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
  />
</Suspense>;
```

`HfPropagationPage.tsx` renders this only when its View `SegmentedControl` is set to the `'globe'` option — the other two views (top-down, vertical slice) are separate, not-yet-implemented panels (#1171, #1172).

## Behaviour

- **Sizing:** measures its own container via `ResizeObserver` and passes explicit `width`/`height` to `Globe` — identical convention to `SatelliteGlobe` (`react-globe.gl` defaults to the _window's_ size otherwise, not its container's).
- **Shells:** one `THREE.Mesh` (sphere geometry, semi-transparent `MeshBasicMaterial`) per layer that is physics-`active` **and** operator-visible, in `customLayerData`. Geometry lives in `buildGlobeData.ts` (`buildShellMesh`, `displayShellRadiusUnits`) — `buildShellMesh` was moved here from `HfPropagationGlobe.tsx` so exaggeration/explode math sits next to the mesh builder. Colour still comes from `colorForLayer(id)`, not a field on `IonosphericLayerState`. Baseline opacity steps outward from D `0.28` by `0.05` per layer (E `0.23`, F1 `0.18`, F2 `0.13`); Fresnel min/max scale with the same ratio. `mesh.renderOrder` paints **outer first, inner last** (`F2→D`) so D/E are not buried — all shells share the globe origin, so Three's transparent distance-sort is insertion-unstable without this.
- **Display controls** (`display` prop):
  - **Altitude exaggeration** — `exaggeratedAltitudeKm` multiplies mid-altitude when `exaggerationFactor > 1` (range 1×–10×). Factor `≤ 1` is a no-op (true scale). Page default **2.5× on**.
  - **Exploded stacking** — `explodeOffsetUnits` adds `canonicalLayerIndex(id) * 0.15` globe-radius units (`D=0` … `F2=3`, canonical id order so night-time or operator-hidden F2 still sits outermost). Independent of exaggeration. Page default **off**.
  - **Fresnel shading** — per-fragment opacity `mix(0.05, 0.40, pow(1 - \|N·V\|, 2))` scaled by the layer's baseline/0.28 ratio when on; stepped baseline when off. Injected via `MeshBasicMaterial.onBeforeCompile`. `react-globe.gl`'s `customThreeObjectUpdate` only runs on data updates, not every frame, so a `requestAnimationFrame` loop pushes the enable flag; Three's built-in `cameraPosition` drives the view vector. Page default **on**.
  - **Day/night terminator** — Display toggle, default **off**. When on, `computeSolarTerminator(environmentAtMs)` feeds a dashed `pathsData` greyline (`#cfd3dc`, altitude 0.004 globe-radii) split at the antimeridian; a slightly oversized custom sphere (`buildNightShadeMesh`) tints only the night hemisphere (~0.15 alpha via `dot(normal, sunDir)`); `buildSunMarkerMesh` places a small yellow sphere along the subsolar vector at **3×** true-scale F2 outer radius (not to scale, no exaggeration/explode/Fresnel). Same toggle for ring, shade, and sun.
  - **Per-layer visibility** — Display-panel toggles (D/E/F1/F2) with a 12px swatch from `colorForLayer`. Night-time D/F1 stay in the panel but the switch is disabled with a “not present (night)” hint so operator-hide and physics-absent stay distinguishable.
- **Colour:** `colorForLayer(id)` in `src/core/domain/hfPropagation/layerColor.ts` — inner D `#ff6b6b` (red, contrasts against oceans) through E `#f5c451`, F1 `#3ddc97`, outer F2 `#5ec8ff` (cyan-blue). Shared with later top-down / vertical-slice views.
- **`GLOBE_RADIUS_UNITS = 100`:** `three-globe`'s own internal scene-unit globe radius (pinned copy of `GLOBE_RADIUS` in `three-globe`'s source — not exported from the package). `customThreeObject` positions objects in these scene units, not the `0`–`1`+ altitude units `react-globe.gl`'s own `pointAltitude`/`pathPointAlt` accessors use.
- **Data:** `layers` from `computeIonosphericLayers` (D 60–90 km day-only, E 90–150 km, F1 150–250 km day-only, F2 250–400 km by day). At night F2's lower bound drops to **150 km** so the remaining F-region fills F1's band. Inactive D/F1 shells are omitted at night; operator-hidden shells are omitted even when physics-active. Day/night is **one global** `isDaylight` at the TX site, not a spatially varying mesh.

## Testing

`react-globe.gl` needs a WebGL context jsdom doesn't provide, so `HfPropagationGlobe.test.tsx` mocks it to a stub component and asserts the `customLayerData`/`customThreeObject`/`customThreeObjectUpdate`/`pathsData` props it receives (including that physics-inactive and operator-hidden layers are filtered out, and that terminator-on adds night-shade + sun custom objects plus a greyline path). Radius math lives in `buildGlobeData.test.ts` (`exaggeratedAltitudeKm`, `explodeOffsetUnits`, `displayShellRadiusUnits`, `fresnelOpacity`, `shellRadiusUnits`, `canonicalLayerIndex`, `shellBaselineOpacity`, `latLonToGlobeDirection`, `buildTerminatorPaths`). Terminator / subsolar math: `solarTerminator.test.ts`.

## Related

- [HF/RF propagation visualiser hub](../../../../docs/features/hf-propagation/README.md)
- [`SatelliteGlobe`](../SatelliteGlobe/SatelliteGlobe.md) — sibling 3D globe on the Tracking Dashboard; same `react-globe.gl`/sizing/testing conventions
- [`HfPropagationPage.tsx`](../../routes/reference/HfPropagationPage.tsx) — sole caller, gates rendering on the View switcher
