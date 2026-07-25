# OpenGD77 — channel record

Shared **OpenGD77Base** channel element used by both GD-77-class and OpenUV380 images. Region bases differ by protocol group; field packing does not.

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

Cite: qdmr `lib/opengd77base_codeplug.hh` `ChannelElement` (prefer over `doc/code/opengd77_channel.txt`).

## Element size

| Fact               | Value                      |
| ------------------ | -------------------------- |
| Record size        | `0x38` (56 bytes)          |
| Name length        | 16 ASCII, `0xff` pad       |
| Frequency encoding | BCD8 little-endian × 10 Hz |

## Field offsets

| Field                                                        | Offset          | Encoding / notes                  |
| ------------------------------------------------------------ | --------------- | --------------------------------- |
| name                                                         | `0x00`          | 16 ASCII, `0xff` pad              |
| rxFrequency                                                  | `0x10`          | BCD8 LE, ×10 Hz                   |
| txFrequency                                                  | `0x14`          | BCD8 LE, ×10 Hz                   |
| mode                                                         | `0x18`          | See Mode enum                     |
| power                                                        | `0x19`          | `0` = global; `1`…`10` level      |
| latitude byte 0                                              | `0x1a`          | Packed angle (with `0x1c`/`0x1d`) |
| txTimeout                                                    | `0x1b`          | Units of 15 s; `0` = infinite     |
| latitude bytes 1/2                                           | `0x1c` / `0x1d` |                                   |
| longitude bytes 0/1                                          | `0x1e` / `0x1f` | Packed angle (with `0x24`)        |
| rxTone                                                       | `0x20`          | u16 LE; `0xffff` = off            |
| txTone                                                       | `0x22`          | u16 LE; `0xffff` = off            |
| longitude byte 2                                             | `0x24`          |                                   |
| flags                                                        | `0x26`          | Bitfield (below)                  |
| dmrId                                                        | `0x27`          | 24-bit BE (when override set)     |
| groupList                                                    | `0x2b`          | Index                             |
| colorCode                                                    | `0x2c`          |                                   |
| aprsIndex                                                    | `0x2d`          |                                   |
| txContact                                                    | `0x2e`          | Index                             |
| alias TS1 / TS2                                              | bits @ `0x30`   | Alias enum bits                   |
| timeSlot                                                     | bit 6 @ `0x31`  |                                   |
| bandwidth / rxOnly / skipScan / skipZoneScan / vox / monitor | bits @ `0x33`   | See bitfield                      |
| squelch                                                      | `0x37`          | See SquelchMode                   |

### Flags @ `0x26`

| Bit | Meaning                                                                 |
| --- | ----------------------------------------------------------------------- |
| 2   | simplex                                                                 |
| 3   | useFixedLocation                                                        |
| 5   | disablePowerSave (inverted sense in API: power-save enabled when clear) |
| 6   | disableBeep (inverted sense in API)                                     |
| 7   | overrideDMRID                                                           |

### Bits @ `0x33`

| Bit | Meaning       |
| --- | ------------- |
| 1   | bandwidth     |
| 2   | rxOnly        |
| 3   | enableMonitor |
| 4   | skipScan      |
| 5   | skipZoneScan  |
| 6   | vox           |

## Enums

### Mode (`0x18`)

| Value | Meaning       |
| ----- | ------------- |
| `0`   | Analogue (FM) |
| `1`   | Digital (DMR) |

### Power (`0x19`)

| Value    | Meaning                                                             |
| -------- | ------------------------------------------------------------------- |
| `0`      | Use global / radio default                                          |
| `1`…`10` | Discrete power steps (qdmr maps Min/Low/Mid/High/Max onto a subset) |

Radio-specific watt ladders for CSV/export remain in radio homes ([dm-1701 power](../baofeng/dm-1701/power.md), [md-9600 power](../tyt/md-9600/power.md)); binary uses this step byte.

### Squelch (`0x37`)

qdmr maps:

| Wire  | Mode                  |
| ----- | --------------------- |
| `0`   | Global                |
| `1`   | Open                  |
| `15`  | Closed                |
| other | Normal (scaled level) |

**Web Serial Write:** analogue channels encode `squelchPercent` on `RadioChannelDto` using the same qDMR `setSquelch` scaling (`1 + (14×level)/10` for Normal, level 0–10 from internal percent). `null` / unset → Global (`0`). Digital / fixed-digital channels always write Global — qDMR does not store per-channel squelch on digital rows. Library `analogSquelchMode` (carrier vs tone) is **not** represented in this byte; see [export-formats/opengd77/power-squelch.md](../../export-formats/opengd77/power-squelch.md) for CSV wire rules ([#439](https://github.com/pskillen/codeplug-studio/issues/439) may extend elicitation).

### Scan skip bits @ `0x33`

OpenGD77 distinguishes **skip all-scan** (bit 4) and **skip zone-scan** (bit 5). The library exposes a single **scan inclusion** flag per channel — there is no separate all-scan vs zone-scan model. Web Serial Write therefore sets **both** `skipScan` and `skipZoneScan` from the same resolved scan-inclusion trait (`effectiveScanSkips` in `stampOpenGd77ChannelBehaviour`). This is intentional until a future library/build trait splits the two semantics.

### Alias (bits @ `0x30`)

| Value | Meaning |
| ----- | ------- |
| `0`   | None    |
| `1`   | APRS    |
| `2`   | Text    |
| `3`   | Both    |

## Write defaults (unmodelled fields)

On Web Serial Write, Studio **fully replaces** each occupied channel record from the build projection. Fields below are written to firmware-safe defaults when not carried on `RadioChannelDto` — prior Read bytes in those offsets are **not** retained (no RMW inside channel records).

| Field / offset                               | Write default             | Notes                                                                                                  |
| -------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------ |
| txTimeout @ `0x1b`                           | `0`                       | Infinite (qdmr units of 15 s)                                                                          |
| latitude / longitude @ `0x1a`–`0x1f`, `0x24` | `0`                       | Location not modelled on Write                                                                         |
| flags @ `0x26`                               | `0`                       | Simplex / power-save / beep / DMR-ID override clear                                                    |
| dmrId @ `0x27`                               | `0`                       | No per-channel DMR ID override                                                                         |
| aprsIndex @ `0x2d`                           | `0`                       | No APRS alias link                                                                                     |
| alias @ `0x30`                               | `0`                       | Alias mode None                                                                                        |
| vox / monitor bits @ `0x33`                  | clear                     | Bits 6–3 off                                                                                           |
| squelch @ `0x37`                             | from projection           | Analogue: library `squelch` % via qDMR scaling; digital: Global (`0`). See Squelch section above       |
| skipScan / skipZoneScan @ `0x33` bits 4–5    | from projection           | Both bits set together from scan-inclusion trait (no separate library fields)                          |
| Empty / unlisted slots                       | `0xFF` fill, bitmap clear | Full channel table replace                                                                             |

Modelled fields (name, frequencies, mode, power, tones, bandwidth, color code, timeslot, TX contact, RX group, scan skip flags when set on DTO, analogue squelch when set on DTO) encode from the projection. Tone wire values: see [#690](https://github.com/pskillen/codeplug-studio/issues/690).

Organisation banks (DMR contacts, zones, RX group lists) are also **full-bank replace** on Write — see [contacts-zones-lists.md](contacts-zones-lists.md).

## VFO extras

`VFOChannelElement` extends the channel layout with TX offset @ `0x34` and step/offset-mode bits @ `0x36`. VFO bases: see [memory-layout.md](memory-layout.md).

## Related

- [memory-layout.md](memory-layout.md) — bank bases
- [contacts-zones-lists.md](contacts-zones-lists.md) — contact / group-list indices referenced by channels
- CSV naming cross-check only: [export-formats/opengd77/channels.md](../../export-formats/opengd77/channels.md)
