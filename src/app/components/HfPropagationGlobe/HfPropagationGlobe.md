# HfPropagationGlobe

## Purpose

Renders the 3D propagation globe for the [HF/RF propagation visualiser](../../../../docs/features/hf-propagation/README.md) — currently the D/E/F1/F2 ionospheric shells as concentric translucent spheres, using [`react-globe.gl`](https://github.com/vasturiano/react-globe.gl)'s `customThreeObject`/`customLayerData` extension point (`three`/`three-globe` underneath, same stack as [`SatelliteGlobe`](../SatelliteGlobe/SatelliteGlobe.md)). Ray paths and a transmitter marker are planned for a later phase (#1170).

## Props

| Prop      | Type                      | Notes                                                                                                                                                                       |
| --------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layers`  | `IonosphericLayerState[]` | Day/night-aware layer state from `computeIonosphericLayers`. Only `active` layers are drawn.                                                                                |
| `display` | `ShellDisplayOptions`     | Optional. `{ exaggerationFactor, explodeEnabled, fresnelEnabled }`. Omit for true-scale shells (factor `1`, explode/Fresnel off). The page passes live Display-panel state. |

## Usage

```tsx
import { lazy, Suspense } from 'react';

const HfPropagationGlobe = lazy(
  () => import('../../components/HfPropagationGlobe/HfPropagationGlobe.tsx'),
);

<Suspense fallback={<div>Loading 3D globe…</div>}>
  <HfPropagationGlobe
    layers={layers}
    display={{ exaggerationFactor: 5, explodeEnabled: true, fresnelEnabled: true }}
  />
</Suspense>;
```

`HfPropagationPage.tsx` renders this only when its View `SegmentedControl` is set to the `'globe'` option — the other two views (top-down, vertical slice) are separate, not-yet-implemented panels (#1171, #1172).

## Behaviour

- **Sizing:** measures its own container via `ResizeObserver` and passes explicit `width`/`height` to `Globe` — identical convention to `SatelliteGlobe` (`react-globe.gl` defaults to the _window's_ size otherwise, not its container's).
- **Shells:** one `THREE.Mesh` (sphere geometry, semi-transparent `MeshBasicMaterial`) per **active** layer in `customLayerData`. Geometry lives in `buildGlobeData.ts` (`buildShellMesh`, `displayShellRadiusUnits`) — `buildShellMesh` was moved here from `HfPropagationGlobe.tsx` so exaggeration/explode math sits next to the mesh builder. Colour still comes from `colorForLayer(id)`, not a field on `IonosphericLayerState`.
- **Display controls** (`display` prop):
  - **Altitude exaggeration** — `exaggeratedAltitudeKm` multiplies mid-altitude when `exaggerationFactor > 1` (range 1×–10×). Factor `≤ 1` is a no-op (true scale).
  - **Exploded stacking** — `explodeOffsetUnits` adds `layerIndex * 0.15` globe-radius units (`D=0` … `F2=3`, canonical id order so night-time F2 still sits outermost). Independent of exaggeration.
  - **Fresnel shading** — per-fragment opacity `mix(0.05, 0.40, pow(1 - \|N·V\|, 2))` when on; baseline `0.12` when off. Injected via `MeshBasicMaterial.onBeforeCompile`. `react-globe.gl`'s `customThreeObjectUpdate` only runs on data updates, not every frame, so a `requestAnimationFrame` loop pushes the enable flag; Three's built-in `cameraPosition` drives the view vector.
- **Colour:** `colorForLayer(id)` in `src/core/domain/hfPropagation/layerColor.ts` — one shared mapping for this globe and later top-down / vertical-slice views.
- **`GLOBE_RADIUS_UNITS = 100`:** `three-globe`'s own internal scene-unit globe radius (pinned copy of `GLOBE_RADIUS` in `three-globe`'s source — not exported from the package). `customThreeObject` positions objects in these scene units, not the `0`–`1`+ altitude units `react-globe.gl`'s own `pointAltitude`/`pathPointAlt` accessors use.
- **Data:** `layers` from `computeIonosphericLayers` (D 60–90 km day-only, E 90–150 km, F1 150–250 km day-only, F2 250–400 km). Inactive D/F1 shells are omitted at night.

## Testing

`react-globe.gl` needs a WebGL context jsdom doesn't provide, so `HfPropagationGlobe.test.tsx` mocks it to a stub component and asserts the `customLayerData`/`customThreeObject`/`customThreeObjectUpdate` props it receives (including that inactive layers are filtered out). Radius math lives in `buildGlobeData.test.ts` (`exaggeratedAltitudeKm`, `explodeOffsetUnits`, `displayShellRadiusUnits`, `fresnelOpacity`, `shellRadiusUnits`).

## Related

- [HF/RF propagation visualiser hub](../../../../docs/features/hf-propagation/README.md)
- [`SatelliteGlobe`](../SatelliteGlobe/SatelliteGlobe.md) — sibling 3D globe on the Tracking Dashboard; same `react-globe.gl`/sizing/testing conventions
- [`HfPropagationPage.tsx`](../../routes/reference/HfPropagationPage.tsx) — sole caller, gates rendering on the View switcher
