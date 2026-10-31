# RT95 VOX — settings and upload scope

Settings, DTMF, PTT-ID, keys, VOX, and bandlimit regions in the PROGRAM→QX image — plus safe upload notes for adapter [#643](https://github.com/pskillen/codeplug-studio/issues/643).

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

Cite: CHIRP `anytone778uv.py` `MEM_FORMAT` / `get_settings` (facts only).

## Region summary

| Offset   | Struct / role                                                                |
| -------- | ---------------------------------------------------------------------------- |
| `0x1940` | Occupied + scan-enabled bitfields (channel metadata)                         |
| `0x1980` | Starting display line (7 chars)                                              |
| `0x1990` | PTT-ID encode M1–M16 (`16 × 16` code bytes)                                  |
| `0x1A90` | DTMF: start/end IDs, remote stun/kill, interval/group, timing, self-ID, …    |
| `0x3200` | `settings` — beep, step, display, squelch A/B, volumes, scan, TOT, keys, VOX |
| `0x3240` | Power-on password (6 digits)                                                 |
| `0x3250` | PF keys mode 1/2 (P1–P6 each)                                                |
| `0x3260` | `radio_settings` — MR A/B, VFO/MR flags, **bandlimit** @ `0x326D`            |

## PF key table (`0x3250`)

Twelve bytes: P1-P6 for FUNC group 1, then P1-P6 for group 2. The byte for group _g_ (1-2), key _k_ (1-6) is at `0x3250 + (g - 1) * 6 + (k - 1)`. The value is the function's CHIRP option index plus one; **DIR = `0x0E`**. On the MM9PDY target the optional "Put Zone on a P-key" export setting writes `0x0E` to one chosen byte (the MM9PDY firmware opens the zone selector on DIR; CPS and CHIRP show DIR). No other byte changes, and the stock target never does this.

## Settings block (`0x3200`)

Notable fields (CHIRP UI names):

| Offset / field                                                             | Notes                       |
| -------------------------------------------------------------------------- | --------------------------- |
| Beep / speaker vol                                                         | Volume ladders              |
| Frequency step                                                             | Tuning-step index           |
| Display mode                                                               |                             |
| Squelch A / B                                                              |                             |
| Scan type / recovery                                                       |                             |
| Dual watch / main                                                          |                             |
| Backlight / screen direction                                               |                             |
| TOT / auto power on/off                                                    |                             |
| TBST / STE                                                                 |                             |
| Keys PA–PD                                                                 | Programmable front keys     |
| DTMF TX time                                                               |                             |
| Channel locked / save channel parameter / power-on reset / TRF / knob mode | Bit-packed                  |
| **`voxOnOff` / `voxLevel` / `voxDelay`**                                   | VOX models only (`HAS_VOX`) |

Field-by-field option lists live in CHIRP `get_settings` — extract further enums into this page only when the adapter needs them.

## Studio settings registry (#1476)

Studio’s Web Serial settings path writes only the fields below. Each patch is resolved twice (registry + protocol), merged onto a **fresh read** of each touched 16-byte block inside `upload`, and aborted if the radio changed outside the patch mask since the pre-pause image. Settings-only upload writes **only** touched blocks. An explicit PF-key override wins over the MM9PDY zone-key projection when both target the same byte (zone key is still not applied on the RT95 write branch today — see gap note below).

**Gap (not fixed in patch core):** `applyRt95ZoneKey` is only called from the UV-17 Pro write path; RT95 codeplug Write does not set the zone DIR byte despite Review copy.

### Supported fields (registry)

| Field id                          | CPS label              | Offset / bits                      | Tier     | Trust     |
| --------------------------------- | ---------------------- | ---------------------------------- | -------- | --------- |
| startingDisplay                   | Starting Display       | `0x1980` ×7                        | basic    | CPS+CHIRP |
| displayMode                       | Display Mode           | `0x3202` low 2                     | basic    | CPS+CHIRP |
| backlightBrightness               | Backlight Brightness   | `0x320D` low 3                     | basic    | CPS+CHIRP |
| screenDirection                   | Screen Direction       | `0x3211` bit 0                     | basic    | CPS+CHIRP |
| beepVolume                        | Beep Volume            | `0x3200` low 3                     | basic    | CPS+CHIRP |
| speakerVolume                     | Speaker Volume         | `0x3206` low 6                     | basic    | CPS+CHIRP |
| speakerSwitch                     | Speaker Switch         | `0x3213` low 2                     | basic    | CPS+CHIRP |
| steFrequency                      | STE Frequency          | `0x3219` low 2                     | basic    | CPS+CHIRP |
| steType                           | STE Type               | `0x3218` low 3                     | basic    | CPS+CHIRP |
| autoPowerOn                       | Auto Power On          | `0x320A` bit 0                     | basic    | CPS+CHIRP |
| autoPowerOff                      | Auto Power Off         | `0x320F` low 2                     | basic    | CPS+CHIRP |
| squelchLevelA / B                 | Squelch Level A / B    | `0x3204` / `0x3205` low 4          | basic    | CPS+CHIRP |
| scanType                          | Scan Type              | `0x3208` low 2                     | basic    | CPS+CHIRP |
| scanRecoveryTime                  | Scan Recovery Time     | `0x3209` low 2                     | basic    | CPS+CHIRP |
| main                              | Main                   | `0x320B` bit 0                     | basic    | CPS+CHIRP |
| rxWaySelect                       | RX Way Select          | `0x320C` bit 0                     | basic    | CPS+CHIRP |
| timeOutTimer                      | Time Out Timer         | `0x320E` low 5                     | basic    | CPS+CHIRP |
| tbstFrequency                     | TBST Frequency         | `0x3210` low 2                     | basic    | CPS+CHIRP |
| saveChannelParameter              | Save Channel Parameter | `0x321B` bit 3                     | basic    | CPS+CHIRP |
| monKeyFunction                    | MON Key Function       | `0x321B` bit 5                     | basic    | CPS+CHIRP |
| frequencyStep                     | Frequency Step         | `0x3201` low 4                     | basic    | CPS+CHIRP |
| knobMode                          | Knob Mode              | `0x321B` bit 0                     | basic    | CPS+CHIRP |
| dtmfTxTime                        | DTMF transmitting time | `0x321A` low 3                     | basic    | CHIRP     |
| voxOnOff / voxLevel / voxDelay    | VOX                    | `0x321C` bit 0; `0x321D`; `0x321E` | basic    | CPS+CHIRP |
| pfKeyMode1P1…pfKeyMode2P6         | Key mode P1–P6         | `0x3250`–`0x325B` (stored index+1) | basic    | CPS+CHIRP |
| pttIdM1…M16                       | PTT-ID encode          | `0x1990` + n×16                    | basic    | CHIRP     |
| pttIdStart / pttIdEnd             | PTT ID start/end       | `0x1A90` / `0x1AA0` ×16            | basic    | CHIRP     |
| dtmfIntervalChar … dtmfPttIdPause | DTMF timing & codes    | `0x1AD0`–`0x1ADB` (see CHIRP)      | basic    | CHIRP     |
| dtmfSelfId                        | Self ID                | `0x1AD6` ×3                        | basic    | CHIRP     |
| powerOnPasswordEnabled + digits   | Power-on Password      | `0x3207` bit 0; `0x3240` ×6        | advanced | CPS+CHIRP |
| powerOnResetEnable                | Power On Reset Enable  | `0x321B` bit 2                     | advanced | CPS+CHIRP |
| trfEnable                         | TRF Enable             | `0x321B` bit 1                     | advanced | CPS+CHIRP |
| channelLocked                     | Channel Locked         | `0x321B` bit 4                     | advanced | CPS+CHIRP |
| remoteStun / remoteKill           | Remote stun / kill     | `0x1AB0` / `0x1AC0` ×16            | advanced | CHIRP     |

Never patched: channel records `0x0000`–`0x193F`, bitfields `0x1940`–`0x197F`, bandlimit `0x326D`, `0x321B` bits 6–7 (bit 7 PC-write marker), anything ≥ `0x32A0`.

### Not supported (by design)

| Surface                                                       | Reason                                             |
| ------------------------------------------------------------- | -------------------------------------------------- |
| Display Mode B                                                | No EEPROM byte recovered                           |
| VFO/MR A/B, MR channel A/B                                    | Radio state; radio rewrites                        |
| Hand-mic key brightness                                       | Off encoding unknown                               |
| Mic keys PA–PD                                                | CPS vs CHIRP encodings disagree                    |
| Mic Level (`0x321F`)                                          | Byte inferred only                                 |
| Auto reset time (`0x1AD5`)                                    | CPS ini vs CHIRP unit conflict                     |
| Band `0x326D`                                                 | Danger-zone class; not a CPS Function Setup picker |
| `0x3203`, `0x326E` mask                                       | No CPS control recovered                           |
| 2-tone, 5-tone, scan groups, emergency, roger beep, comm book | Layouts not recovered                              |
| Factory test modes                                            | Not user settings                                  |
| PC language, port, skin, `mysetup.ini`                        | Not in the radio                                   |

## DTMF / PTT-ID (`0x1990` / `0x1A90`)

| Area               | Role                                                |
| ------------------ | --------------------------------------------------- |
| PTT-ID M1–M16      | Encode strings (DTMF charset `0–9 A–D * #` + space) |
| Start / end IDs    | PTT-ID bookends                                     |
| Remote stun / kill | DTMF remote codes                                   |
| Self ID            | 3-digit DTMF self ID                                |
| Timing             | Pretime, first-digit, auto-reset, lapse, pause      |

## Bandlimit (`0x326D` + version reply)

See [memory-layout.md](memory-layout.md) band table. Live radio band index comes from the `0x02` version reply; image stores a copy at `0x326D`. CHIRP warns on upload when they differ — radio may refuse TX out of band.

## Upload behaviours

| Behaviour             | CHIRP                                                     | Studio Web Serial ([#643](https://github.com/pskillen/codeplug-studio/issues/643))                                                                     |
| --------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full clone **read**   | All blocks `0x0000`…`0x3290` → `0x32A0` image             | Same                                                                                                                                                   |
| Full clone **upload** | Entire image after priming read @ `0x3b10`                | Supported; use carefully                                                                                                                               |
| Channel-only write    | Not the default — full map write                          | **RMW:** rewrite channel span + occupancy/scan bitfields; retain settings/DTMF/gaps                                                                    |
| Settings write        | Part of full upload via `set_settings` into mmap          | Field patches on fresh read inside `upload` / settings-only `uploadSettingsPatches` ([#1476](https://github.com/pskillen/codeplug-studio/issues/1476)) |
| Bandlimit             | Compared; not silently overwritten from radio on mismatch | Warn; do not invent band changes without operator intent                                                                                               |

**Safe upload:** Cache the full `0x32A0` download. Mutate channel records + occupancy/scan bitfields (and optional settings spans) offline, then write only changed `0x10` blocks — or write the full map after RMW so unknown gaps between DTMF and `0x3200` survive.

## Related

- [memory-layout.md](memory-layout.md) · [protocol.md](protocol.md) · [channel-record.md](channel-record.md)
- Non-VOX / sibling brands: allow-list notes in [protocol.md](protocol.md); separate homes under [#644](https://github.com/pskillen/codeplug-studio/issues/644)
