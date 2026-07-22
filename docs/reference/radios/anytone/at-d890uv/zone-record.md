# AT-D890UV — zone record

Zone occupancy, names, membership, and A/B channel indices for Anytone AT-D890UV (`D890_MAP` + `Device::readZoneData` / `writeZoneData`).

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

Cite: anytone-cps — facts only; do not paste GPL sources.

## Geometry

| Item               | Base / value               | Notes                                                    |
| ------------------ | -------------------------- | -------------------------------------------------------- |
| `ZoneSet`          | `0x3482c00`, size `0x20`   | Bit **set** → zone occupied                              |
| `ZoneHide`         | `0x3482c20`, size `0x20`   | Bit **set** → zone hidden                                |
| `ZonesName`        | `0x3600000`                | Per-zone name                                            |
| Name stride        | `ZoneDataOffset` = `0x40`  |                                                          |
| Name length        | `ZoneDataLength` = `0x20`  | D890: **wide-char** (UTF-16 style), not UTF-8            |
| `ZoneChannels`     | `0x2000000`                | Membership lists                                         |
| Channels per zone  | `0x200` bytes              | u16 channel indices; stride `0x200` per zone index       |
| Invalid member     | `0xFFFF`                   | Skip / end filler                                        |
| `ZoneAChannel`     | `0x3500400`, table `0x200` | u16 A-channel index per zone (`idx * 2`)                 |
| `ZoneBChannel`     | `0x3500600`, table `0x200` | u16 B-channel index per zone                             |
| Max zones (bitmap) | 256 bits (`0x20 × 8`)      | CSV zone-member cap is separate ([limits.md](limits.md)) |

## ZoneSet / ZoneHide

Same bit indexing as channels: zone `n` → byte `n // 8`, bit `n % 8`.

- Empty zone (no members): clear ZoneSet bit; anytone-cps still writes default A/B indices (`0` / `1`) into the A/B tables for that slot.
- Hide flag is independent of occupancy.

## Name

```text
nameAddr = 0x3600000 + (zoneIndex * 0x40)
```

Read/write `0x20` bytes. On D890, encode with wide-character packing (anytone-cps `Format::wideCharString`); D878UVII family uses UTF-8 left-justified in the same length — do not mix.

Display / CSV name length remains **16** characters ([limits.md](limits.md)).

## Membership (`ZoneChannels`)

```text
listAddr = 0x2000000 + (zoneIndex * 0x200)
```

- Buffer length `0x200`.
- Entries are **u16** channel indices at offsets `0, 2, 4, …`.
- Skip `0xFFFF`.
- CSV export warns at **64** members ([limits.md](limits.md)); binary capacity of the `0x200` buffer is larger (`0x100` u16 slots) — adapter should still respect the product/CSV policy unless a later ticket expands it.

## A / B channel indices

Packed tables (not per-zone sparse reads):

| Table | Address     | Entry                    |
| ----- | ----------- | ------------------------ |
| A     | `0x3500400` | `u16` at `zoneIndex * 2` |
| B     | `0x3500600` | `u16` at `zoneIndex * 2` |

Indices refer into the channel list / membership semantics used by anytone-cps (zone-local vs global — confirm at adapter time against decode path). Preserve unknown values on RMW.

## Read path (summary)

1. Read ZoneSet (`0x20`) → list of occupied zone indices.
2. Read A/B tables (`0x200` each) and ZoneHide (`0x20`) once.
3. For each occupied index: read name (`0x20` at stride `0x40`), read membership (`0x200`), attach A/B + hide bit.

## Related

- [memory-layout.md](memory-layout.md) · [channel-record.md](channel-record.md) · [protocol.md](protocol.md)
- CSV zones: [export-formats/anytone](../../../export-formats/anytone/README.md)
