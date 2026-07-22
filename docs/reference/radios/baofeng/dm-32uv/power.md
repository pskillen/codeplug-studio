# DM-32UV — power and squelch ladders

Internal Studio `power` / `squelch` are **0–100 percent** (or `null` = unset / radio default).

## Power

| Step | Wire | Internal percent |
| --- | --- | --- |
| High | `High` | **100** |
| Middle | `Middle` | **50** |
| Low | `Low` | **20** |
| Unset | empty | **`null`** |

On export, `null` defaults to **High**.

### Adapter wire spelling

| Adapter | Profile | High | Middle | Low |
| --- | --- | --- | --- | --- |
| DM32 CPS CSV | `dm32-baofeng-dm32uv` | `High` | `Middle` | `Low` |
| NeonPlug | `neonplug-dm32uv` | `High` | `Middle` | `Low` |

## Squelch

Same ladder on analogue and digital channels.

| Wire `Squelch Level` | Internal `squelch` % |
| --- | --- |
| `0`–`9` | `round(level × 100 / 9)` |

Empty wire → `null`.

## Related

- [capabilities.md](capabilities.md) · [limits.md](limits.md)
- Adapter profiles: [dm32 profiles.md](../../../export-formats/dm32/profiles.md) · [neonplug profiles.md](../../../export-formats/neonplug/profiles.md)
