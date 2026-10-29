# RT95 MM9PDY data table (MMD1)

The MM9PDY modded RT95 head shows zones and a 12-character description per channel. The stock channel record has no
room for either, so the **MM9PDY target** writes a separate table into the upper half of the main-board EEPROM,
which the stock firmware, the official CPS and CHIRP never touch.

**The firmware repo owns the byte layout.** This page says what Studio does with it; it does not copy it. The layout
page (`docs/reference/mm9pdy-eeprom-layout.md`) and its golden vectors (`fw/tests/vectors/mmd1-v1.json`) live in
`pskillen/retevis-rt95-firmware`; the tracking ticket is
[retevis-rt95-firmware#10](https://github.com/pskillen/retevis-rt95-firmware/issues/10). A change to the layout is a
new layout version, never an edit of v1.

- Studio ticket: [#1461](https://github.com/pskillen/codeplug-studio/issues/1461)

## Where

EEPROM `0x4000`-`0x5FFF`, in one-line map form: header `0x4000`, radio state `0x4010` (the radio writes it),
zone name blocks `0x4100 + 16 i`, member slots `0x4300 + 32 i`, description blocks `0x5000 + 16 n`. The stock clone
image is `0x0000`-`0x329F`; nothing of ours lives between `0x32A0` and `0x3AFF`.

## What Studio does

| Rule                 | Studio                                                                                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chip-size guard      | Before any access to `0x4000+`, read the blocks at `0x3B00` (ident, starts `RT95-P` NUL) and `0x7B00`. A failed read, an all-zero block (the head answers with zeros when the main board does not reply), a bad ident or two equal blocks means a 16 KiB or unknown chip: no mod data |
| Allowed write blocks | 16-byte blocks at 16-aligned addresses in `0x0000`-`0x3290` for any target. On the MM9PDY target after a passing guard also `0x4000`-`0x5FF0`                                                                                                                                         |
| State block          | `0x4010` is never written on a codeplug Write (the radio owns it); a Restore may put a backup back                                                                                                                                                                                    |
| Hard ceiling         | Nothing at or above `0x6000`, and never at or above `0x7B00` (it aliases the ident, calibration and signature on a 16 KiB chip)                                                                                                                                                       |
| Write order          | Descriptions (ascending channel), member slots (two blocks each), name blocks, then the **header last**. An interrupted write never yields wrong zones                                                                                                                                |
| Generations          | Content-derived, so an identical rewrite keeps the radio's saved zones                                                                                                                                                                                                                |
| Stock targets        | Never write, read-modify or clear `0x4000`-`0x5FFF`                                                                                                                                                                                                                                   |
| Empty table          | Zero zones and no descriptions is a valid header and is written; it retires an older table                                                                                                                                                                                            |

The guard and the allowed-address rules are interlocks in code, each with a refusal test; no flag turns one off. Limits (32 zones, 8-character
zone names, 12-character descriptions) are in [limits.md](limits.md).

## Where the code is

`src/integrations/radio-io/radios/rt95/modData/`: `layout.ts` (constants), `chipGuard.ts`, `writeInterlock.ts`,
`encode.ts`, `decode.ts` (mirrors the radio's reader rules, for the inspector and tests). Vectors are in
`src/integrations/radio-io/radios/rt95/__fixtures__/mmd1Vectors.ts`. CRC helpers are in
`src/integrations/radio-io/kit/checksums.ts`.

## How Studio fills it

| Field            | Source                                                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Radio name (6)   | The channel's Callsign when set, otherwise the usual wire name. A build `wireName` override wins                                                                                               |
| Description (12) | The channel's Name, shortened (channel abbreviation first); empty when it equals the radio name. A build `wireDescription` override wins, and an explicit empty one means none                 |
| Text             | Accents are folded (`Café` becomes `Cafe`), any other character outside `0x20`-`0x7E` becomes `-`, and in descriptions `_` becomes `-`. Zone and radio names go through the same ASCII rules   |
| Numbering        | Channels are numbered in zone order (zones in build order, members in zone order, first appearance wins), then the rest; pinned slots keep their pin. A channel in two zones has one number    |
| Zones            | Up to 32, 8-character names. Empty zones are dropped with a warning; more than 32 keeps the first 32 with a warning. The radio visits a zone's channels in channel-number order (an info note) |
| Scan             | One scan flag per channel; per-zone scan choices are ignored with one warning                                                                                                                  |

Owner backup, 2026-10-28: on the owner's chip the range from `0x4000` to `0x7FFF` is erased (all `0xFF`) with no all-zero blocks, so refusing a zero read cannot wrongly block that radio.

## Status

Shipped in Studio on the `retevis-rt95-mm9pdy` target, on every site. Checked on the owner's radio with the MM9PDY firmware 1.1.0 (zones and descriptions).
