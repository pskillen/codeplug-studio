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
- Hide flag is independent of occupancy: bit **set** → hidden. A zone is **visible** when its ZoneSet bit is set and its ZoneHide bit is clear.
- Firmware **rejects zero visible zones** (empty ZoneSet, or every occupied zone hidden) with _Program Error Please Initialize The Radio_ — confirmed on hardware, including assemble-from-`0xff` leaving ZoneHide all-set ([#1125](https://github.com/pskillen/codeplug-studio/issues/1125)). Sibling refusal for empty projection: [#880](https://github.com/pskillen/codeplug-studio/issues/880).
- Studio Write **zeros ZoneHide** on encode (hide is not modelled). Occupied zones are therefore visible. Write is refused before PROGRAM / write frames when the image would have zero visible zones.

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
- Entries are **u16** **0-based global channel indices** (`channels.at(idx)` / `ch->id`) at offsets `0, 2, 4, …`.
- Skip `0xFFFF`.
- CSV export warns at **64** members ([limits.md](limits.md)); binary capacity of the `0x200` buffer is larger (`0x100` u16 slots) — adapter should still respect the product/CSV policy unless a later ticket expands it.

## A / B channel indices

Packed tables (not per-zone sparse reads):

Indices are **0-based positions into that zone’s member list** (`member_channels.indexOf(aChannel)` in anytone-cps), **not** global channel numbers.

| Table | Address     | Entry                    | Semantics                                                              |
| ----- | ----------- | ------------------------ | ---------------------------------------------------------------------- |
| A     | `0x3500400` | `u16` at `zoneIndex * 2` | Zone-local member index (default **0**)                                |
| B     | `0x3500600` | `u16` at `zoneIndex * 2` | Zone-local member index (default **1**, or **0** when only one member) |

Studio Write sets A=`0` and B=`1` (or B=`0` for single-member zones). Preserve unknown values on RMW.

## Read path (summary)

1. Read ZoneSet (`0x20`) → list of occupied zone indices.
2. Read A/B tables (`0x200` each) and ZoneHide (`0x20`) once.
3. For each occupied index: read name (`0x20` at stride `0x40`), read membership (`0x200`), attach A/B + hide bit.

## Related

- [memory-layout.md](memory-layout.md) · [channel-record.md](channel-record.md) · [protocol.md](protocol.md)
- CSV zones: [export-formats/anytone](../../../export-formats/anytone/README.md)
