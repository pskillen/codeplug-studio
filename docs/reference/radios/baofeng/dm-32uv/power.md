# DM-32UV — power and squelch ladders

## Power

Studio's DM-32UV output tops out at **High**. **Above High** (`101`) writes High. See the [native YAML channel fields](../../../export-formats/native-yaml/README.md#channel).

| Step   | Wire     | Internal percent |
| ------ | -------- | ---------------- |
| High   | `High`   | **100**          |
| Middle | `Middle` | **50**           |
| Low    | `Low`    | **20**           |
| Unset  | empty    | **`null`**       |

On export, `null` defaults to **High**.

### Adapter wire spelling

| Adapter      | Profile               | High   | Middle   | Low   |
| ------------ | --------------------- | ------ | -------- | ----- |
| DM32 CPS CSV | `dm32-baofeng-dm32uv` | `High` | `Middle` | `Low` |
| NeonPlug     | `neonplug-dm32uv`     | `High` | `Middle` | `Low` |

## Squelch

Studio stores `squelch` as **0–100 percent** or `null` for radio default. The same ladder applies to analogue and digital channels.

| Wire `Squelch Level` | Internal `squelch` %     |
| -------------------- | ------------------------ |
| `0`–`9`              | `round(level × 100 / 9)` |

Empty wire → `null`.

## Related

- [capabilities.md](capabilities.md) · [limits.md](limits.md)
- Adapter profiles: [dm32 profiles.md](../../../export-formats/dm32/profiles.md) · [neonplug profiles.md](../../../export-formats/neonplug/profiles.md)
