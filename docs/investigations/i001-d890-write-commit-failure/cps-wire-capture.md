# Official CPS write session — reference data

Decoded from three USBPcap captures of the **official Anytone CPS** on Windows, against real D890UV hardware.
Ledger ids `C/read`, `C/small`, `C/full` — see [`evidence.md`](evidence.md) for provenance and caveats.

This file is **reference data**, not argument. Decoded with `dev-tools/wire-capture-decoder/`; the raw
`.pcapng` files and decoded JSON are not in the repo.

**Primary evidence is `C/full`** (full codeplug, ran to completion). `C/small` was cut short and is secondary.

---

## Frame inventory — `C/full`

19,960 frames, **zero unknown**. Every frame decoded as one of:

| Direction | Frame | Notes |
| --------- | ----- | ----- |
| host→radio | `PROGRAM` | 7 bytes, no terminator |
| radio→host | `QX\x06` | `51 58 06` |
| host→radio | `0x02` | ident probe |
| radio→host | ident reply | ASCII model + version, `0x06`-terminated |
| host→radio | `R` = `52` + addr(4, BE) + len(1) | reads |
| host→radio | `W` = `57` + addr(4, BE) + `10` + 16 bytes + cksum + `06` | 9,976 of these |
| radio→host | `W` … `06` | read replies |
| radio→host | `06` | write ACK |
| host→radio | `END` | 3 bytes |

Checksum is an 8-bit sum of body bytes after the opcode. `checksum_ok` is `true` on every frame.

### Session shape

```
PROGRAM → QX\x06 → 0x02 → ident reply → one R/W-reply pair (version-ish read) → 9,976 × W → END → 06
```

Verified negatives, each checked programmatically:

| Checked | Result |
| ------- | ------ |
| Any frame between the last `W` and `END` | none — last `W` → `06` → `END` → `06` |
| Any frame between two `W` commands, at any address transition | **none, anywhere in the session** |
| Any frame between the ident probe and the first `W` | one read pair only |
| Any read (`52`) issued during the write phase | **zero** |
| `0x2FA0010` ever written | no |
| Any address written twice | no — 9,976 writes, 9,976 distinct addresses |
| Any `X` where `X+0x40000` also written | **zero** |
| The sector markers `+0x3fbf0` / `+0x3fff0` ever written | **zero**, in both write captures |

## Per-erase-unit write census

Erase units are `0x40000`-aligned, so 16,384 possible 16-byte chunks per unit. Density is against that.

| Erase unit | `C/full` chunks | `C/small` chunks | Density (`C/full`) | In Studio's map? |
| ---------- | --------------: | ---------------: | -----------------: | ---------------- |
| `0x01000000` | 1024 | 16 | 6.2% | yes — channels blk 0 |
| `0x01080000` | 424 | 8 | 2.6% | yes — channels blk 1 |
| `0x01f80000` | 16 | 16 | 0.1% | **no** |
| `0x02000000` | 352 | 32 | 2.1% | yes — zone membership |
| `0x02080000` | 27 | 27 | 0.2% | **no** |
| `0x02100000` | 352 | 32 | 2.1% | yes — scan lists |
| `0x02980000` | 14 | 14 | 0.1% | **no** |
| `0x03180000` | 160 | 160 | 1.0% | **no** |
| `0x03400000` | 14 | 14 | 0.1% | **no** |
| `0x03480000` | 199 | 199 | 1.2% | yes — occupancy bitmaps |
| `0x03500000` | 239 | 239 | 1.5% | yes — zone A/B, settings |
| `0x03580000` | **1367** | 1367 | 8.3% | **no** |
| `0x03600000` | 22 | 2 | 0.1% | yes — zone names |
| `0x03680000` | 8 | 8 | 0.0% | yes — radio IDs |
| `0x03700000` | 345 | 345 | 2.1% | yes — RX-group bitmap |
| `0x03780000` | 216 | 18 | 1.3% | yes — RX-group records |
| `0x03800000` | 20 | 20 | 0.1% | **no** |
| `0x03880000` | 133 | 11 | 0.8% | yes — airband |
| `0x03900000` | **2500** | 2500 | 15.3% | **no** |
| `0x03980000` | 79 | 79 | 0.5% | yes — talkgroup bitmap |
| `0x03a00000` | 425 | 13 | 2.6% | yes — talkgroup records |
| `0x03f00000` | 17 | 1 | 0.1% | yes — talkgroup order |
| `0x04980000` | 16 | 16 | 0.1% | **no** |
| `0x04a00000` | 3 | 3 | 0.0% | **no** |
| `0x04b00000` | 212 | 212 | 1.3% | **no** |
| `0x04b80000` | 34 | 34 | 0.2% | **no** |
| `0x04c00000` | 500 | 500 | 3.1% | **no** |
| `0x04c80000` | 1000 | 1000 | 6.1% | **no** |
| `0x18000000` | 250 | 106 | 1.5% | **no** |
| `0x18080000` | 8 | 8 | 0.0% | **no** |
| **Total** | **9,976** | **6,992** | — | |

Two properties worth restating:

- **CPS does not diff.** Most banks are byte-identical between a one-field edit and a full-codeplug write.
  It re-sends full bank content every session.
- **CPS is sparse.** Never denser than ~15% of an erase unit. Studio post-`fe6955e3` writes whole units,
  2,900–3,500 chunks/session across 13 units.

## Banks CPS writes that Studio does not model

17 erase units, checked against `constants.ts` and everything under
`src/integrations/radio-io/radios/at-d890uv/` — no match. (Checked against a false positive from
`eraseUnitProbe.ts`'s unrelated `0x1800000`–`0x2000000` erase-unit-size probe comments, which is a
different, shorter address.)

```
0x01f80000  0x02080000  0x02980000  0x03180000  0x03400000
0x03580000 (1367)       0x03800000  0x03900000 (2500)
0x03980000  0x04980000  0x04a00000  0x04b00000  0x04b80000
0x04c00000 (500)        0x04c80000 (1000)
0x18000000  0x18080000
```

`0x03900000` (densest bank in the whole capture) and `0x03580000` (second densest) are large enough to be
real, named features CPS models and Studio doesn't. `0x18000000`/`0x18080000` are almost entirely `0xff`
in this codeplug, so no content-based hint.

**Not investigated.** Two reasons this matters more than it looks:

1. Every hypothesis in this investigation so far assumes Studio writes a *subset* of the right addresses. If
   any of these holds a validity marker, index, or generation counter the firmware consults, that is invisible
   to all of them.
2. It is a possible user-visible feature gap independent of the write-commit question.

## Re-querying the captures

Frame-level JSON was produced under `reports/` in the working directory — a flat list of frame objects:

```json
{ "kind": "WRITE_CMD", "direction": "host->radio", "offset": 14, "length": 24,
  "hex": "5701000000104394…6a06",
  "fields": { "address": 16777216, "length": 16, "data": "43942500009000008d40000000000000" },
  "checksum_ok": true, "frame_numbers": [1613], "time_range": [...] }
```

`kind` values seen: `PROGRAM`, `WRITE_CMD`, and the read/ident/ACK/`END` shapes. Filter
`kind == "WRITE_CMD"` for the 9,976-entry address+payload oracle.

**Not yet analysed:** inter-frame timing. This capture set has timestamps (`time_range`) but only frame
*shape* has been examined. If the answer turns out to be timing or ordering rather than content, the data is
already on disk.
