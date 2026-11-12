# UV-5R Mini MM9PDY zone table (MMZ1)

The stock UV-5R Mini has no zones. The MM9PDY modded firmware shows up to 24 zones from a table in the radio's
external SPI flash, which the stock firmware, the official CPS and CHIRP never touch. A later Studio phase adds the
MM9PDY target that writes it over the clone protocol; the radio only reads it.

**The firmware project owns the byte layout.** This page says what Studio does with it and does not copy it. The
format is the firmware project's MMZ1 v1 contract. A change to the layout is a new version (new magic), never an edit
of v1.

## Where

External SPI `0xC000`-`0xCFFF`, one 4 KiB sector. One-line map: header `0xC000` (one 64-byte frame), zone name
records `0xC200 + 16 i`, member bitmaps `0xC400 + 128 i` (channel 1 is slot 0, one bit per slot, 999 slots). The rest
of the sector stays erased (`FF`). The stock clone image does not reach this range.

## What Studio does

| Rule        | Studio                                                                                                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Write order | Header frame first (a write to a 4 KiB-aligned address erases the sector), then name frames, then each zone's two bitmap frames. An interrupted write never yields wrong zones               |
| Integrity   | CRC-16/XMODEM over the header, the name records and the bitmaps; the radio shows no zones when any reader rule fails                                                                         |
| Generation  | Derived from the CRC, so an identical rewrite keeps the radio's saved state                                                                                                                  |
| Empty table | Zero zones is valid and retires an older table                                                                                                                                               |
| Write rules | The `mm9pdy` profile of the Mini write interlock adds 64-byte frames at 64-aligned `0xC000`-`0xCFC0`. Stock is unchanged. `0xB000`-`0xBFFF` and `0xD000` upward are refused on every profile |

The codec and the allow-list exist; nothing sends them yet. The target and write path are added by a later phase.

## Where the code is

`src/integrations/radio-io/radios/uv5r-mini/modData/`: `layout.ts` (constants), `encode.ts`
(`encodeUv5rMiniZoneTable`), `decode.ts` (`decodeUv5rMiniZoneTable`, mirrors the radio's reader rules). The allow-list
is `uv5r-mini/writeInterlock.ts`. Vectors are in `uv5r-mini/__fixtures__/mmz1Vectors.ts`. Limits are in
[limits.md](limits.md).
