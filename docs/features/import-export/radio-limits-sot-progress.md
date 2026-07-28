# Radio limits SoT — progress

**Tracking:** [codeplug-studio#813](https://github.com/pskillen/codeplug-studio/issues/813)
**Plan:** `.cursor/plans/radio_limits_sot_238a9924.plan.md`
**Branch:** `813/pskil/radio-limits-sot`

---

## Overall status

**Status:** In progress

**Branch:** `813/pskil/radio-limits-sot`

---

## Slice 0: Guardrail — rule + checklist

**Status:** Complete

**Delivered**

- `vendor-boundaries.mdc` — radio limits SoT section
- `AGENTS.md` — vendor boundaries paragraph
- `adding-a-new-format.md` / `adding-a-radio-adapter.md` — limits module checklist items
- Progress/outstanding pair created

---

## Slice 1: Expand DM32UV_LIMITS + rewire profiles

**Status:** Complete

**Delivered**

- Expanded `src/core/radios/baofeng/dm-32uv/limits.ts`
- dm32 / neonplug / radio-io profiles import `DM32UV_LIMITS`
- `profileExportLimits` maps radio-io DM32 contacts/TGs (fixes H2)
- Sync tests in dm32, neonplug, radio-io, profileExportLimits

---

## Next

- Slice 2: Codecs/APRS/NO-TX band/radio-ID from limits
