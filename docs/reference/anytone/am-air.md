# Anytone — AM airband (`AMAir.CSV` / `AMZone.CSV`)

Separate **AM airband receive memory bank** for AT-D890UV — not stored in `Channel.CSV`. Airband is a distinct radio mode with its own channel bank and zone file.

**Fixtures:**

- [`test-data/anytone/at-d890uv/AMAir.CSV`](../../../test-data/anytone/at-d890uv/AMAir.CSV) — minimal bank (1 programmed + VFO) for export golden
- [`test-data/anytone/at-d890uv/AMZone.CSV`](../../../test-data/anytone/at-d890uv/AMZone.CSV) — redacted body rows from operator CPS export ([#316](https://github.com/pskillen/codeplug-studio/issues/316))

## `AMAir.CSV` headers

| Header           | Purpose                                          |
| ---------------- | ------------------------------------------------ |
| `No.`            | Slot index; VFO at high number (`257` in sample) |
| `Frequency[MHz]` | Receive frequency (4 decimal places)             |
| `Name`           | Wire label — fixed **16-character** field        |

### Name column quirks (CPS export)

- CPS pads `Name` to **16 characters** with trailing spaces (`padReceiveBankName` on Studio export).
- Some operator exports contain **NUL (`U+0000`) bytes** inside `Name` cells (observed replacing a pad/space byte while keeping length 16). Treat as CPS corruption — **do not model or emit NULs**. On any future import, strip NULs before trim/pad.
- Zone / scan FKs use the **trimmed** name (no trailing spaces, no NULs) — see `AMZone.CSV` below.

## Internal model mapping (`AMAir.CSV`)

| Wire             | Internal (target)                         | Status                                                                                                                                                     |
| ---------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Frequency[MHz]` | `Channel.rxFrequency` (Hz)                | **Maps today**                                                                                                                                             |
| `Name`           | `Channel.name` / build `wireName`         | **Maps today**                                                                                                                                             |
| _(implicit)_     | `modeProfiles: [{ mode: 'am', … }]`       | **Maps today**                                                                                                                                             |
| _(implicit)_     | `forbidTransmit: true`                    | **Maps today**                                                                                                                                             |
| `No.`            | `channelOverrides.orderOrSlot` in AM bank | VFO at fixed high slot (`257` in sample); export boundary — see CHIRP `orderOrSlot` pattern ([#243](https://github.com/pskillen/codeplug-studio/pull/243)) |

AM air channels are **library `Channel` rows** at the semantic level. Export adapter **partitions** receive-only AM channels into `AMAir.CSV` rather than `Channel.CSV` — adapter logic or a future build trait (`ParallelReceiveOnlyBanks`); not a new library entity type.

## `AMZone.CSV`

Analog zone layout for the AM airband bank. Confirmed from a **populated** AT-D890UV CPS export (2 body rows, July 2026) — not the same schema as [`DMRZone.CSV`](zones.md).

**Do not invent DMR zone columns here.** AM zones omit RX/TX frequency companions, B-channel, and `Zone Hide`.

### Headers (5 columns)

| Header                | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `No.`                 | Zone index (1-based in sample)                                          |
| `Zone Name`           | AM zone wire name                                                       |
| `Zone Channel Member` | Pipe-separated **trimmed** `AMAir.CSV` channel names (membership order) |
| `A Channel`           | A-side active channel name (must be a member)                           |
| `Scan Channel `       | Pipe-separated scan members — **trailing space in header**              |

### Observed body-row behaviour

| Rule                         | Evidence from operator export                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Member FKs                   | Every `Zone Channel Member` / `A Channel` / `Scan Channel ` token matched an `AMAir.CSV` `Name` after trim (excl. VFO) |
| No frequency columns         | Unlike `DMRZone.CSV`, members are name-only                                                                            |
| `A Channel`                  | Always one of the zone members                                                                                         |
| `Scan Channel `              | Ordered subset of members (not necessarily all); empty not observed                                                    |
| Airband / DMR partition      | Zero `AMAir` names appeared in `DMRZone.CSV` in the same export                                                        |
| `FMZone.CSV`                 | Not present in this export (broadcast FM zone partition still unconfirmed)                                             |

### Internal mapping

| Wire                  | Internal (target)                                                                      |
| --------------------- | -------------------------------------------------------------------------------------- |
| `Zone Name`           | Build zone entry `wireName` (AM projection)                                            |
| `Zone Channel Member` | Ordered airband `memberChannelIds` via trimmed name → UUID at boundary                 |
| `A Channel`           | Format-specific A-side active channel hint                                             |
| `Scan Channel `       | Format-specific scan membership for the AM zone (subset of members) — export defaults TBD |

Maps to **build zone grouping** projected at the Anytone boundary into the AM bank ([#316](https://github.com/pskillen/codeplug-studio/issues/316)). Export must not put airband members into `DMRZone.CSV`.

### Fixture note

Committed `AMZone.CSV` uses **synthetic** zone/channel labels redacted from the operator sample (structure and column semantics preserved: multi-member zones, A-channel, scan subset). Minimal `AMAir.CSV` golden still has a single programmed channel (`Air station 1`) for export tests — it does not list every synthetic AM zone member name.

## Fidelity

| File         | Direction | Status                                                                                         |
| ------------ | --------- | ---------------------------------------------------------------------------------------------- |
| `AMAir.CSV`  | Import    | Planned ([#229](https://github.com/pskillen/codeplug-studio/issues/229))                      |
| `AMAir.CSV`  | Export    | Shipped ([#267](https://github.com/pskillen/codeplug-studio/issues/267))                       |
| `AMZone.CSV` | Import    | Planned ([#229](https://github.com/pskillen/codeplug-studio/issues/229))                      |
| `AMZone.CSV` | Export    | Deferred — wire schema confirmed; partition serialiser tracked in [#316](https://github.com/pskillen/codeplug-studio/issues/316) |

## Related

- [zones.md](zones.md) — `DMRZone.CSV` (different column set)
- [bands.md](../bands.md) — airband frequency ranges
- [fm-broadcast.md](fm-broadcast.md) — sibling receive-only bank
- [channels.md](channels.md) — primary DMR channel table
- [csv-reconciliation-gaps.md](../../features/import-export/anytone/csv-reconciliation-gaps.md) — P1 airband partition
