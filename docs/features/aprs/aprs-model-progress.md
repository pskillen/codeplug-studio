# APRS model foundation — progress

**Tracking:** [codeplug-studio#249](https://github.com/pskillen/codeplug-studio/issues/249) · [codeplug-studio#248](https://github.com/pskillen/codeplug-studio/issues/248) · Epic [codeplug-studio#246](https://github.com/pskillen/codeplug-studio/issues/246)

**Plan:** `.cursor/plans/aprs_model_foundation_dc68cef0.plan.md` · Design: `.cursor/plans/aprs_data_models_cbad15a3.plan.md`

**Branch:** `249/pskil/aprs-model-foundation`

---

## Overall status

**Status:** Complete (pending merge)

**Branch:** `249/pskil/aprs-model-foundation`

---

## Slice 0 — Kickoff

**Status:** Complete

---

## Slice 1 — Docs

**Status:** Complete

**Delivered**

- `docs/features/aprs/README.md` hub
- `docs/features/aprs/cross-format-reconciliation.md`
- Data-model README + features index + tier-3 link updates

---

## Slice 2 — Core types

**Status:** Complete

**Delivered**

- `src/core/models/aprs.ts`, schema v15, Library/Channel/FormatBuild extensions

---

## Slice 3 — Domain

**Status:** Complete

**Delivered**

- `src/core/domain/aprs/*` — normalize, validation, resolveSlotIndex, defaults
- Extended `references.ts`, `normalizeChannel.ts`, `factories.ts`

---

## Slice 4 — Assemble

**Status:** Complete

**Delivered**

- `assemble()` APRS projection + `aprsConfigurationWarnings`

---

## Slice 5 — YAML persistence

**Status:** Complete

**Delivered**

- Native YAML round-trip for APRS entities and broken-FK validation

---

## Verify

- `npm run format:check && npm run lint && npm run test && npm run build`

---

## Next

- Merge PR; follow-up: UI [#249](https://github.com/pskillen/codeplug-studio/issues/249), Anytone export [#251](https://github.com/pskillen/codeplug-studio/issues/251), DM32 [#250](https://github.com/pskillen/codeplug-studio/issues/250)
