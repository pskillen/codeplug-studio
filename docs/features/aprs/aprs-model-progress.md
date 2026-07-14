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

## Phase 3 — Anytone export ([#251](https://github.com/pskillen/codeplug-studio/issues/251))

**Status:** Complete

**Branch:** `251/pskil/anytone-aprs-export`

- `aprsDefaults.ts` + `APRS_HEADERS` from AT-D890UV fixture
- `aprsWireFormat.ts` — model → wire mappers
- `exportAprsWire.ts` — conditional `APRS.CSV` serialisation
- `channelWire.ts` — per-channel APRS columns from `Channel.aprs`
- Directional golden tests (`exportGolden.test.ts`, `__fixtures__/export/APRS.CSV`)

---

## Verify

- `npm run format:check && npm run lint && npm run test && npm run build`

---

## Next

- DM32 per-channel APRS export [#250](https://github.com/pskillen/codeplug-studio/issues/250)
