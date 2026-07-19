# Common TX offsets

Tier-2 RF domain reference for quick TX offset buttons on channel edit. Implementation: `src/core/domain/txOffsets.ts`. Band lookup uses [bands.md](bands.md) / `bandCatalog.ts`.

**Disclaimer:** Programming convenience only. Not authoritative for regional repeater plans or on-air operation.

## Behaviour

- Lookup band from **RX frequency** (first matching catalog row).
- Unknown / undocumented bands: **Simplex** (`0 MHz`) only.
- Display of the live offset: `===` when TX ≈ RX; otherwise `+/- X.XXX MHz` (trailing zeros trimmed).
- Quick buttons set `txFrequency = rxFrequency + offset` (Hz arithmetic).

## Documented offsets

| Band id | Label | Offsets (MHz)                          | Notes                                      |
| ------- | ----- | -------------------------------------- | ------------------------------------------ |
| `2m`    | 2 m   | `0` (Simplex), `−0.6`                  | Common UK/EU 2 m repeater split            |
| `70cm`  | 70 cm | `0` (Simplex), `+7.6`, `+9.0`          | Common UK 70 cm repeater splits            |

Other catalog bands are not listed yet — UI offers Simplex only until this table is extended. Airband duplex is out of scope until documented here.

## Related

- [bands.md](bands.md)
- [library feature](../features/library/README.md) — channel Frequencies tab
- Tracking: [#156](https://github.com/pskillen/codeplug-studio/issues/156)
