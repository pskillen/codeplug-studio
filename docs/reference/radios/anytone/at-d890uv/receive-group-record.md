# AT-D890UV — receive-group record

Per-slot receive-group (RX group list) element for Anytone AT-D890UV (`ReceiveGroup::encode` / `decode`). Stored at `ReceiveGroupData` with stride **`0x200`**; Studio encodes **`0x120`** bytes per occupied slot.

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

Cite: anytone-cps `ReceiveGroup::encode` — facts only; do not paste GPL sources.

## Geometry

| Fact             | Value                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Record size      | `0x120` (288) bytes encode                                                                |
| Stride           | `0x200` between slots                                                                     |
| Max slots        | `ReceiveGroupSet` bitmap `0x10` bytes × 8 bits                                            |
| Occupancy        | Bit **set** → slot occupied ([memory-layout.md](memory-layout.md))                       |
| Max members      | 32 per list ([limits.md](limits.md))                                                      |
| Name storage     | `0x20` bytes at offset `0x100` (wide-char / UTF-16 style packing)                         |
| Name display cap | 10 chars (CSV / [limits.md](limits.md))                                                   |

## Address formula

0-based index `idx`:

```text
receiveGroupAddr = 0x3780000 + (idx * 0x200)
```

## ReceiveGroupSet bitmap

| Item     | Value                                 |
| -------- | ------------------------------------- |
| Base     | `0x3701510`                           |
| Size     | `0x10` bytes                          |
| Sense    | Bit **set** → slot occupied           |
| Indexing | Slot `n` → byte `n // 8`, bit `n % 8` |

## Member payload (`0x0`–`0xFF`)

- Up to **32** entries at offsets `0, 4, 8, …` (u32 LE each).
- Each value is a **0-based talkgroup bank slot index** (`Talkgroup.id` in anytone-cps), **not** the talkgroup DMR ID.
- Unused slots are filled with `0xFFFFFFFF`.
- Member order must match the talkgroup bank encode order (`TalkgroupData` slots `0..N-1`).

### Index vs DMR ID

| Talkgroup bank slot | DMR ID (example) | RX member wire (u32 LE) |
| ------------------- | ---------------- | ----------------------- |
| 0                   | 91               | `02 00 00 00`           |
| 1                   | 9                | `03 00 00 00`           |
| 2                   | 23559            | `04 00 00 00`           |

Studio `RadioWriteProjection` for `radio-io-at-d890uv` resolves library RX list members (UUID talk-group refs) to these **bank indices** via the same ordering as `TalkgroupData` encode. DM-32 Web Serial uses raw DMR IDs instead — do not copy that semantics here.

## Name (`0x100`–`0x11F`)

```text
nameAddr = receiveGroupAddr + 0x100
```

Read/write `0x20` bytes. On D890, encode with wide-character packing (anytone-cps `Format::wideCharString`).

## Channel FK

DMR channel byte `0x1c` stores the **1-based receive-group list index** (see [channel-record.md](channel-record.md)). That index selects which `ReceiveGroupData` slot is active; members inside the record are talkgroup bank indices.

## Studio module

`src/integrations/radio-io/radios/at-d890uv/rxGroupCodec.ts` — `encodeAtD890RxGroupRecord`, `encodeRxGroupsIntoAtD890Image`.

## Related

- [#723](https://github.com/pskillen/codeplug-studio/issues/723) — RX member slot-index projection fix
- [talkgroup-record.md](talkgroup-record.md) — talkgroup bank ordering that RX indices reference
- [channel-record.md](channel-record.md) — channel RX-group FK byte
