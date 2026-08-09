# Satellite tracking

Tier-1 hub for the **Tracking Dashboard** — client-side pass prediction (SGP4), observer location, SatNOGS-augmented pass grids, and 3D/2D orbital visualization. Consumes curated TLEs from the [Satellite keps](../satellite-keps/) library; does not write keps to radios.

**Tracking:** Epic [#860](https://github.com/pskillen/codeplug-studio/issues/860) (child of Milestone 2 [#495](https://github.com/pskillen/codeplug-studio/issues/495))  
**Depends on:** [#848](https://github.com/pskillen/codeplug-studio/issues/848) curated TLEs (at least #850–#853; frequencies when #854 lands)  
**Navigation:** reached from the Tools strip (`Tools → Tracking Dashboard`, `/tracking`), not a top-level tab — [#978](https://github.com/pskillen/codeplug-studio/issues/978)

---

## Implementation status

| Area                               | Status      | Notes                                                                                                                                    |
| ---------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Observer location settings         | Shipped     | [#862](https://github.com/pskillen/codeplug-studio/issues/862) — geolocation, Maidenhead, Nominatim address search, and minimap pin drop |
| SGP4 pass prediction (Web Worker)  | Shipped     | [#863](https://github.com/pskillen/codeplug-studio/issues/863) — `satellite.js`                                                          |
| SatNOGS transmitters proxy + merge | Not started | [#864](https://github.com/pskillen/codeplug-studio/issues/864)                                                                           |
| Tracking Dashboard + pass grid     | Shipped     | [#865](https://github.com/pskillen/codeplug-studio/issues/865)                                                                           |
| 3D orbital globe                   | Not started | [#866](https://github.com/pskillen/codeplug-studio/issues/866)                                                                           |
| 2D ground-track map                | Shipped     | [#867](https://github.com/pskillen/codeplug-studio/issues/867) — no 3D/2D toggle shipped (nothing to toggle to until #866 lands)         |

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

---

## Out of scope

- Radio keps write ([#848](https://github.com/pskillen/codeplug-studio/issues/848))
- Space-Track.org
- Doppler UI beyond pass times
- Offline / paid map tile productization
- 3D/2D viewport toggle — no toggle control ships until the 3D globe ([#866](https://github.com/pskillen/codeplug-studio/issues/866)) exists; a visible-but-dead control would be worse than no control
- SatNOGS-sourced mode/status/frequency columns in the pass grid ([#864](https://github.com/pskillen/codeplug-studio/issues/864))
