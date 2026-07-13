# APRS persistence + UI — progress

**Tracking:** [#353](https://github.com/pskillen/codeplug-studio/issues/353) · [#354](https://github.com/pskillen/codeplug-studio/issues/354) · Epic [#246](https://github.com/pskillen/codeplug-studio/issues/246)

**Branch:** `353/pskil/aprs-persistence-and-ui`

---

## Overall status

**Status:** Complete (pending merge)

---

## Slice 1 — IndexedDB persistence

**Status:** Complete

- Schema v16 + `aprsConfigurations` object store
- `libraryService` / `loadLibrarySlice` wired
- Persistence round-trip tests

---

## Slice 2 — Library CRUD

**Status:** Complete

- Registry, nav, list page, configuration editor

---

## Slice 3 — Slot editor

**Status:** Complete

- `AprsChannelSlotsEditor` + sidecar

---

## Slice 4 — Channel APRS tab

**Status:** Complete

- `ChannelAprsBindingSection` on DMR-gated channel editor tab

---

## Slice 5 — Build active config

**Status:** Complete

- `BuildAprsSettingsSection` on Anytone D890 export panel

---

## Slice 6 — Delete guard

**Status:** Complete

- Block APRS config delete when referenced by `FormatBuild.activeAprsConfigurationId`

---

## Slice 7 — Docs + PR

**Status:** Complete

---

## Verify

- `npm run format:check && npm run lint && npm run test && npm run build`

---

## Next

- Anytone export [#251](https://github.com/pskillen/codeplug-studio/issues/251), DM32 [#250](https://github.com/pskillen/codeplug-studio/issues/250)
