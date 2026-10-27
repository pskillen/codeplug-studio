# AT-D890UV NXDN channel fields (MM9PDY Web Serial)

What Studio writes for NXDN on the `anytone-at-d890uv-mm9pdy` target, and when. Facts come from the firmware RE (NXDN codeplug answers) and the MM9PDY firmware's settings store. Not yet checked on a radio.

## When Studio writes NXDN

Only a Web Serial Write on the MM9PDY target, and only when the radio reports NXDN enabled. The check is on the radio, after Studio's in-session read:

- The settings-store record at `0x03500200` (inside unit `0x03500000`) is valid: magic `M6`, version 1, and the 8-bit sum of bytes 0–30 equals byte 31.
- Its byte 21 (the NXDN-enabled flag) is 1.

Anything else (blank, bad sum, other version, byte 21 not 1, no cache) counts as off. Then:

- NXDN profiles are ignored and NXDN-only channels are not written.
- The Write shows one notice: "NXDN not written: this radio does not have NXDN enabled". It appears only when the build has channels with an NXDN profile.

Offline exports and the stock target never write NXDN. The stock target has no `nxdn` mode in its RF capabilities, so an NXDN-only channel is ineligible there. MM9PDY lists `nxdn` on 136–174 and 400–480 MHz.

There is no export setting. Studio never writes `+0x152` (digital protocol) or `+0x153` (NXDN mic gain); the protocol is switched on the radio, and a Write leaves both as read.

`+0x154` (Reset Digital Protocol: 0 Off, 1 DMR, 2 NXDN) is different. On an NXDN-enabled MM9PDY radio the firmware reads it at boot and can set the protocol from it, so a non-zero value left by the vendor CPS would override the radio-menu choice at every power-on. When the radio reports NXDN enabled (the same check as above), a Web Serial Write on the MM9PDY target sets `+0x154` to 0 (Off). If the value it replaced was non-zero, the Write summary says "Reset Digital Protocol set to Off". On the stock target, on a radio that does not report NXDN enabled, and in offline exports, `+0x154` stays as read. The settings model has no field for it.

## Channel bytes `0x66`–`0x6E`

One channel record holds both DMR and NXDN fields; the radio's global protocol picks which set is used.

| Byte / bits   | Field                                          | Encoding                                         | Studio                                                                     |
| ------------- | ---------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| `0x66` b0     | Bandwidth / rate                               | 0 = 6.25 kHz (NXDN48), 1 = 12.5 kHz (NXDN96)     | Writes from the profile rate; no rate keeps the bit (a new slot is NXDN48) |
| `0x66` b1     | Optional signal                                | 0 off, 1 NXDN ID                                 | Carried over                                                               |
| `0x66` b7:4   | Squelch mode                                   | 0 RAN, 1 RAN and ID                              | Carried over                                                               |
| `0x67` b3:0   | Busy lock                                      | 0–4                                              | Carried over                                                               |
| `0x67` b7:4   | PTT call                                       | 0 off, 1 on; gates the contact at `0x6C`         | Bits 7:4 = 1 with a call target, else 0; busy lock (3:0) carried over      |
| `0x68`        | TX RAN                                         | 0–63                                             | Writes from the profile; none keeps the byte                               |
| `0x69`        | RX RAN                                         | 0–63                                             | Writes from the profile; none keeps the byte                               |
| `0x6A`        | Encryption                                     | 0 off, 1–32 key slot                             | Written 0 (Studio models no encryption)                                    |
| `0x6B`        | RX group list                                  | 0-based, `0xFF` = none (0 selects list 0)        | The channel's NXDN RX group list (0-based), or `0xFF` for none             |
| `0x6C`–`0x6D` | Contact slot (u16 LE) in the NXDN contact list | slot index; used for TX only when PTT call is on | The call target's slot in the NXDN list, or 0 with no target               |
| `0x6E`        | Send status                                    | 0 none, 1–50                                     | Written 0 (Studio models no status messages)                               |

Writing uses bit operations on `0x66`, so carried-over bits survive. A RAN outside 0–63 is not written (Studio leaves it out and warns); the encoder itself refuses one before any frame is sent.

A new slot starts as zeros, which on the radio is a valid NXDN48 channel with RAN 0 / 0, PTT call off (group call to ID 0) and RX group list 0. A library channel with no NXDN rate therefore comes out as NXDN48 on a new slot and keeps its existing rate on a used one. Studio sets `0x6B` on every channel it writes with NXDN fields, new or used: the list index, or `0xFF` when the channel has no RX group list, so it never listens to list 0 or to the previous occupant's list. `0x67` b7:4, `0x6A`, `0x6C`–`0x6D` and `0x6E` are written the same way, so a channel with no call target is PTT call off and slot 0 (never the previous occupant's), and a channel never inherits the previous occupant's encryption key slot.

### Channels without NXDN fields

The MM9PDY firmware treats a channel as NXDN-capable in NXDN mode if any of `0x66`–`0x6E` is non-zero. So on **every** MM9PDY Web Serial Write, Studio writes zeros into `0x66`–`0x6E` of each channel it writes without NXDN fields: DMR-only and analogue channels, and NXDN channels when the radio does not report NXDN enabled (a previous occupant's bytes, or `FF` from an erased slot, are not carried over). `0x6F`–`0x7F` are left as they are. The stock target is unchanged: those bytes are carried over.

## The NXDN list and RX group lists

Written in the same Write, from library entities with `mode: 'nxdn'` (DMR entities go to the DMR lists, never here). Layouts: firmware RE, NXDN codeplug (records F291, F293–F295, F297).

**List: four units, owned by Studio.** The radio's NXDN talk-group / contact list is one list: talk groups (group entries) first, then contacts (individual entries), at most 1000. Slot `i` is index `i`. A talk group or contact whose ID and kind repeat an earlier entry is not written again (the order table holds one row per ID, so a second entry would be a row the caller-ID search cannot find); the Write warns, and a channel or RX group that used it points at the first entry.

| Unit    | Address      | Content                                                                                                                                                                                                                              |
| ------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Index   | `0x18000000` | 1000 × u32 LE, position to slot; `FFFFFFFF` after the last (the firmware takes the first as the list length)                                                                                                                         |
| Set     | `0x18080000` | Inverted: a clear bit is a used slot                                                                                                                                                                                                 |
| Records | `0x18100000` | `slot × 0xC8`: Attr (1 group, 0 individual) at `+0`, 3-byte BCD ID at `+2`, name (UTF-16LE, 16 characters) at `+6`, city `+0x4C`, callsign `+0x6C`, state `+0x84`, country `+0xA6`                                                   |
| Order   | `0x18180000` | Entries of (key u32 LE, slot u32 LE) sorted by key, `key = BCD hex × 2 + 1 for a group`; padded to an even count with `FF`×8. The firmware reads it for caller names and RX-group matching, so it is never written without the index |

Each unit is the A half of an A/B pair; Studio addresses the A half and the radio promotes the new copy at the end of the Write. Studio sends every byte that must survive and the rest of the unit is erased. IDs: 1–65519 for contacts and talk groups, plus 65535 (all-call) for talk groups; others are skipped with a warning. Names are cut at 16 characters.

**RX group lists: one unit.** `0x04B80000`: 250 strides of `0x200`. A list holds up to 64 u32 LE **NXDN list slots**, stored contiguously with `FFFFFFFF` after the last (the firmware stops at the first invalid slot), and its name at `+0x100`. The bitmap at `0x04BA0000` is positive (a set bit is a used list). Studio writes the lists that hold an NXDN member or that an NXDN channel uses, with their NXDN members only. DMR members are dropped with a warning (they live in the DMR RX lists, which do the same for NXDN members); members the NXDN list could not hold, past 64, and lists past 250 are dropped with a warning.

**When nothing is written.** A build with no NXDN talk groups, contacts or RX lists leaves the radio's NXDN lists as they are. A build with RX lists but no list entries replaces only the RX group unit. With NXDN entries, the RX group unit is always replaced with the build's lists, because its members are slots in the list. A stock Write, a Write to a radio that does not report NXDN enabled, and a contacts-only Write never touch these units; a stock Write also drops them from the session before sending.

**Backup.** Read now also reads the NXDN list and RX groups (the stock CPS reads the same regions), so a backup holds them before the first Studio write. The list and the RX group lists are stored in the backup but are both inspect-only. The list's units sit above the virtual map the restore image covers, and the RX groups' members are slots in that list, so restoring them without it would point them at the wrong entries. That holds for the range-change restore too. Restoring either is not supported yet.

**Channels.** A channel's call target (`0x6C`) is the list slot of its NXDN profile's talk group or contact; its RX group (`0x6B`) is the position of its RX list among the NXDN RX lists. A channel whose target or list the NXDN lists could not hold is written with none, and the Write warns.

Not checked on a radio. The zone NXDN roaming bitmap (`0x04C00000`) is left alone: the radio uses it only for NXDN roaming, and a stale one only changes which repeaters roaming tries.

## Channel modes

The mode byte follows the DMR rule, with an NXDN profile counting as the digital half when there is no DMR profile:

| Library profiles  | Mode byte     | Note                                                                                                 |
| ----------------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| NXDN only         | digital       | Warns: while the radio is on DMR it acts as a DMR channel with no contact                            |
| DMR and NXDN      | digital       | Both field sets written                                                                              |
| FM or AM and NXDN | fixed-digital | Warns: in NXDN mode the radio forces analogue + digital to digital, so the analogue half is not used |
| FM or AM only     | analogue      | Unchanged                                                                                            |

## Not covered

NXDN own ID and the other NXDN settings, the 64,000-entry ID directory, encryption and status messages, several call targets per channel.
