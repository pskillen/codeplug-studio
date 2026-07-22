# RT95 VOX — power ladder

Internal Studio `power` is **0–100 percent** (or `null` = unset / radio default).

CHIRP radio driver labels are Low / Medium / High (~5 / 10 / 25 W). Studio exports Generic CSV **watt** strings for interchange (`parse_power`) — not radio labels. `null` → high (`25W`).

| Wire   | Watts | Percent    | CHIRP label       |
| ------ | ----- | ---------- | ----------------- |
| `25W`  | 25 W  | **100**    | High              |
| `10W`  | 10 W  | **40**     | Medium            |
| `5.0W` | 5 W   | **20**     | Low               |
| Unset  | —     | **`null`** | → exports as High |

## Adapter wire spelling

| Adapter           | Profile      | Notes                                        |
| ----------------- | ------------ | -------------------------------------------- |
| CHIRP Generic CSV | `chirp-rt95` | Watt strings for `parse_power` / Generic CSV |

CHIRP column mapping for `Power`: [channels.md](../../../export-formats/chirp/channels.md).

## Related

- [capabilities.md](capabilities.md) · [limits.md](limits.md)
- Adapter profile: [chirp profiles.md](../../../export-formats/chirp/profiles.md) (`chirp-rt95`)
