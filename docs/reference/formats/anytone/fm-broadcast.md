# Anytone — broadcast FM (`FM.CSV`)

Separate **broadcast FM receive memory bank** for AT-D890UV.

**Fixture:** [`test-data/anytone/at-d890uv/FM.CSV`](../../../../test-data/anytone/at-d890uv/FM.CSV)

## Headers

| Header           | Purpose                                                          |
| ---------------- | ---------------------------------------------------------------- |
| `No.`            | Slot index; VFO at `101` in sample                               |
| `Frequency[MHz]` | Receive frequency (MHz, 3 decimal in sample)                     |
| `Scan`           | Scan participation — confirmed `Add` / `Del` (include / exclude) |
| `Name`           | Wire label                                                       |

There is **no `FMZone.CSV`** on AT-D890UV.

## Internal model mapping

| Wire             | Internal (target)                                      | Status                                                                   |
| ---------------- | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `Frequency[MHz]` | `Channel.rxFrequency` (Hz)                             | **Maps today**                                                           |
| `Name`           | `Channel.name` / build `wireName`                      | **Maps today**                                                           |
| `No.`            | `channelOverrides.orderOrSlot` in FM bank              | VFO at fixed high slot (`101` in sample) — optional; CPS may correct     |
| `Scan`           | `Channel.scanInclusion` + build `defaultScanInclusion` | **Maps today** — `Add` when effective inclusion is scan, `Del` when skip |
| _(implicit)_     | `modeProfiles: [{ mode: 'fm', … }]`                    | **Maps today**                                                           |
| _(implicit)_     | `forbidTransmit: true`                                 | **Maps today**                                                           |

UK FM broadcast band: [bands.md](../../bands.md) (`fm-broadcast`, 87.5–108 MHz).

Export adapter partitions library channels with `mode: 'fm'` and receive-only semantics into `FM.CSV` — same architectural note as [am-air.md](am-air.md).

## Fidelity

| Direction | Status                                                                   |
| --------- | ------------------------------------------------------------------------ |
| Import    | Planned                                                                  |
| Export    | Shipped ([#268](https://github.com/pskillen/codeplug-studio/issues/268)) |

## Related

- [am-air.md](am-air.md)
- [Data model — ChannelModeProfileAnalog](../../../features/data-model/README.md)
