# Satellite tracking — outstanding

Items **skipped**, **incomplete**, or **discovered during execution** — not the plan's future phases.

**Tracking:** [codeplug-studio#860](https://github.com/pskillen/codeplug-studio/issues/860)

**Status: closed out.** Nothing outstanding as of [#866](https://github.com/pskillen/codeplug-studio/issues/866) (the epic's final phase). Both items deferred below have since shipped under their own tickets, and no execution-time debt remains.

---

## Deferred by plan (tracked under existing tickets, not re-listed here as debt)

3D orbital globe ([#866](https://github.com/pskillen/codeplug-studio/issues/866) — shipped) and SatNOGS enrichment ([#864](https://github.com/pskillen/codeplug-studio/issues/864) — shipped) were intentionally out of scope for the plan's earlier phases; both landed under their own tickets rather than being tracked here.

A 3D/2D viewport toggle was newly unblocked by #866 but is a separate follow-up, not part of this epic's shipped scope — tracked as [#1009](https://github.com/pskillen/codeplug-studio/issues/1009).

---

## Discovered during execution

None currently outstanding.

- The `observerDivIcon()` per-render recreation noted during slice 5b was fixed while extracting `mapHelpers.ts` (module-level singleton icon) for the satellite detail page's live-position work.
- **#866 (this phase):** live-browser testing with a fresh 97-satellite CelesTrak amateur fetch found `SatelliteGlobe`'s original data computation recomputed every enabled satellite's SGP4-sampled orbit trail (~180 points × 2 directions each) on every 2-second live-position poll tick, since it shared one `useMemo` dependency array with the live positions — this stalled the main thread. Fixed by splitting trail computation (`computeGlobeTrailPaths`, memoized on `satellites`/`anchorAt` only) from the live-position-dependent points/footprints computation (`computeGlobePointsAndFootprints`) — see `buildGlobeData.ts` and `SatelliteGlobe.md`.
