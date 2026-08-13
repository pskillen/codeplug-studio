# HF/RF propagation visualiser

Tier-1 hub for the **Propagation Visualiser** — an interactive 3D globe (plus 2D top-down and vertical cross-section views) that lets an operator place an idealised HF transmitter (antenna type, power, frequency, location) and see where the signal actually goes: groundwave footprint, skywave skip zones and hop landing points, and NVIS coverage, shaped by day/night ionospheric state and solar activity. A planning/teaching tool, not a coverage guarantee.

**Tracking:** Epic [#1162](https://github.com/pskillen/codeplug-studio/issues/1162) (child of Milestone 2 [#495](https://github.com/pskillen/codeplug-studio/issues/495))
**Navigation:** reached from the Tools strip (`Tools → Propagation Visualiser`, `/reference/rf-propagation`), reachable with **no active project** — like Maidenhead locator and Band plan, unlike the project-scoped Tracking Dashboard.
**Components:** [HfPropagationGlobe](../../../src/app/components/HfPropagationGlobe/HfPropagationGlobe.md)

---

## Implementation status

| Ticket                                                           | Area         | Status      | Notes                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------- | ------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#1163](https://github.com/pskillen/codeplug-studio/issues/1163) | app          | Shipped     | Route, `/reference/rf-propagation` outside `RequireActiveProject`, Tools-strip entry, and `HfPropagationPage` control-panel layout (View/RF/Antenna/Environment/Reading) — local state only, no globe, no physics                                  |
| [#1164](https://github.com/pskillen/codeplug-studio/issues/1164) | app          | Shipped     | Ionospheric shell rendering spike — hard-coded D/E/F1/F2 shells via `customThreeObject` (`HfPropagationGlobe`); real layer data in #1165                                                                                                           |
| [#1165](https://github.com/pskillen/codeplug-studio/issues/1165) | core         | Shipped     | Real day/night-aware ionospheric layers + fc readout; MUF pending ray tracing                                                                                                                                                                      |
| [#1184](https://github.com/pskillen/codeplug-studio/issues/1184) | app          | Shipped     | Shell display controls — exaggeration 1×–10× (default 5× on), exploded stacking (0.15 globe-radii/layer, on), Fresnel limb shading (on), per-layer D/E/F1/F2 visibility toggles with colour swatches. Display panel on `/reference/rf-propagation` |
| [#1166](https://github.com/pskillen/codeplug-studio/issues/1166) | core         | Not started | Antenna pattern library                                                                                                                                                                                                                            |
| [#1167](https://github.com/pskillen/codeplug-studio/issues/1167) | app          | Not started | Slice-plane picker (bearing / Maidenhead / address)                                                                                                                                                                                                |
| [#1168](https://github.com/pskillen/codeplug-studio/issues/1168) | core         | Not started | Ray-tracing domain math                                                                                                                                                                                                                            |
| [#1169](https://github.com/pskillen/codeplug-studio/issues/1169) | integrations | Not started | Web Worker integration                                                                                                                                                                                                                             |
| [#1170](https://github.com/pskillen/codeplug-studio/issues/1170) | app          | Not started | 3D ray path rendering                                                                                                                                                                                                                              |
| [#1171](https://github.com/pskillen/codeplug-studio/issues/1171) | app          | Not started | Top-down (plan) view                                                                                                                                                                                                                               |
| [#1172](https://github.com/pskillen/codeplug-studio/issues/1172) | app          | Not started | Vertical cross-section view                                                                                                                                                                                                                        |
| [#1173](https://github.com/pskillen/codeplug-studio/issues/1173) | app          | Not started | Polish pass — copy, states, accessibility                                                                                                                                                                                                          |
| [#1174](https://github.com/pskillen/codeplug-studio/issues/1174) | app          | Not started | Android/Capacitor validation & tuning                                                                                                                                                                                                              |

---

## Concepts

- **Client-only, independent of the library** — reachable at `/reference/rf-propagation` with **no active project**; the page's control state (`HfPropagationPage`) is local `useState`, with no dependency on `useProjects`, `useLibrary`, or `ProjectPersistence`. Orbital/RF math runs entirely in the browser once later phases add it; no Studio backend.
- **Single-vertical-plane ray tracing in v1** — the traced path is one bearing at a time, not a full elevation×azimuth sweep; this applies across the 3D globe, top-down, and vertical-slice views alike. Full-azimuth coverage (the true 3D lobe for directional antennas) is a credible future epic, not part of this one.
- **Core domain scaffold** — `src/core/domain/hfPropagation/` holds `AntennaPatternFamily`, `AntennaConfig`, `SolarActivityPreset`, and `IonosphericLayerState`. `computeIonosphericLayers` produces day/night-aware D/E/F1/F2 state for the globe; `criticalFrequencyMhz` drives the Reading-panel fc readout. Later tickets (#1166, #1168) add antenna patterns, `RayTraceParams`, `RayPathResult`, and `PropagationMode` alongside these, not replacing them.
- **View switcher** — a `SegmentedControl` (3D Globe / Top-down / Vertical slice) selects which single renderer occupies the viewport; only one view renders at a time, not three simultaneous panels.

---

## Out of scope

- Full-wave EM antenna solvers (NEC-2/NEC-4-class modelling) — the antenna pattern library (#1166) uses closed-form gain functions instead.
- Live space-weather data (NOAA SFI/Kp, GIRO ionosonde network, IRI-2020, VOACAP) — surveyed as candidates, none committed; v1 uses canned solar-activity presets.
- Any `Library`/`RadioBuild` overlay (repeater/channel coverage preview) — this feature has no library dependency.
- Full-azimuth sweep (the actual 3D coverage lobe for directional antennas) — v1 traces one bearing at a time; see "Single-vertical-plane ray tracing" above.
- Terrain/ground-conductivity modelling; particle-flow ray animation.
