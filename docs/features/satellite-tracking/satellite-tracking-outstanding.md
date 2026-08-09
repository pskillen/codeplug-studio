# Satellite tracking — outstanding

Items **skipped**, **incomplete**, or **discovered during execution** — not the plan's future phases.

**Tracking:** [codeplug-studio#860](https://github.com/pskillen/codeplug-studio/issues/860)

---

## Deferred by plan (tracked under existing tickets, not re-listed here as debt)

3D orbital globe (#866) and SatNOGS enrichment (#864) are intentionally out of scope for this plan — tracked directly on those tickets, not duplicated here.

---

## Discovered during execution

- **`SatelliteTrackMap`'s `observerDivIcon()` recreates its `L.DivIcon` on every render** (called inline in JSX, same pattern that broke `ObserverLocationMap`'s draggable pin — see slice 5b above). That marker isn't draggable today so it doesn't hit the same crash, but it's still wasteful and worth hoisting to a module-level singleton if that component is touched again. Not fixed here — out of scope for slice 5b.
