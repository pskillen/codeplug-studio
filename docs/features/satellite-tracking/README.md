# Satellite tracking

Tier-1 hub for the **Tracking Dashboard** — client-side pass prediction (SGP4), observer location, SatNOGS transmitter enrichment on the satellite detail page, and 3D/2D orbital visualization. Consumes curated TLEs from the [Satellite keps](../satellite-keps/) library; does not write keps to radios.

**Tracking:** Epic [#860](https://github.com/pskillen/codeplug-studio/issues/860) (child of Milestone 2 [#495](https://github.com/pskillen/codeplug-studio/issues/495))  
**Depends on:** [#848](https://github.com/pskillen/codeplug-studio/issues/848) curated TLEs (at least #850–#853; frequencies when #854 lands)  
**Navigation:** reached from the Tools strip (`Tools → Tracking Dashboard`, `/tracking`), not a top-level tab — [#978](https://github.com/pskillen/codeplug-studio/issues/978)

---

## Implementation status

| Area                               | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Observer location settings         | Shipped | [#862](https://github.com/pskillen/codeplug-studio/issues/862) — geolocation, Maidenhead, Nominatim address search, and minimap pin drop                                                                                                                                                                                                                                                                     |
| SGP4 pass prediction (Web Worker)  | Shipped | [#863](https://github.com/pskillen/codeplug-studio/issues/863) — `satellite.js`                                                                                                                                                                                                                                                                                                                              |
| SatNOGS transmitters proxy + merge | Shipped | [#864](https://github.com/pskillen/codeplug-studio/issues/864) — proxy + merge in integrations                                                                                                                                                                                                                                                                                                               |
| SatNOGS enrichment UI wiring       | Shipped | [#1012](https://github.com/pskillen/codeplug-studio/issues/1012) — detail-page refresh + bulk refresh on keps import; session-scoped display on satellite detail                                                                                                                                                                                                                                             |
| Tracking Dashboard + pass grid     | Shipped | [#865](https://github.com/pskillen/codeplug-studio/issues/865); satellite filter + manual look-ahead window [#980](https://github.com/pskillen/codeplug-studio/issues/980)                                                                                                                                                                                                                                   |
| 3D orbital globe                   | Shipped | [#866](https://github.com/pskillen/codeplug-studio/issues/866) — observer marker, live satellite dots, ~90-minute orbit trails, footprint circles (`SatelliteGlobe`); lazy-loaded on `/tracking` ([#1013](https://github.com/pskillen/codeplug-studio/issues/1013)); clicking a satellite filters the pass grid                                                                                              |
| 2D ground-track map                | Shipped | [#867](https://github.com/pskillen/codeplug-studio/issues/867) — configurable draw-ahead/behind window [#998](https://github.com/pskillen/codeplug-studio/issues/998); both viewports render as separate panels, no toggle between them yet — [#1009](https://github.com/pskillen/codeplug-studio/issues/1009)                                                                                               |
| Satellite detail page              | Shipped | [#1002](https://github.com/pskillen/codeplug-studio/issues/1002) — route, static detail panel, and future/past pass lists ([#1003](https://github.com/pskillen/codeplug-studio/issues/1003)); live position + footprint circle math ([#1005](https://github.com/pskillen/codeplug-studio/issues/1005)); orbit trails + live map component ([#1007](https://github.com/pskillen/codeplug-studio/issues/1007)) |

---

## Documentation map

| Doc                                      | Role                                              |
| ---------------------------------------- | ------------------------------------------------- |
| [feature-design.md](feature-design.md)   | Post-MVP architecture, prediction, grid, 3D/2D UX |
| [Satellite keps hub](../satellite-keps/) | TLE fetch, library, radio write (MVP)             |

---

## Concepts

- **Client-only** — Orbital math and visualization run in the browser (Web Workers for pass sweeps); no Studio backend.
- **Depends on keps library** — Enabled satellites and TLEs come from [#848](https://github.com/pskillen/codeplug-studio/issues/848); this epic adds prediction and visualization only.
- **Styleguide** — Follow Studio map/list chrome; design-doc “neon war room” visuals are illustrative, not a theme mandate.
- **Pass grid filters** — client-only, applied to the already-computed pass list (no Worker re-run): a min-elevation filter and a satellite multi-select-with-search filter (`src/app/routes/tracking/SatelliteFilter.tsx`). The look-ahead window (default 72h) is a user-adjustable control on the dashboard, debounced 300ms before triggering a new Worker pass-prediction sweep.
- **SatNOGS enrichment vs. TLE source** — SatNOGS answers "what does this satellite transmit / is it alive" (`SatelliteEnrichmentSource`), a different provenance question from `SatelliteSource` ("where did this TLE come from" — CelesTrak/AMSAT). Enrichment is fetched and merged live per session, keyed by NORAD id, and is **not** persisted as part of the `Satellite` model. Refresh from the satellite detail page or as part of the Satellite Keps "Update from CelesTrak/AMSAT" flow; transmitters render on the detail page — see [SatNOGS reference](../../reference/remote-directories/satnogs/README.md).

---

## Out of scope

- Radio keps write ([#848](https://github.com/pskillen/codeplug-studio/issues/848))
- Space-Track.org
- Doppler UI beyond pass times
- Offline / paid map tile productization
- 3D/2D viewport toggle — both viewports exist as of [#866](https://github.com/pskillen/codeplug-studio/issues/866), so the toggle is technically unblocked, but building it is tracked separately as [#1009](https://github.com/pskillen/codeplug-studio/issues/1009), not part of this epic's shipped scope
- SatNOGS-sourced mode/status/frequency columns in the pass grid ([#864](https://github.com/pskillen/codeplug-studio/issues/864))
