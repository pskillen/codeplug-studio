# RT95 VOX — settings and upload scope

Settings, DTMF, PTT-ID, keys, VOX, and bandlimit regions in the PROGRAM→QX image — plus safe upload notes for adapter [#643](https://github.com/pskillen/codeplug-studio/issues/643).

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

Cite: CHIRP `anytone778uv.py` `MEM_FORMAT` / `get_settings` (facts only).

## Region summary

| Offset   | Struct / role                                                                 |
| -------- | ----------------------------------------------------------------------------- |
| `0x1940` | Occupied + scan-enabled bitfields (channel metadata)                          |
| `0x1980` | Starting display line (7 chars)                                               |
| `0x1990` | PTT-ID encode M1–M16 (`16 × 16` code bytes)                                   |
| `0x1A90` | DTMF: start/end IDs, remote stun/kill, interval/group, timing, self-ID, …   |
| `0x3200` | `settings` — beep, step, display, squelch A/B, volumes, scan, TOT, keys, VOX |
| `0x3240` | Power-on password (6 digits)                                                  |
| `0x3250` | PF keys mode 1/2 (P1–P6 each)                                                 |
| `0x3260` | `radio_settings` — MR A/B, VFO/MR flags, **bandlimit** @ `0x326D`             |

## Settings block (`0x3200`)

Notable fields (CHIRP UI names):

| Offset / field     | Notes                                      |
| ------------------ | ------------------------------------------ |
| Beep / speaker vol | Volume ladders                             |
| Frequency step     | Tuning-step index                          |
| Display mode       |                                            |
| Squelch A / B      |                                            |
| Scan type / recovery |                                          |
| Dual watch / main  |                                            |
| Backlight / screen direction |                                 |
| TOT / auto power on/off |                                    |
| TBST / STE         |                                            |
| Keys PA–PD         | Programmable front keys                    |
| DTMF TX time       |                                            |
| Channel locked / save channel parameter / power-on reset / TRF / knob mode | Bit-packed |
| **`voxOnOff` / `voxLevel` / `voxDelay`** | VOX models only (`HAS_VOX`)     |

Field-by-field option lists live in CHIRP `get_settings` — extract further enums into this page only when the adapter needs them.

## DTMF / PTT-ID (`0x1990` / `0x1A90`)

| Area        | Role                                                |
| ----------- | --------------------------------------------------- |
| PTT-ID M1–M16 | Encode strings (DTMF charset `0–9 A–D * #` + space) |
| Start / end IDs | PTT-ID bookends                                   |
| Remote stun / kill | DTMF remote codes                              |
| Self ID     | 3-digit DTMF self ID                                |
| Timing      | Pretime, first-digit, auto-reset, lapse, pause      |

## Bandlimit (`0x326D` + version reply)

See [memory-layout.md](memory-layout.md) band table. Live radio band index comes from the `0x02` version reply; image stores a copy at `0x326D`. CHIRP warns on upload when they differ — radio may refuse TX out of band.

## Upload behaviours

| Behaviour           | CHIRP                                                                 | Studio recommendation for [#643](https://github.com/pskillen/codeplug-studio/issues/643) |
| ------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Full clone **read** | All blocks `0x0000`…`0x3290` → `0x32A0` image                         | Same                                                                                     |
| Full clone **upload** | Entire image after priming read @ `0x3b10`                          | Supported; use carefully                                                                 |
| Channel-only write  | Not the default — full map write                                      | Prefer **RMW**: keep cached full image; rewrite channel span + occupancy/scan bits       |
| Settings write      | Part of full upload via `set_settings` into mmap                      | Prefer RMW of `0x3200`+ / DTMF regions only when intentionally editing settings          |
| Bandlimit           | Compared; not silently overwritten from radio on mismatch             | Warn; do not invent band changes without operator intent                                 |

**Safe upload:** Cache the full `0x32A0` download. Mutate channel records + occupancy/scan bitfields (and optional settings spans) offline, then write only changed `0x10` blocks — or write the full map after RMW so unknown gaps between DTMF and `0x3200` survive.

## Related

- [memory-layout.md](memory-layout.md) · [protocol.md](protocol.md) · [channel-record.md](channel-record.md)
- Non-VOX / sibling brands: allow-list notes in [protocol.md](protocol.md); separate homes under [#644](https://github.com/pskillen/codeplug-studio/issues/644)
