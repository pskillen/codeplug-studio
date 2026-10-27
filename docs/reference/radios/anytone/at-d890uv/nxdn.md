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

| Byte / bits   | Field                                          | Encoding                                         | Studio                                                                                        |
| ------------- | ---------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `0x66` b0     | Bandwidth / rate                               | 0 = 6.25 kHz (NXDN48), 1 = 12.5 kHz (NXDN96)     | Writes from the profile rate; no rate keeps the bit (a new slot is NXDN48)                    |
| `0x66` b1     | Optional signal                                | 0 off, 1 NXDN ID                                 | Carried over                                                                                  |
| `0x66` b7:4   | Squelch mode                                   | 0 RAN, 1 RAN and ID                              | Carried over                                                                                  |
| `0x67` b3:0   | Busy lock                                      | 0–4                                              | Carried over                                                                                  |
| `0x67` b7:4   | PTT call                                       | 0 off, 1 on; gates the contact at `0x6C`         | Carried over (a later piece sets it with the contact)                                         |
| `0x68`        | TX RAN                                         | 0–63                                             | Writes from the profile; none keeps the byte                                                  |
| `0x69`        | RX RAN                                         | 0–63                                             | Writes from the profile; none keeps the byte                                                  |
| `0x6A`        | Encryption                                     | 0 off, 1–32 key slot                             | Carried over                                                                                  |
| `0x6B`        | RX group list                                  | 0-based, `0xFF` = none (0 selects list 0)        | Always `0xFF` for a channel written with NXDN fields, until RX group lists are written (#255) |
| `0x6C`–`0x6D` | Contact slot (u16 LE) in the NXDN contact list | slot index; used for TX only when PTT call is on | Carried over (a later piece)                                                                  |
| `0x6E`        | Send status                                    | 0 none, 1–50                                     | Carried over                                                                                  |

Writing uses bit operations on `0x66`, so carried-over bits survive. A RAN outside 0–63 is not written (Studio leaves it out and warns); the encoder itself refuses one before any frame is sent.

A new slot starts as zeros, which on the radio is a valid NXDN48 channel with RAN 0 / 0, PTT call off (group call to ID 0) and RX group list 0. A library channel with no NXDN rate therefore comes out as NXDN48 on a new slot and keeps its existing rate on a used one. Studio sets `0x6B` to `0xFF` on every channel it writes with NXDN fields, new or used, so the channel does not listen to list 0 or to whatever list the slot's previous channel had. Channels without NXDN fields keep `0x6B` as read.

## Channel modes

The mode byte follows the DMR rule, with an NXDN profile counting as the digital half when there is no DMR profile:

| Library profiles  | Mode byte     | Note                                                                                                 |
| ----------------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| NXDN only         | digital       | Warns: while the radio is on DMR it acts as a DMR channel with no contact                            |
| DMR and NXDN      | digital       | Both field sets written                                                                              |
| FM or AM and NXDN | fixed-digital | Warns: in NXDN mode the radio forces analogue + digital to digital, so the analogue half is not used |
| FM or AM only     | analogue      | Unchanged                                                                                            |

## Not in this piece

The NXDN talk-group / contact list, RX groups, the channel's TX target (`0x6B`, `0x6C`, PTT call), own ID, the ID directory, encryption and status messages.
