# AT-D890UV — receive-group record

Per-slot receive-group (RX group list) element for Anytone AT-D890UV (`ReceiveGroup::encode` / `decode`). Stored at `ReceiveGroupData` with stride **`0x200`**; Studio encodes **`0x120`** bytes per occupied slot.

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

Cite: anytone-cps `ReceiveGroup::encode` — facts only; do not paste GPL sources.

## Geometry

| Fact             | Value                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------- |
| Record size      | `0x120` (288) bytes — what Studio writes                                               |
| Stride           | `0x200` between slots                                                                  |
| Max slots        | **250** (`ReceiveGroupSet` bitmap `0x20` bytes × 8 bits)                               |
| Occupancy        | Bit **set** → slot occupied ([memory-layout.md](memory-layout.md))                     |
| Max members      | **64** per list ([limits.md](limits.md))                                               |
| Name storage     | `0x20` bytes at offset `0x100` — what Studio writes (wide-char / UTF-16 style packing) |
| Name display cap | 10 chars (CSV / [limits.md](limits.md))                                                |

## Address formula

0-based index `idx`:

```text
receiveGroupAddr = 0x3780000 + (idx * 0x200)
```

## ReceiveGroupSet bitmap

| Item     | Value                                 |
| -------- | ------------------------------------- |
| Base     | `0x3701510`                           |
| Size     | `0x20` bytes                          |
| Sense    | Bit **set** → slot occupied           |
| Indexing | Slot `n` → byte `n // 8`, bit `n % 8` |

## Member payload (`0x0`–`0xFF`)

- Up to **64** entries at offsets `0, 4, 8, …` (u32 LE each).
- Each value is a **0-based talkgroup bank slot index** (`Talkgroup.id` in anytone-cps), **not** the talkgroup DMR ID.
- Unused slots are filled with `0xFFFFFFFF`.
- Member order must match the talkgroup bank encode order (`TalkgroupData` slots `0..N-1`).
- Studio (`writeU32Le` of the index), anytone-cps, and the official CPS GCall encoder (`0x5b3b70`) write that raw 0-based index. The firmware RX-group reader was not checked.

### Index vs DMR ID

| Talkgroup bank slot | DMR ID (example) | RX member wire (u32 LE) |
| ------------------- | ---------------- | ----------------------- |
| 0                   | 91               | `00 00 00 00`           |
| 1                   | 9                | `01 00 00 00`           |
| 2                   | 23559            | `02 00 00 00`           |

The DMR ID column illustrates that the wire is not the DMR ID. Studio `RadioWriteProjection` for `radio-io-at-d890uv` resolves library RX list members (UUID talk-group refs) to these **bank indices** via the same ordering as `TalkgroupData` encode. DM-32 Web Serial uses raw DMR IDs instead — do not copy that semantics here.

## Name (`0x100`–`0x11F`)

```text
nameAddr = receiveGroupAddr + 0x100
```

Studio writes `0x20` name bytes at this offset inside a `0x120` record, with wide-character packing (anytone-cps `Format::wideCharString`). The official CPS transfer is `0x111` bytes, so that name is 16 characters (`0x100` + `0x11`). The geometry rows above are what Studio writes; this page does not shrink the encoder.

## Channel FK

DMR channel byte `0x1c` is a **0-based** list index (`0xFF` = none) selecting the `ReceiveGroupData` slot (see [channel-record.md](channel-record.md)). Members inside the record stay talkgroup bank indexes.

## Studio module

`src/integrations/radio-io/radios/at-d890uv/rxGroupCodec.ts` — `encodeAtD890RxGroupRecord`, `encodeRxGroupsIntoAtD890Image`.

## Related

- [#723](https://github.com/pskillen/codeplug-studio/issues/723) — RX member slot-index projection fix
- [talkgroup-record.md](talkgroup-record.md) — talkgroup bank ordering that RX indices reference
- [channel-record.md](channel-record.md) — channel RX-group FK byte
