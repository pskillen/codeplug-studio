# UV-5R Mini MM9PDY zone table (MMZ1)

The stock UV-5R Mini has no zones. The MM9PDY modded firmware shows up to 24 zones from a table in the radio's
external SPI flash, which the stock firmware, the official CPS and CHIRP never touch. Studio's MM9PDY target writes it
over the clone protocol; the radio only reads it.

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

## The MM9PDY target

Radio target `baofeng-uv5r-mini-mm9pdy`, Web Serial profile `radio-io-uv5r-mini-mm9pdy`, on the stock Mini driver.
Write is hidden on the production site until the MM9PDY Mini firmware ships, and shown on every pre-production site
(the profile's `prodWriteDisabled` flag; no native-app exemption).

- **Write order.** Studio encodes the table before the first frame, so a bad input fails before the radio sees
  anything. Then the stock clone blocks exactly as the stock target writes them, then the table frames in the codec's
  order: the header at `0xC000` first (that write erases the sector), the name frames, then each zone's two bitmap
  frames. The progress window shows the table as its own **Zone table** stage.
- **Checks before any write.** The model reply check refuses a radio that does not answer as a Mini, and the write
  interlock checks the whole plan (stock blocks and table frames) before the handshake. On this target the interlock
  adds `0xC000`-`0xCFC0` to the stock spans and nothing else; a Restore on it is held to the same spans.
- **Verify.** After a Write, verify reads `0xC000`-`0xCFFF` back (64 frames) along with the clone and compares every
  frame written. A difference shows as a **Zone table** mismatch.
- **Stock targets never touch the range.** The stock Mini target writes no frame at or above `0xC000`, and its
  interlock refuses one.
- **An empty table is still written.** A build with no zones writes the header with zero zones, which retires an older
  table on the radio.
- **Restore** writes the clone regions only; it never carries the table.

Channels are numbered in zone order: the first zone's channels first, then the next zone's new channels, then any
channel in no zone. A pinned channel keeps its number. Zones point at channel numbers.

## What the operator should know

- **Zones match by channel number.** A CPS or CHIRP edit after a Studio Write can move channels, and a zone then points
  at whatever now sits at its old numbers. Write again from the MM9PDY target after such an edit.
- **A radio factory reset keeps the zones.**
- **Choosing a zone.** On the radio, Menu › Zones A / Zones B.

## Where the code is

`src/integrations/radio-io/radios/uv5r-mini/modData/`: `layout.ts` (constants), `encode.ts`
(`encodeUv5rMiniZoneTable`), `decode.ts` (`decodeUv5rMiniZoneTable`, mirrors the radio's reader rules). The allow-list
is `uv5r-mini/writeInterlock.ts`. The write path is `uv5r-mini/protocol.ts` (`Uv5rMiniProtocol.setZoneIntent`, seeded
by the descriptor from the Write projection), the plan `uv5r-mini/plannedStages.ts`, verify the family's
`writeVerifyHooks.ts` with the table as an extra span. The projection is
`src/app/services/radioIoUv5rMiniMm9pdyProjection.ts`. Vectors are in `uv5r-mini/__fixtures__/mmz1Vectors.ts`. Limits are in
[limits.md](limits.md).
