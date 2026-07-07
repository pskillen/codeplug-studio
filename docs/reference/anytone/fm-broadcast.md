# Anytone — broadcast FM (`FM.CSV`)

Separate **broadcast FM receive memory bank** for AT-D890UV.

**Fixture:** [`test-data/anytone/at-d890uv/FM.CSV`](../../../test-data/anytone/at-d890uv/FM.CSV)

## Headers

| Header            | Purpose                                      |
| ----------------- | -------------------------------------------- |
| `No.`             | Slot index; VFO at `101` in sample           |
| `Frequency[MHz]`  | Receive frequency (MHz, 3 decimal in sample)   |
| `Scan`            | Scan list participation (`Add` / `Del`)      |
| `Name`            | Wire label                                   |

## Internal model mapping

| Wire             | Internal (target)                                      | Status        |
| ---------------- | ------------------------------------------------------ | ------------- |
| `Frequency[MHz]` | `Channel.rxFrequency` (Hz)                             | **Maps today** |
| `Name`           | `Channel.name` / build `wireName`                      | **Maps today** |
| `No.`            | `channelOverrides.orderOrSlot` in FM bank              | VFO at fixed high slot (`101` in sample) |
| `Scan`           | `Channel.scanInclusion` or build export knob           | **TBD** — `Add` may mean include in FM scan bank |
| _(implicit)_     | `modeProfiles: [{ mode: 'fm', … }]`                    | **Maps today** |
| _(implicit)_     | `forbidTransmit: true`                                 | **Maps today** |

UK FM broadcast band: [bands.md](../bands.md) (`fm-broadcast`, 87.5–108 MHz).

Export adapter partitions library channels with `mode: 'fm'` and receive-only semantics into `FM.CSV` — same architectural note as [am-air.md](am-air.md).

## Fidelity

| Direction | Status    |
| --------- | --------- |
| Import    | Planned   |
| Export    | Deferred post-DMR MVP |

## Related

- [am-air.md](am-air.md)
- [Data model — ChannelModeProfileAnalog](../../features/data-model/README.md)
