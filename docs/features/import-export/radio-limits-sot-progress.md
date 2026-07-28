# Radio limits SoT — progress

**Tracking:** [codeplug-studio#813](https://github.com/pskillen/codeplug-studio/issues/813)
**Plan:** `.cursor/plans/radio_limits_sot_238a9924.plan.md`
**Branch:** `813/pskil/radio-limits-sot`

---

## Overall status

**Status:** Complete (pending merge)

**Branch:** `813/pskil/radio-limits-sot`

---

## Delivered (all slices)

- Slice 0: Guardrails in `vendor-boundaries.mdc`, `AGENTS.md`, format/radio checklists
- Slice 1: `DM32UV_LIMITS` expanded; dm32 / NeonPlug / radio-io profiles + `profileExportLimits`
- Slice 2: Codecs, APRS slots, NO-TX band from core limits; `maxRadioIds` on export limits API
- Slice 3: `radioIoWriteProjection` profile-only limits (no app fallbacks)
- Slice 4: `OPENGD77_FAMILY_LIMITS`, `AT_D890UV_LIMITS` modules + profile wiring
- Slice 5: DM32 Scan derive under `formats/dm32/`; library APRS clamp removed; M6 docs
- Slice 6: Tier-3 limits anchors; feature hub row; PR

**Feature note:** [radio-limits-sot.md](radio-limits-sot.md)

**Verify**

- [x] `npm run format:check && npm run lint && npm run test && npm run build`

---

## Next

- Merge PR; file follow-up for M6 enforcement if desired
