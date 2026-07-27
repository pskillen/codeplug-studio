# DM-1701 — power ladder

Internal Studio `power` is **0–100 percent** (or `null` = unset / radio default).

OpenGD77 wire spelling (`Master`, `P1`…`Pn`) is documented generically in [export-formats/opengd77/power-squelch.md](../../../export-formats/opengd77/power-squelch.md). This page records the **1701-specific** watt ↔ percent mapping used by profile `opengd77-1701`.

| Wire     | Watts (1701)  | Internal percent |
| -------- | ------------- | ---------------- |
| `P9`     | 5 W           | **100**          |
| `P8`     | 4 W           | **80**           |
| `P7`     | 3 W           | **60**           |
| `P6`     | 2 W           | **40**           |
| `P5`     | 1 W           | **20**           |
| `P4`     | 750 mW        | **15**           |
| `P3`     | 500 mW        | **10**           |
| `P2`     | 250 mW        | **5**            |
| `P1`     | 50 mW         | **1**            |
| `Master` | radio default | **`null`**       |

Export picks the nearest ladder step for non-exact percent values. `null` exports as `Master`.

## vs qDMR enums

qdmr collapses power onto fewer wire values (Min / Low / Mid / High / Max → wire `1` / `3` / `6` / `9` / **`10`**). Studio profile `opengd77-1701` uses **`P1`…`P9` → wire `1`…`9`** only — wire **`10`** is intentionally unused here. That difference is a profile choice, not a layout bug.

## Squelch

Profile-independent OpenGD77 **export** rules: analogue `null`/`0` → `Disabled`; else `N%`; digital → empty — see [power-squelch.md](../../../export-formats/opengd77/power-squelch.md). `Master` / `Open` / `Closed` sentinels need CPS elicitation ([#439](https://github.com/pskillen/codeplug-studio/issues/439)).

## Related

- [capabilities.md](capabilities.md) · [limits.md](limits.md)
- Adapter profile: [opengd77 profiles.md](../../../export-formats/opengd77/profiles.md) (`opengd77-1701`)
- Code: [`profiles.ts`](../../../../src/core/import-export/formats/opengd77/profiles.ts) (`OPENGD77_1701_LADDER`)
