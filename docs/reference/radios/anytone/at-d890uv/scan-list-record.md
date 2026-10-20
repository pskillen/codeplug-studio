# AT-D890UV — scan-list record

Per-slot scan-list element for Anytone AT-D890UV (`ScanListData` in `D890_MAP`).

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

⚠️ **Do not cite anytone-cps for this record** — wrong record length (`0xd0` vs `0xF9`), member count (50 vs 100), and revert offset (`0x94` is member slot 50, not revert). Ground truth: official CPS hardware dumps (2026-07-29); facts only — do not paste GPL sources.

## Geometry

List _i_ (0-based) is banked. Stride `0x200` applies inside a bank of 32 lists. The next bank starts `0x80000` later. Index 32 is `0x2180000`, not the first byte after bank 0 (`0x2104000`).

```text
0x2100000 + floor(i / 32) * 0x80000 + (i % 32) * 0x200
```

| Index | Address     |
| ----- | ----------- |
| 0     | `0x2100000` |
| 31    | `0x2103E00` |
| 32    | `0x2180000` |
| 33    | `0x2180200` |

| Item           | Value                                                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ScanListSet`  | `0x3482c60`, bitmap `0x20` (256 bits). Encode clears bits below 250; bits 250–255 stay from the radio.                                                                           |
| `ScanListData` | `0x2100000`                                                                                                                                                                      |
| Bank           | 32 lists, pitch `0x80000`. The gap between banks is not payload.                                                                                                                 |
| Stride         | `0x200` inside a bank                                                                                                                                                            |
| Used record    | `0x00`–`0xF9` (Studio encode span `0xfa`; full stride zero-fill deferred — [#842](https://github.com/pskillen/codeplug-studio/issues/842) F4). `0xFA`/`0xFB` sit past that span. |
| Max lists      | 250 (`AT_D890UV_LIMITS.SCAN_LISTS_MAX`)                                                                                                                                          |
| Max members    | 100 u16 slots at `+0x30`…`+0xF7`                                                                                                                                                 |

## ScanListSet bitmap

Bit **set** → list occupied. Same indexing as channels/zones: list `n` → byte `n // 8`, bit `n % 8`.

## Field offset table (`0x00`–`0xF9`)

| Offset        | Field                     | Encoding                                            |
| ------------- | ------------------------- | --------------------------------------------------- |
| `0x00`        | unknown                   | preserved from the downloaded record                |
| `0x01`        | `priority_channel_select` | u8 enum — see below                                 |
| `0x02`–`03`   | `priority_channel_1`      | u16 LE — see below                                  |
| `0x04`–`05`   | `priority_channel_2`      | u16 LE — same                                       |
| `0x06`        | look back time A          | u8 **deciseconds** (2.5 s → `25`); `0x07` preserved |
| `0x08`        | look back time B          | u8 deciseconds; `0x09` preserved                    |
| `0x0A`        | dropout delay time        | u8 deciseconds; `0x0B` preserved                    |
| `0x0C`        | dwell time                | u8 deciseconds; `0x0D` preserved                    |
| `0x0e`–`0x2d` | name                      | wide-char `0x20` bytes                              |
| `0x30`–`0xF7` | member slots (100 × u16)  | 0-based global channel index; `0xffff` = empty      |
| `0xF8`        | `revert_channel`          | u8 enum — see below                                 |
| `0xF9`        | —                         | preserved from the downloaded record                |

`0xFA` and `0xFB` are outside the `0xfa` encode span. On a slot Studio rewrites, those two bytes, plus `0x00`, `0x07`, `0x09`, `0x0B`, `0x0D`, and `0xF9`, are copied from the downloaded stride. Studio does not invent values for them. Official CPS writes the **full `0x200` stride**, zero-filled past `0xF9`.

## Enums

### `priority_channel_select` (`0x01`)

| Wire   | UI                        |
| ------ | ------------------------- |
| `0x00` | Off                       |
| `0x01` | Priority Channel Select 1 |
| `0x02` | Priority Channel Select 2 |
| `0x03` | Select 1 + Select 2       |

### `priority_channel_1` / `_2` (u16 LE at `0x02` / `0x04`)

| Wire     | Meaning               |
| -------- | --------------------- |
| `0xffff` | Off                   |
| `0x0000` | Current Channel       |
| `n ≥ 1`  | channel index `n − 1` |

### `revert_channel` (`0xF8`, u8)

| Wire   | UI                             |
| ------ | ------------------------------ |
| `0x00` | Selected                       |
| `0x01` | Selected + TalkBack            |
| `0x02` | Priority Channel Select 1      |
| `0x03` | Priority Channel Select 2      |
| `0x04` | Last Called                    |
| `0x05` | Last Used                      |
| `0x06` | Select 1 + TalkBack            |
| `0x07` | Select 2 + TalkBack (inferred) |

## Studio write contract

- **Members:** global 0-based channel indices (`toAtD890ChannelIndex`).
- **Priority 1 / 2:** `0xffff` (Off) until library modelling ([#572](https://github.com/pskillen/codeplug-studio/issues/572)).
- **Revert:** `0x01` (_Selected + TalkBack_) at `0xF8` — matches CPS default on imported lists. This byte is modelled; it is not copied from the download.
- **Timing (all four):** one byte at `0x06`, `0x08`, `0x0A`, and `0x0C`. `30` deciseconds (3.0 s) when build `exportSettings` unset; override via Export settings ([#1069](https://github.com/pskillen/codeplug-studio/issues/1069)); shared with CSV via `resolveAtD890ScanListTiming` / `scanListWireDefaults.ts`. Per-list library settings: [#572](https://github.com/pskillen/codeplug-studio/issues/572).
- **Preserved on rewrite:** `0x00`, `0x07`, `0x09`, `0x0B`, `0x0D`, `0xF9`, `0xFA`, `0xFB` from the downloaded record. Unoccupied indices below the cap are still `0xff`-filled for the whole stride.
- **Channel scan-list FK:** zone-derived FK on **carriers only** on Web Serial; see [zone-derived-scan-lists.md](../../../zone-derived-scan-lists.md). Library lists on serial: [#843](https://github.com/pskillen/codeplug-studio/issues/843).

Codec: `src/integrations/radio-io/radios/at-d890uv/scanListCodec.ts`.

## Related

- [limits.md](limits.md) · [channel-record.md](channel-record.md) (`0x1b` scan list index; `0x34` `auto_scan` bit)
- CSV: [export-formats/anytone/scan-lists.md](../../../export-formats/anytone/scan-lists.md)
