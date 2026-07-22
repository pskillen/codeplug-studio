# MD-9600 — power ladder

Internal Studio `power` is **0–100 percent** (or `null` = unset / radio default).

OpenGD77 wire spelling (`Master`, `P1`…`Pn`) is documented generically in [export-formats/opengd77/power-squelch.md](../../../export-formats/opengd77/power-squelch.md). This page records the **MD-9600-specific** watt ↔ percent mapping used by profile `opengd77-md9600`.

Source: MD-9600 radio menu levels (operator elicitation, [#441](https://github.com/pskillen/codeplug-studio/issues/441)). Fixed steps map to CPS `P1`…`P9` (lowest → highest). `Master` is radio default (`power: null`).

### `+W-` (User Power) — not modelled

The radio menu also offers **`+W-`** (User Power / ADC → PA). Studio does **not** model it — see [capabilities.md](capabilities.md).

| Wire     | Approx. watts (menu)                 | Percent    |
| -------- | ------------------------------------ | ---------- |
| `P9`     | 40 W (VHF + UHF)                     | **100**    |
| `P8`     | 25 W                                 | **63**     |
| `P7`     | 10 W                                 | **25**     |
| `P6`     | 5 W                                  | **13**     |
| `P5`     | 1 W                                  | **5**      |
| `P4`     | 750 mW                               | **4**      |
| `P3`     | 500 mW                               | **3**      |
| `P2`     | 250 mW                               | **2**      |
| `P1`     | 100 mW                               | **1**      |
| `Master` | radio default                        | **`null`** |
| `+W-`    | User Power (ADC → PA); not in Studio | —          |

Export picks the nearest ladder step for non-exact percent values. `null` exports as `Master`.

## Squelch

Profile-independent OpenGD77 rules: `N%`, `Disabled` → 0%, `Master` → `null` — see [power-squelch.md](../../../export-formats/opengd77/power-squelch.md).

## Related

- [capabilities.md](capabilities.md) · [limits.md](limits.md)
- Adapter profile: [opengd77 profiles.md](../../../export-formats/opengd77/profiles.md) (`opengd77-md9600`)
- Code: [`profiles.ts`](../../../../src/core/import-export/formats/opengd77/profiles.ts) (`OPENGD77_MD9600_LADDER`)
