# Anytone — AM airband (`AMAir.CSV`)

Separate **AM airband receive memory bank** for AT-D890UV — not stored in `Channel.CSV`.

**Fixture:** [`test-data/anytone/at-d890uv/AMAir.CSV`](../../../test-data/anytone/at-d890uv/AMAir.CSV)

## Headers

| Header           | Purpose                                          |
| ---------------- | ------------------------------------------------ |
| `No.`            | Slot index; VFO at high number (`257` in sample) |
| `Frequency[MHz]` | Receive frequency (4 decimal places)             |
| `Name`           | Wire label (padded in CPS export)                |

## Internal model mapping

| Wire             | Internal (target)                         | Status                                                                                                                                                     |
| ---------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Frequency[MHz]` | `Channel.rxFrequency` (Hz)                | **Maps today**                                                                                                                                             |
| `Name`           | `Channel.name` / build `wireName`         | **Maps today**                                                                                                                                             |
| _(implicit)_     | `modeProfiles: [{ mode: 'am', … }]`       | **Maps today**                                                                                                                                             |
| _(implicit)_     | `forbidTransmit: true`                    | **Maps today**                                                                                                                                             |
| `No.`            | `channelOverrides.orderOrSlot` in AM bank | VFO at fixed high slot (`257` in sample); export boundary — see CHIRP `orderOrSlot` pattern ([#243](https://github.com/pskillen/codeplug-studio/pull/243)) |

AM air channels are **library `Channel` rows** at the semantic level. Export adapter **partitions** receive-only AM channels into `AMAir.CSV` rather than `Channel.CSV` — adapter logic or a future build trait (`ParallelReceiveOnlyBanks`); not a new library entity type.

## AMZone.CSV

Analog zone layout for AM bank (header-only in sample fixture).

| Header                | Purpose                                 |
| --------------------- | --------------------------------------- |
| `Zone Name`           | AM zone wire name                       |
| `Zone Channel Member` | Member names                            |
| `A Channel`           | A-side channel                          |
| `Scan Channel `       | Scan channel (trailing space in header) |

Maps to build zone grouping for AM bank — deferred with AM export slice.

## Fidelity

| Direction | Status                                                                                 |
| --------- | -------------------------------------------------------------------------------------- |
| Import    | Planned                                                                                |
| Export    | Deferred post-DMR MVP ([#233](https://github.com/pskillen/codeplug-studio/issues/233)) |

## Related

- [bands.md](../bands.md) — airband frequency ranges
- [fm-broadcast.md](fm-broadcast.md) — sibling receive-only bank
- [channels.md](channels.md) — primary DMR channel table
