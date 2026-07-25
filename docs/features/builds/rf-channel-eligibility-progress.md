# RF channel eligibility — progress

**Tracking:** [codeplug-studio#612](https://github.com/pskillen/codeplug-studio/issues/612) · [codeplug-studio#744](https://github.com/pskillen/codeplug-studio/issues/744)
**Branch:** `744/pskil/rf-channel-eligibility`

---

## Overall status

**Status:** Complete — PR pending

---

## Slice 0 — Kickoff docs + RT95 AM correction

**Status:** Done

**Delivered**

- Progress / outstanding pair
- RT95 `capabilities.md`: AM → No; airband unsupported

---

## Slice 1 — RF capability model

**Status:** Done

**Delivered**

- `src/core/radio-targets/rfCapabilities.ts` — confirmed tables for all seven radios
- `channelEligibleForRadio` + tests; wired into assemble and flat-memory export order

---

## Slice 2 — Toggle + assemble/export warnings

**Status:** Done

**Delivered**

- `hideChannelsOutsideFrequencyRange` on `BuildExportSettings` (default on)
- Native YAML parse; assemble warnings for skipped channels

---

## Slice 3 — Toggle reconciliation

**Status:** Done

**Delivered**

- `reconcileBuildAfterFrequencyHideToggle` — append on overridden order; library-order reset otherwise
- Confirm message + unit tests

---

## Slice 4 — Radio Build UI + characteristics bands

**Status:** Done

**Delivered**

- Export settings toggle (`FrequencyRangeEligibilityFields`)
- Radio characteristics RF bands/modes section
- Flat-memory channel/scan lists filter via eligibility; shared frequency-toggle reconcile helper

---

## Slice 5 — Feature + tier-3 docs

**Status:** Done

**Delivered**

- [channel-eligibility.md](channel-eligibility.md) + builds hub status row
- Seven radio `capabilities.md` frequency range tables
- Import/export hub + `cps-services.md` assemble note
