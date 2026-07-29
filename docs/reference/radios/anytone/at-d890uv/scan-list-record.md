# AT-D890UV — scan-list record

Per-slot scan-list element for Anytone AT-D890UV (`ScanListData` in `D890_MAP`).

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

⚠️ **Do not cite anytone-cps for this record** — wrong record length (`0xd0` vs `0xF9`), member count (50 vs 100), and revert offset (`0x94` is member slot 50, not revert). Ground truth: official CPS hardware dumps (2026-07-29); facts only — do not paste GPL sources.

## Geometry

| Item            | Value                                                                 |
| --------------- | --------------------------------------------------------------------- |
| `ScanListSet`   | `0x3482c60`, bitmap `0x20`                                            |
| `ScanListData`  | `0x2100000`                                                           |
| Stride          | `0x200` per list index                                                |
| Used record     | `0x00`–`0xF9` (Studio encode span `0xfa` today; full stride zero-fill deferred — [#842](https://github.com/pskillen/codeplug-studio/issues/842) F4) |
| Max lists       | 100 (`ScanListSet` bitmap)                                            |
| Max members     | 100 u16 slots at `+0x30`…`+0xF7`                                     |

```text
scanListAddr = 0x2100000 + (listIndex * 0x200)
```

## ScanListSet bitmap

Bit **set** → list occupied. Same indexing as channels/zones: list `n` → byte `n // 8`, bit `n % 8`.

## Field offset table (`0x00`–`0xF9`)

| Offset     | Field                      | Encoding                                                                 |
| ---------- | -------------------------- | ------------------------------------------------------------------------ |
| `0x00`     | unknown                    | `0x00` in CPS samples                                                    |
| `0x01`     | `priority_channel_select`  | u8 enum — see below                                                      |
| `0x02`–`03` | `priority_channel_1`       | u16 LE — see below                                                       |
| `0x04`–`05` | `priority_channel_2`       | u16 LE — same                                                            |
| `0x06`–`07` | look back time A           | u16 LE **deciseconds** (2.5 s → `25`)                                    |
| `0x08`–`09` | look back time B           | u16 LE deciseconds                                                       |
| `0x0a`–`0b` | dropout delay time         | u16 LE deciseconds                                                       |
| `0x0c`–`0d` | dwell time                 | u16 LE deciseconds                                                       |
| `0x0e`–`0x2d` | name                       | wide-char `0x20` bytes                                                   |
| `0x30`–`0xF7` | member slots (100 × u16)   | 0-based global channel index; `0xffff` = empty                           |
| `0xF8`     | `revert_channel`           | u8 enum — see below                                                      |
| `0xF9`     | —                          | `0x00` in all sampled records                                            |

Official CPS writes the **full `0x200` stride**, zero-filled past `0xF9`.

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
- **Revert:** `0x01` (*Selected + TalkBack*) — matches CPS default on imported lists.
- **Timing (all four):** `30` deciseconds (3.0 s) — temporary pin until [#572](https://github.com/pskillen/codeplug-studio/issues/572); shared with CSV via `scanListWireDefaults.ts`.
- **Channel scan-list FK:** zone-derived FK on **carriers only** on Web Serial; see [zone-derived-scan-lists.md](../../../zone-derived-scan-lists.md). Library lists on serial: [#843](https://github.com/pskillen/codeplug-studio/issues/843).

Codec: `src/integrations/radio-io/radios/at-d890uv/scanListCodec.ts`.

## Related

- [limits.md](limits.md) · [channel-record.md](channel-record.md) (`0x1b` scan list index; `0x34` `auto_scan` bit)
- CSV: [export-formats/anytone/scan-lists.md](../../../export-formats/anytone/scan-lists.md)
