# Adding a repeater reference source

Checklist for onboarding a new public repeater directory into Codeplug Studio. Follow after reading [repeater directories hub](README.md) and [DESIGN.md](../../../DESIGN.md#architecture).

## HTTP client

- [ ] Add client under [`src/integrations/repeaters/`](../../../src/integrations/repeaters/) (or a subfolder for wire-specific parsing).
- [ ] Route every lookup `fetch` through [`fetchCachedText`](../../../src/integrations/http/cachedFetch.ts) (repeater clients use [`fetchDirectoryText`](../../../src/integrations/repeaters/directoryFetch.ts)) with a dedicated cache prefix from [`sessionCache.ts`](../../../src/integrations/http/sessionCache.ts).
- [ ] Add tier-3 wire reference under [`docs/reference/<source>/`](../../reference/) — column/field tables stay in format-specific docs only.
- [ ] Surface failures as [`RepeaterDirectoryError`](../../../src/integrations/repeaters/types.ts); **never** call `fetch` from `src/core/` or `src/app/`.

## Session cache

- [ ] Assign a provider id in [`rateLimit.ts`](../../../src/integrations/http/rateLimit.ts) if the API can return **429**.
- [ ] Cache key = `{prefix}{fullUrl}` with optional suffix (e.g. RepeaterBook token prefix for shared-machine isolation).
- [ ] TTL ≤ **5 minutes** (`INTEGRATION_CACHE_TTL_MS`).
- [ ] Swallow `sessionStorage` quota errors — degrade to uncached fetch.
- [ ] On **429**, shared fetch layer may serve **stale** cache (even past TTL) when a prior response exists; otherwise record cooldown and throw (no automatic retry).

## Normalisation

- [ ] Map wire rows to shared [`RepeaterListing`](../../../src/integrations/repeaters/types.ts) at the integration boundary.
- [ ] Frequencies in Hz; `rxFrequencyHz` = repeater output (what the radio receives).
- [ ] UUID `id` FK rules apply in the **library** — wire names are labels, not relationship keys.

## Import UX

- [ ] Wire search UI through [`RepeaterDirectorySearch`](../../../src/app/components/repeaters/RepeaterDirectorySearch.tsx) / [`useRepeaterDirectorySearch`](../../../src/app/hooks/useRepeaterDirectorySearch.ts) where applicable.
- [ ] **Title case** toggle for free-text names where the source uses uppercase wire labels (UK pattern).
- [ ] **Duplicate import gate** — block add only when **callsign** already exists in the library ([`repeaterDirectoryRows.ts`](../../../src/app/components/repeaters/repeaterDirectoryRows.ts)).

## Verify / update

- [ ] Channel editor verify via [`RepeaterVerifyPanel`](../../../src/app/components/repeaters/RepeaterVerifyPanel.tsx) or sibling action.
- [ ] Directory comparison via [`RepeaterListingUpdateDialog`](../../../src/app/components/repeaters/RepeaterListingUpdateDialog.tsx).
- [ ] Diff apply defaults: remote fields with **lower precision** than local (`isCoordinateLessPrecise`, `isLocatorLessPrecise` in [`channelDiff.ts`](../../../src/integrations/repeaters/channelDiff.ts)) → `selectByDefault: false`.

## Documentation

- [ ] Add hub row + manual verify steps in [repeater-directories README](README.md).
- [ ] Add row to [docs/features/README.md](../README.md) if this checklist or hub section is new.
- [ ] Note Mapbox geocode caching is **out of scope** — per-user token; Photon/Komoot uses the shared session cache

## Related

- [repeater directories hub](README.md)
- [repeater-directory-infra-progress.md](repeater-directory-infra-progress.md) — [#73](https://github.com/pskillen/codeplug-studio/issues/73) / [#341](https://github.com/pskillen/codeplug-studio/issues/341)
