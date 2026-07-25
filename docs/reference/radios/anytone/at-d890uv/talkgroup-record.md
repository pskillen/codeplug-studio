# AT-D890UV — talkgroup record

Per-slot talkgroup element for Anytone AT-D890UV (`encode_D890UV` / `decode_D890UV`). Stored at `TalkgroupData` with stride **`0xc8`**; Studio encodes **`0xc8`** bytes per occupied slot.

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

Cite: anytone-cps `Talkgroup::encode_D890UV` + `Constants::CALL_TYPE` — facts only; do not paste GPL sources.

## Geometry

| Fact           | Value                                                                 |
| -------------- | --------------------------------------------------------------------- |
| Record size    | `0xc8` (200) bytes encode; CPS reads `0x80` (used fields fit)       |
| Stride         | `0xc8` between slots                                                  |
| Max slots      | `TalkgroupSet` bitmap `0x4F0` bytes × 8 bits                          |
| Occupancy      | **Inverted** bitmap — bit **set** → slot **empty** ([memory-layout.md](memory-layout.md)) |
| Name storage   | `0x20` bytes at offset `0x6` (wide-char / UTF-16 style packing)     |
| Name display cap | 16 chars (CSV / [limits.md](limits.md))                             |

## Address formula

0-based index `idx`:

```text
talkgroupAddr = 0x3a00000 + (idx * 0xc8)
```

Sparse serial/cache I/O uses a **16-aligned span** covering each slot (`alignDown(base + idx*0xc8)` …) because odd indices are not 16-aligned themselves. See [memory-layout.md](memory-layout.md).

## TalkgroupSet bitmap

| Item     | Value                                      |
| -------- | ------------------------------------------ |
| Base     | `0x3980000`                                |
| Size     | `0x4F0` bytes                              |
| Sense    | Bit **set** → slot **empty** (inverted)    |
| Indexing | Slot `n` → byte `n // 8`, bit `n % 8`      |

## Field offsets (encode `0xc8`)

| Offset      | Field      | Encoding / notes                                                                 |
| ----------- | ---------- | -------------------------------------------------------------------------------- |
| `0x0`       | Call type  | `Private=0`, `Group=1`, `All=2` (anytone-cps `CALL_TYPE`)                          |
| `0x1`       | Call alert | Bit flags (defer detail until adapter needs them)                                  |
| `0x2–0x5`   | DMR ID     | BCD-as-hex: hex digit string parsed as **decimal** (no ×10 scale). Encode: `padStart(8)` of decimal `digitalId` → byte pairs. **Not** binary `toString(16)`. |
| `0x6–0x25`  | Name       | Wide-char name (`0x20` bytes)                                                    |

### DMR ID packing examples

| Decimal ID | Wire bytes (hex) | Wrong (binary BE) |
| ---------- | ---------------- | ----------------- |
| 9          | `00 00 00 09`    | `00 00 00 09` (same for single digit) |
| 99         | `00 00 00 99`    | `00 00 00 63`     |
| 23559      | `00 02 35 59`    | `00 00 5c 07`     |

Same packing bridge as channel frequencies ([channel-record.md](channel-record.md)) but **without** the 10 Hz scale — use `encodeBcdAsHexU32` in `bcd.ts`.

### Call type enum

| Wire value | Meaning      |
| ---------- | ------------ |
| `0`        | Private call |
| `1`        | Group call   |
| `2`        | All call     |

Studio `RadioWriteProjection` carries NeonPlug quick-contact call types (`0x03` private, `0x04` group, `0x05` all) for DM-32. The AT-D890 adapter **remaps** those to Anytone `0/1/2` at encode time — never write NeonPlug `0x04` as group on D890 wire.

## Studio module

`src/integrations/radio-io/radios/at-d890uv/talkGroupCodec.ts` — `encodeAtD890TalkgroupRecord`, `encodeTalkgroupsIntoAtD890Image`.

## Related

- [#721](https://github.com/pskillen/codeplug-studio/issues/721) — BCD ID + call-type fix
- [#717](https://github.com/pskillen/codeplug-studio/issues/717) — channel BCD (same packing class with ×10)
- TalkgroupOrder (`0x3f00000`) — separate ticket; Studio v1 does not rebuild order table
