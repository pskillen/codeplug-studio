# APRS persistence + UI — progress

**Tracking:** [#353](https://github.com/pskillen/codeplug-studio/issues/353) · [#354](https://github.com/pskillen/codeplug-studio/issues/354) · Epic [#246](https://github.com/pskillen/codeplug-studio/issues/246)

**Branch:** `353/pskil/aprs-persistence-and-ui`

---

## Overall status

**Status:** Complete (pending merge)

---

## Phase 1 — Initial persistence + UI (schema v16)

**Status:** Complete

- Schema v16 + `aprsConfigurations` object store
- `libraryService` / `loadLibrarySlice` wired
- Registry, nav, list page, configuration editor
- `AprsChannelSlotsEditor` + sidecar
- `ChannelAprsBindingSection` on DMR-gated channel editor tab
- `BuildAprsSettingsSection` on Anytone D890 export panel (removed in refactor)

---

## Phase 2 — Singleton model refactor (schema v17)

**Status:** Complete

- `Library.aprsConfiguration` singleton (replaces `aprsConfigurations[]`)
- `ChannelAprsBinding.reportSlotIndex` (replaces `reportChannelRef`)
- Removed `FormatBuild.activeAprsConfigurationId`, `defaultDmrId`, `defaultCallType`
- YAML migration v16 → v17
- `AprsConfigurationPage` at `/library/aprs-configuration` (replaces list page)
- Slot-based `ChannelAprsBindingSection`
- **Channel assignments** tab: `AprsChannelAssignmentPanel` + bulk modal
- Optional **APRS config** column on Channels list
- Docs + sidecars updated

---

## Verify

- `npm run format:check && npm run lint && npm run test && npm run build`

---

## Next

- Anytone export [#251](https://github.com/pskillen/codeplug-studio/issues/251), DM32 [#250](https://github.com/pskillen/codeplug-studio/issues/250)
