# UV-5R Mini — power ladder

Internal Studio `power` is **0–100 percent** (or `null` = unset / radio default). Hardware has two RF steps: **High 5 W** and **Low 1 W** (CHIRP UV17Pro / `UV5RMini`).

| Step | Watts | Internal percent |
| --- | --- | --- |
| High | 5 W | **100** |
| Low | 1 W | **20** |
| Unset | — | **`null`** |

On export, `null` maps to the **High** wire step for each adapter (CHIRP `5.0W`, NeonPlug `High`).

## Adapter wire spelling

| Adapter | Profile | High | Low | Notes |
| --- | --- | --- | --- | --- |
| CHIRP Generic CSV | `chirp-uv5r` | `5.0W` | `1.0W` | Watt strings for `parse_power` / Generic CSV — not driver labels `High`/`Low` |
| NeonPlug | `neonplug-uv5rmini` | `High` | `Low` | Channel `power` enum; anything other than `Low` → High on write |

CHIRP column mapping for `Power`: [channels.md](../../../export-formats/chirp/channels.md).

## Related

- [capabilities.md](capabilities.md) · [limits.md](limits.md)
- Adapter stubs: [chirp-uv5r](../../../export-formats/chirp/radios/chirp-uv5r.md) · [uv5rmini](../../../export-formats/neonplug/radios/uv5rmini.md)
