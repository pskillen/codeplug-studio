# AT-D890UV — memory layout

Sparse multi‑MB codeplug regions for Anytone AT-D890UV (`D890_MAP`). There is **no** single contiguous clone image like RT95 (`0x32A0`) or UV-5R Mini (`0x8240`).

**Hub:** [README.md](README.md) · **Protocol:** [protocol.md](protocol.md)

> Bases below are **D890 only**. D878UVII uses a different map (`D878II_MAP`) — see [#648](https://github.com/pskillen/codeplug-studio/issues/648). Do not mix.

Cite: anytone-cps `D890_MAP` + `Device` read/write helpers — facts only; do not paste GPL sources.

## Transfer sizes

| Constant     | Value       | Role                                      |
| ------------ | ----------- | ----------------------------------------- |
| Block size   | `0x10` (16) | Serial R/W quantum ([protocol.md](protocol.md)) |
| Channel record | `0x80`    | Combined primary+secondary (field layout in channel-record sibling) |
| Max channels | 4000        | ChannelSet bitmap capacity / CSV limits   |

## First-adapter region table (`D890_MAP`)

Addresses are **radio absolute** (u32). Read only enabled slots via each region’s set bitmap (except MasterId / LocalInfo).

| Region / field              | Base / value   | Stride / length (facts)                         | Role |
| --------------------------- | -------------- | ----------------------------------------------- | ---- |
| `LocalInfo`                 | `0x4f80000`    | Read/write `0x100`                              | Device / local info block |
| `ChannelSet`                | `0x3482a00`    | Bitmap `0x200` bytes                            | Occupied channel bits (bit = slot present) |
| `ChannelData`               | `0x1000000`    | See address formula below                       | Channel bodies |
| `ChannelDataOffset`         | `0x80`         | Entry stride within a block                     | Bytes between channel slots in a block |
| `ChannelDataBlockSize`      | `128`          | Channels per block                              | |
| `ChannelDataBlockOffset`    | `0x80000`      | Bytes between blocks                            | |
| `ChannelDataSecondaryOffset`| `0x40`         | Primary → secondary half                        | On D890 the two halves are adjacent (`0x40`+`0x40`) |
| `ZoneSet`                   | `0x3482c00`    | Bitmap `0x20` bytes                             | Occupied zone bits |
| `ZoneHide`                  | `0x3482c20`    | Bitmap `0x20`                                   | Hidden-zone bits |
| `ZonesName`                 | `0x3600000`    | Stride `ZoneDataOffset`=`0x40`; len `0x20`      | Zone name (UTF-16 / wide on D890) |
| `ZoneChannels`              | `0x2000000`    | Per-zone `0x200` (u16 member indices)           | Zone membership |
| `ZoneAChannel`              | `0x3500400`    | Table `0x200` (u16 per zone)                    | A-channel index |
| `ZoneBChannel`              | `0x3500600`    | Table `0x200` (u16 per zone)                    | B-channel index |
| `RadioIdSet`                | `0x3482c40`    | Bitmap `0x20`                                   | Radio ID occupancy |
| `RadioIdData`               | `0x3680000`    | Stride `0x40`; length `0x40`                    | Radio ID records |
| `ScanListSet`               | `0x3482c60`    | Bitmap `0x20`                                   | Scan-list occupancy |
| `ScanListData`              | `0x2100000`    | Stride `0x200`; length `0xd0`                   | Scan-list records |
| `TalkgroupSet`              | `0x3980000`    | Bitmap `0x4F0` (**inverted**: bit set → empty)  | Talkgroup occupancy |
| `TalkgroupData`             | `0x3a00000`    | Stride `0xc8`; length `0x80`                    | Talkgroup / contact-ish records |
| `TalkgroupOrder`            | `0x3f00000`    | (order table — defer detail)                    | Sort / order |
| `ReceiveGroupSet`           | `0x3701510`    | Bitmap `0x10`                                   | RX-group occupancy |
| `ReceiveGroupData`          | `0x3780000`    | Stride `0x200`; length `0x120`                  | Receive-group lists |
| `MasterIdData`              | `0x3684000`    | Length `0x40`                                   | Master / default radio ID |

Channel / zone field layouts ship in sibling pages on this radio home (channel-record / zone-record).

## Channel address formula

For 0-based channel index `idx`:

```text
blockIndex   = idx / 128          // ChannelDataBlockSize
indexInBlock = idx % 128
primaryAddr  = 0x1000000
             + (blockIndex * 0x80000)   // ChannelDataBlockOffset
             + (indexInBlock * 0x80)    // ChannelDataOffset
secondaryAddr = primaryAddr + 0x40      // ChannelDataSecondaryOffset
```

Read/write **64 + 64** bytes (primary then secondary) and concatenate to a **`0x80`** combined record before decode. On D890 the halves are contiguous; still treat them as two 16-aligned transfers of `0x40` (multiple of 16).

Only indices with a set bit in `ChannelSet` are present.

## Occupancy bitmaps (summary)

| Set            | Size    | Sense                                      |
| -------------- | ------- | ------------------------------------------ |
| ChannelSet     | `0x200` | Bit **set** → channel slot occupied        |
| ZoneSet        | `0x20`  | Bit **set** → zone occupied                |
| RadioIdSet     | `0x20`  | Bit **set** → radio ID occupied            |
| ScanListSet    | `0x20`  | Bit **set** → scan list occupied           |
| ReceiveGroupSet| `0x10`  | Bit **set** → receive group occupied       |
| TalkgroupSet   | `0x4F0` | Bit **set** → slot **empty** (inverted)    |

Bit indexing: slot `n` → byte `n // 8`, bit `n % 8`.

## Known gaps (deferred)

Not required for the first adapter; document existence only:

| Region family                         | Bases (D890)                         | Notes |
| ------------------------------------- | ------------------------------------ | ----- |
| Boot / BK images                      | `0x3f80000`, `0x4000000`, `0x4080000` | Large image blobs |
| DigitalContact\*                      | `0x7000000` …                        | Huge contact banks |
| AES / ARC4 / EncryptionCode\*         | `0x3580000` …                        | Crypto material — treat carefully |
| AmAir / AmZone\*                      | `0x3880000` …                        | AM airband |
| RoamingChannel\* / RoamingZone\*      | `0x2080000` …                        | Roaming |
| PrefabSms\*, AnalogBook\*, GpsRoaming | various                              | Secondary features |
| Talkgroup / digital-contact whitelist | `0x4c80000` / `0x4c82000`            | D890-specific lists |

Full map fields live in anytone-cps `D890_MAP`; expand these pages when an adapter slice needs them.

## Verification

Cross-checked against:

| Fact set                         | Source                                      |
| -------------------------------- | ------------------------------------------- |
| Region bases / strides / lengths | anytone-cps `D890_MAP`                      |
| Channel / zone address formulas  | anytone-cps `Device::readChannelData` / `readZoneData` / writers |
| Serial block size / framing      | anytone-cps `SerialDevice`                  |

A live radio dump is optional for this doc ticket; capture guidance ships as `fixtures.md` on this radio home.

## Related

- [protocol.md](protocol.md) · [limits.md](limits.md) · [power.md](power.md)
- D878UVII map (sibling): [#648](https://github.com/pskillen/codeplug-studio/issues/648)
