# AT-D890UV — power ladder

Internal Studio `power` is **0–100 percent** (or `null` = unset / radio default).

Confirmed AT-D890UV `Transmit Power` wire values and approximate output ([#357](https://github.com/pskillen/codeplug-studio/issues/357)):

| Wire | Approx. power | Studio `%` (nearest) |
| --- | --- | --- |
| `Low` | 0.2 W | **25** |
| `Mid` | 2.5 W | **50** |
| `High` | 5 W | **75** |
| `Turbo` | 7 W VHF / 6 W UHF | **100** |
| Unset | — | **`null`** → exports as `Turbo` |

Map at the export boundary in `profiles.ts` (`AT_D890UV_POWER_LADDER`). Watts are informational; `%` steps are discrete UI/export buckets (not exact watt ratios). Ladder order keeps **Turbo first** so the null default is Turbo.

## Related

- [capabilities.md](capabilities.md) · [limits.md](limits.md)
- Adapter stub: [at-d890uv](../../../export-formats/anytone/radios/at-d890uv.md)
- Code: [`profiles.ts`](../../../../src/core/import-export/formats/anytone/profiles.ts)
