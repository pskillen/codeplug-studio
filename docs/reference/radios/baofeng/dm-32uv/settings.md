# DM-32UV — settings and co-resident blocks

Radio settings live in the **metadata `0x04`** 4KB block. Emergency systems and encryption keys share other tagged blocks — document co-residency so a first Web Serial adapter does not clobber unrelated regions.

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

Cite: NeonPlug `structures.ts` (`parseRadioSettings` / `encodeRadioSettings`), emergency/encryption helpers; `constants.ts`.

## Settings block (metadata `0x04`)

Full 4KB; NeonPlug requires at least `0x508` bytes of meaningful layout for parse. Metadata byte at `0xFFF` must remain **`0x04`** on write.

### Settings map (stock 048 decode)

Traced by static analysis of stock `DM32.01.L01.048` (the radio repo's ledger ids F222 to F225 and its decode research), not validated on hardware. Confidence: **traced** is a code address in 048; **inferred** is a traced offset or arithmetic whose name, unit or polarity rests on the vendor CPS label order (Studio shows it as _partly traced_); **guessed** is a traced layout whose name is only a guess (Studio shows it as _unknown_). Evidence is the 048 function address. Studio's debug Settings tab shows every row below read-only (`src/integrations/radio-io/radios/dm32uv/debugMemorySettings.ts`).

| Offset                           | Bits / size                  | Name                                                                                                                                | Encoding                                                                                                                                    | Confidence                                      | Evidence                                           |
| -------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| `0x00`                           | 1                            | Start display                                                                                                                       | 0 Picture, 1 Char String (the two lines below), 2 Voltage                                                                                   | traced                                          | `0x0304E6B8`, `0x0303F5B8`, list `0x030B7B14`      |
| `0x01`, `0x0F`                   | 14 (firmware reads 16)       | Power-on line 1, line 2                                                                                                             | NUL-terminated ASCII; a line with no NUL in 14 bytes runs into the next                                                                     | traced                                          | `0x0303F5B8`                                       |
| `0x1D`                           | b0                           | Allow reset                                                                                                                         | 1 = allowed                                                                                                                                 | traced                                          | loader, F27                                        |
| `0x1E`                           | 1                            | Auto power off                                                                                                                      | 0 Off; 1 30 min; 2 60 min; 3 120 min; 4 **240 min**; 5 and every other non-zero value **480 min**                                           | traced                                          | `0x0301B0C8`, `0x0301B114`, list `0x030B6418`      |
| `0x20`                           | b7..b0                       | Radio silent; Key tone; SMS prompt; Group call tone; Private call tone; Call end tone; Talk permit tone; Start-up sound             | 1 = on                                                                                                                                      | traced                                          | Tone rows 0, 2 to 8                                |
| `0x21`                           | b7; b6; b5-4                 | Voice prompt; Battery low tone; Analogue roger                                                                                      | 1 = on; roger 0 Off, 1 Tone, 2 1200                                                                                                         | traced                                          | Tone rows 9, 1, 10; list `0x030B6184`              |
| `0x30`                           | 1                            | Back light                                                                                                                          | 0 to 5 = Brightness 1 to 6                                                                                                                  | traced                                          | Display row 0, list `0x030B700C`                   |
| `0x31`                           | 1                            | Light time                                                                                                                          | 0 Always On, 1 5 s, 2 10 s, 3 15 s, 4 20 s, 5 25 s, 6 30 s, 7 1 min, 8 2 min, 9 3 min, 10 4 min, 11 5 min                                   | traced                                          | list `0x030B7910`                                  |
| `0x32`                           | 1                            | Menu exit time                                                                                                                      | menu timer = 5 x value (10 above 60)                                                                                                        | traced; unit inferred                           | Display row 16                                     |
| `0x33`                           | b0; b3; b4                   | Time display; date format (0 yyyy/mm/dd, 1 dd/mm/yyyy); (no menu writer, "Volume Change Prompt")                                    | 1 = on                                                                                                                                      | traced; traced; inferred                        | `0x0304F7AC`, lists `0x030B8238`, `0x030B8260`     |
| `0x34`, `0x35`                   | 1 + 1                        | Call display colour; standby text colour                                                                                            | 0 to 7 White, Gray, Orange, Red, Yellow, Green, Cyan, Blue                                                                                  | offset traced; enum inferred                    | Display rows 4, 5; list `0x030B6388`               |
| `0x36`, `0x37`                   | 1 + 1                        | (no menu row; "TX / RX Backlight Delay")                                                                                            | loaded only                                                                                                                                 | guessed                                         | loader                                             |
| `0x38` to `0x3B`                 | 1 each                       | Channel name colour A, B; zone colour A, B                                                                                          | same colour enum                                                                                                                            | offset traced; enum inferred                    | Display rows 6 to 9                                |
| `0x40`                           | b0; b1; b3-2; b5-4; b6       | GNSS on (ignored unless factory `+0x80` b2); (units); GNSS mode 0 GPS, 1 BDS, 2 GPS + BDS; (units); display format 0 DDD, 1 DMS     | `0x38C6C+0xD8`                                                                                                                              | b0, b3-2, b6 traced; b1, b5-4 guessed           | GNSS rows 0, 4, 3; `0x0304BF54`, list `0x030B5B74` |
| `0x41`                           | 1                            | Time zone                                                                                                                           | 0 to 25 = UTC-12:00 to UTC+13:00 (12 = UTC)                                                                                                 | traced                                          | GNSS row 2; list `0x030B6710`                      |
| `0x42`                           | 1                            | (no menu writer; "Measure Period Interval")                                                                                         | loaded only                                                                                                                                 | guessed                                         | loader                                             |
| `0x50`                           | text, up to 16               | Talker-alias text typed in Contacts > Talker Alias                                                                                  | written only, **never read by 048**; the alias the radio sends is the radio-ID name (tag `0x67`, 12 bytes)                                  | traced                                          | writer `0x0304C650`; sender `0x0305F270`           |
| `0x60`                           | b0; b1                       | PCall match; GCall match                                                                                                            | 1 = on                                                                                                                                      | traced                                          | Other rows 19, 20; `0x03049904`                    |
| `0x61`, `0x62`                   | 1 + 1                        | DMR timing pair                                                                                                                     | `(v+1) x 50`; `300 + 30 x (v-1)` (0 reads as 1)                                                                                             | arithmetic traced; names guessed                | `0x0301DC18`, `0x0301DC54`                         |
| `0x63`, `0x64`                   | 1 + 1                        | DMR retries; call hold time                                                                                                         | retries 1 to 8; hold = v + 2 (above 17 reads as 2)                                                                                          | traced; names inferred                          | `0x0301DC5C`, `0x0301DC64`                         |
| `0x65`                           | b2-1; b3, b7, b6, b5, b4; b0 | SMS format; remote-command decode flags 1 to 5; flag                                                                                | SMS 0 H-SMS, 1 M-SMS, 2 D-SMS (3 reads as 2)                                                                                                | SMS traced; flags guessed                       | list `0x030B94F4`, `0x0305BF08`, `0x03020660`      |
| `0x66`                           | 1                            | Remote monitor time                                                                                                                 | `(v+1) x 10` (12 or more reads as 10)                                                                                                       | traced; name inferred                           | `0x0305BF08`                                       |
| `0x67`                           | b3; b2; b7-6                 | Send talker alias; alias display priority; alias data format                                                                        |                                                                                                                                             | traced; names inferred                          | `0x0305F2D4`, `0x0302A96C`                         |
| `0x80`                           | b0; b1, b2; b3, b4; b5; b7-6 | Only channel mode; work mode A, B; channel display A, B; main channel; dual watch                                                   | work mode 0 VFO, 1 MR (polarity inferred); display 0 FREQ, 1 CH Name; main 0 A, 1 B; dual watch 0 Single Mode, 1 Double Wait, 2 Single Wait | traced; Only channel mode and polarity inferred | `0x03015D32`, `0x03038AB8`, list `0x030B63C4`      |
| `0x81`                           | 1                            | Dual watch hang time                                                                                                                | clamp 1 to 13, x 10                                                                                                                         | traced; name and unit inferred                  | `0x0300E270`, `0x0305A4B0`                         |
| `0x85`                           | b0; b1, b2, b3               | Auto keypad lock (switch); other lock flags ("Knob Lock", "Side Key Lock", "Forbid Lock Key")                                       | **bit 0 only** is the switch                                                                                                                | b0 traced; others guessed                       | `0x0304F7AC`                                       |
| `0x86`                           | 1                            | Auto keypad lock delay                                                                                                              | min(v, 55) + 5 (5 to 60), unit inferred seconds                                                                                             | traced; unit inferred                           | `0x0304F7AC`                                       |
| `0x87` to `0x90`                 | 10                           | Key functions: SK1 short, long; SK2 short, long; **TK short, long (no physical key, F248)**; P1 short, long; P2 short, long         | code 0 to 42, 43 or more = None                                                                                                             | traced                                          | key function table                                 |
| `0x91`, `0x92`                   | 1 + 1                        | P3 short, long                                                                                                                      | loaded only                                                                                                                                 | inferred                                        | loader                                             |
| `0x93`                           | 1                            | Long press time                                                                                                                     | 1 to 10 (else 1); timer 5 x v                                                                                                               | traced                                          | Key row 11                                         |
| `0xA0`, `0xA1`                   | 1 + 1                        | TX timer (TOT) 0 to 97 (above 97 reads as 22); TOT predict                                                                          | unit not traced                                                                                                                             | traced                                          | Other rows 1, 2                                    |
| `0xA2`, `0xA3`                   | 1 + 1                        | VOX gain level 0 to 8; VOX delay                                                                                                    | thresholds 114, 134, 152, 159, 162, 165, 168, 171, 174 (`0x030B5238`)                                                                       | traced                                          | `0x0305FABC`                                       |
| `0xA4`                           | b0; b1; b2; b6-4             | LED indicator; language (0 Chinese, 1 English); weather alarm; power save (0 Off, 1 1:1, 2 1:2, 3 1:4)                              | factory `+0xA0` = `0xA3` forces English                                                                                                     | traced                                          | Display rows 15, 13; Other rows 14, 9              |
| `0xA5`                           | b1-0; b5-4                   | Tail (0 Off, 1 120 deg, 2 180 deg, 3 55 Hz); TBST (0 1000, 1 1450, 2 1750, 3 2100 Hz)                                               |                                                                                                                                             | traced                                          | Other rows 16, 15                                  |
| `0xA6`, `0xA7`                   | 1 + 1                        | Analogue mic gain (0 to 4 = Level 1 to 5; above 4 reads as Level 3); digital mic gain 0 to 7                                        | codec values 7, 8, 9, 10, 11, 18, 19, 20 (`0x030AB96C`)                                                                                     | traced                                          | Other rows 6, 7; `0x0301D970`                      |
| `0xA8`, `0xA9`                   | 1 + 1                        | Weather channel, side A, B                                                                                                          | 1 to 10 (else 1): 162.550, 162.400, 162.475, 162.425, 162.450, 162.500, 162.525, 161.650, 161.775, 163.275 MHz (`0x030AD814`)               | table traced; "weather" inferred                | `0x0302F950`                                       |
| `0xB0`, `0xB1`                   | 1 + 1                        | **MM9PDY:** light mode (`0x01` light), RX match (`0x01` talk group)                                                                 | stock does not read them                                                                                                                    | traced (our code)                               | MM9PDY firmware, F225                              |
| `0xB2` to `0xBF`                 | 14                           | reserved for MM9PDY settings                                                                                                        |                                                                                                                                             |                                                 |                                                    |
| `0x11E + 2n`                     | 2 each                       | Analogue one-key call entries                                                                                                       | type 1 to 4 (else none), then an index; the bound of n is not established                                                                   | traced                                          | `0x03062D14`                                       |
| `0x200 + 5i`                     | 5 x 5                        | One-touch call (Hot Key 1 to 5)                                                                                                     |                                                                                                                                             | traced                                          | `0x03062CE4`                                       |
| `0x230 + 7i`                     | **12 x 7** (to `0x283`)      | Fun+ entries: digit keys 0 to 9, then 10 and 11                                                                                     | contents not decoded                                                                                                                        | reads traced                                    | `0x03062F10`                                       |
| `0x301`                          | 1                            | APRS interval                                                                                                                       | x 30, unit inferred seconds                                                                                                                 | traced; unit inferred                           | `0x0305FC4C`                                       |
| `0x302`                          | b0                           | Upload beacon                                                                                                                       | 0 GPS Beacon, 1 Fixed Beacon                                                                                                                | traced                                          | `0x0304B890`, list `0x030B858C`                    |
| `0x306`/`0x30F`, `0x310`/`0x319` | 9 + 1 each                   | Fixed latitude, N or S; fixed longitude, E or W                                                                                     | ASCII                                                                                                                                       | traced                                          | `0x0305FC4C`                                       |
| `0x320 + 2n`                     | 2 x 8                        | APRS report channels 1 to 8                                                                                                         | u16; 0 = current                                                                                                                            | traced                                          | `0x03055DAC`, `0x0305FE24`                         |
| `0x331`                          | b0                           | APRS upload type                                                                                                                    | 1 = group (inferred)                                                                                                                        | traced; polarity inferred                       | `0x0304B834`                                       |
| `0x332`                          | 3                            | APRS upload ID                                                                                                                      | u24 LE (0 reads as 1)                                                                                                                       | traced                                          | `0x0304B814`                                       |
| `0x430` to `0x44A`               | 1; 8; 2; 8; 8                | **Passwords:** power-on enable (`0xA5` = on), power-on password (8 ASCII digits), password-set flags, write password, read password | gate key, PTT and screen code through `0x3E3B0+8` b0                                                                                        | traced                                          | `0x030127DC`, `0x0302A208`, `0x0302A324`           |
| `0x500` to `0x507`               | 8                            | Menu-row enable bits                                                                                                                | bit-to-row map not done                                                                                                                     | readers traced                                  | `0x03047E8C`                                       |

Bytes in `0x000` to `0x507` that no row above covers:

- **Free** (never read or written by 048, ledger F222; 744 bytes): `0x1F`, `0x22`-`0x2F`, `0x3C`-`0x3F`, `0x68`-`0x7F`, `0x97`-`0x9F`, `0xAA`-`0xAF`, `0xC0`-`0x11D`, `0x160`-`0x1FF`, `0x335`-`0x42F`, `0x44B`-`0x4FF`.
- **Not read by 048** (the CPS may still write them; not proven free; 177 bytes): `0x43`-`0x4F`, `0x82`-`0x84`, `0x94`-`0x96`, `0x219`-`0x22F`, `0x284`-`0x300`, `0x303`-`0x305`, `0x31A`-`0x31F`, `0x330`.

Beyond `0x508` the radio repo's notes cover FM flags at `0x700`, the FM index and frequency at `0x701`-`0x704`, GPS/location entries from `0x509`, and the power-on mode and last channel at `0xF00`-`0xF02`; Studio's settings view stops at `0x508`.

**Studio display.** The debug Settings tab shows the three password strings (power-on, write, read) as `Hidden (password)` and `••` bytes until **Show password** is pressed; it hides them again when the archive changes. Nothing here changes Write: Studio still replaces only `0x301`-`0x334` (APRS) and keeps every other tag-`0x04` byte from Read.

#### Key-function codes

Studio previews and decodes these bytes. Only the MM9PDY step-key option writes two of them (P1 short `+0x8D`, P2 short `+0x8F`: codes 20 and 21). A byte outside 0–42 renders `Function N` with the raw byte.

| Code | Preview                |
| ---- | ---------------------- |
| 0    | None                   |
| 1    | Power Select           |
| 2    | Volt                   |
| 3    | Talk Around            |
| 4    | Digital Encrypt        |
| 5    | Call                   |
| 6    | Vox                    |
| 7    | VFO/MR                 |
| 8    | Alarm                  |
| 9    | One Touch Call 1       |
| 10   | One Touch Call 2       |
| 11   | One Touch Call 3       |
| 12   | One Touch Call 4       |
| 13   | One Touch Call 5       |
| 14   | SMS                    |
| 15   | Contact                |
| 16   | Zone Up                |
| 17   | Zone Down              |
| 18   | Scan                   |
| 19   | Record Switch          |
| 20   | Previous Record        |
| 21   | Next Record            |
| 22   | FM Radio               |
| 23   | FM Search              |
| 24   | GPS Info               |
| 25   | Monitor                |
| 26   | A/B Switch             |
| 27   | Work Alone             |
| 28   | KeyPad Lock            |
| 29   | Nuisance Delete        |
| 30   | TBST Send              |
| 31   | APRS Send              |
| 32   | Switch ChType          |
| 33   | Display Mode           |
| 34   | CTC/DCS Scan           |
| 35   | CTC/DCS Set            |
| 36   | Mute                   |
| 37   | Roaming                |
| 38   | Sub PTT                |
| 39   | Analog Scramble Switch |
| 40   | One Key Scan Freq      |
| 41   | Flashlight             |
| 42   | Man Down Alarm         |

### APRS / GPS position (`0x301`–`0x334`)

| Offset            | Role                                                                                |
| ----------------- | ----------------------------------------------------------------------------------- |
| `0x301`           | Scheduled send time (value x 30; unit inferred seconds)                             |
| `0x302` bit 0     | Upload beacon: 0 GPS Beacon, 1 Fixed Beacon                                         |
| `0x306` / `0x30F` | Latitude string + N/S                                                               |
| `0x310` / `0x319` | Longitude string + E/W                                                              |
| `0x320`-`0x32F`   | APRS report channels 1-8 (u16 LE each; `0` = current)                               |
| `0x330`           | Not read by 048 (CPS label "Repeater Active Delay[ms]")                             |
| `0x331` bit 0     | Call type (1 = group, polarity inferred)                                            |
| `0x332`-`0x334`   | Upload DMR ID (24-bit **LE** on radio UI; Studio Web Serial Write matches firmware) |

NeonPlug `encodeRadioSettings` (file/JSON path) still documents **big-endian** at these offsets — Studio serial intentionally diverges here after hardware dump [#1223](https://github.com/pskillen/codeplug-studio/issues/1223).

## VFO channels (metadata `0x41`)

NeonPlug treats VFO A/B as channels **4001** / **4002** parsed from block metadata **`0x41`**, with TX-contact slots in block `0x43` at `0x0FFA` / `0x0FFC`. Settings block parse leaves placeholder VFOs until `0x41` is applied.

## Emergency / encryption co-resident notes

| Topic             | Observed (NeonPlug)                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| Analog emergency  | Entries in the `0x10`-tagged block region (~36 bytes each; max 16); encode clears `0x0AC`–`0x2FF` only          |
| Encryption keys   | Start at offset **`0x300`** in the same physical block family as analog emergency                               |
| Digital emergency | Entry size ~20–40 bytes. Emergency and encryption stay on **`0x10`** — see [memory-layout.md](memory-layout.md) |

**Adapter implication:** always **read-modify-write** the full 4KB and preserve unknown bytes / co-resident sections. Never blank an entire `0x10` block when writing only one subsection.

## Upload / RMW guidance

| Behaviour                | NeonPlug approach                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------ |
| Settings write           | Encode into cached `0x04` block; preserve unknown fields from original               |
| Channel write            | Rewrite channel blocks + TX-contact + related lists as needed                        |
| Studio Web Serial (#667) | Replace APRS slice `0x301`–`0x334` from the build; keep other `0x04` bytes from Read |
| Safe first Studio path   | Cache full discovered set from bulk-read; RMW only changed blocks                    |

## Related

- [memory-layout.md](memory-layout.md) · [protocol.md](protocol.md) · [channel-record.md](channel-record.md)
- NeonPlug file settings bag (different world): [export-formats/neonplug](../../../export-formats/neonplug/README.md)
