# UV-21Pro V2 — power ladder

Internal Studio `power` is **0–100 percent** (or `null` = unset / radio default). Hardware has two RF steps: **High 5 W** and **Low 1 W** (same UV-17Pro / UV-5R Mini ladder).

| Step | Watts | Internal percent |
| --- | --- | --- |
| High | 5 W | **100** |
| Low | 1 W | **20** |
| Unset | — | **`null`** |

On export, `null` maps to the **High** wire step (`5.0W`).

## Adapter wire spelling

| Adapter | Profile | High | Low | Notes |
| --- | --- | --- | --- | --- |
| CHIRP Generic CSV | `chirp-uv21` | `5.0W` | `1.0W` | Watt strings for `parse_power` / Generic CSV — not driver labels `High`/`Low` |

CHIRP column mapping for `Power`: [channels.md](../../../export-formats/chirp/channels.md).

## Related

- [capabilities.md](capabilities.md) · [limits.md](limits.md)
- Adapter stub: [chirp-uv21](../../../export-formats/chirp/radios/chirp-uv21.md)
- Sibling: [UV-5R Mini power](../uv-5r-mini/power.md)
