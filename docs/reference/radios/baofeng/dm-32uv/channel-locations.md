# DM-32UV channel location pages (MM9PDY)

The MM9PDY modded firmware shows the distance and compass point from the radio's GPS position to the current
channel's site. The channel record has no room for a position, so the **MM9PDY target** writes twelve codeplug pages
on tags the stock firmware never reads and the official CPS does not move.

**The firmware repo owns the byte layout.** This page says what Studio does with it; it does not copy it.

- Layout (storage contract v1): the "Scope and plan" comment on
  [baofeng-dm32-firmware#71](https://github.com/pskillen/baofeng-dm32-firmware/issues/71) and the firmware's
  [channel distance docs](https://github.com/pskillen/baofeng-dm32-firmware/tree/main/docs/features/channel-distance)
- User-facing behaviour: the shared spec `firmware-mods/features/channel-distance.md`
- Studio ticket: [#1383](https://github.com/pskillen/codeplug-studio/issues/1383)

## Where

Page _k_ (0–11) uses tag `70 71 72 73 76 77 78 79 7A 7B 7D 7E` and covers channels `1 + 339k .. 339(k + 1)`. Tag map:
[memory-layout.md](memory-layout.md).

## What Studio writes

| Rule          | Studio                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Targets       | `radio-io-dm32uv-mm9pdy` only. Stock encodes record no location pages; Read never bulk-reads those tags, so stock never touches them                                                                                      |
| Reuse         | A live page with the tag is overwritten in place. With duplicates on the radio, the lowest address (the one boot cleanup keeps) is used                                                                                   |
| No duplicates | Studio never creates a second page with a tag that is already live                                                                                                                                                        |
| Create        | A free page is claimed only when the page holds at least one position (lowest free page, never one the zone encode claimed this Write)                                                                                    |
| Clear         | An existing page is rewritten even when it now holds none, so old entries are cleared                                                                                                                                     |
| Entries       | Position when _Use location_ is on and usable; fingerprint from the **encoded** channel record bytes `+0x00..+0x13`; absent entries stay `FF`                                                                             |
| Unit          | Build export setting `channelDistanceUnit` (`km` default, or `mi`)                                                                                                                                                        |
| Live check    | Before Write, against the upload's own metadata scan: a reused page must still be the lowest page with its tag; a claimed page must still be free and its tag absent. Any change fails the Write ("Read the radio again") |
| Cache         | Location pages are written as whole 4 KiB blocks but never kept in the sparse cache, so a later stock Write cannot resend them                                                                                            |
| After Write   | Power-cycle the radio: it learns new pages at boot (the same power-cycle note as every DM-32 Write)                                                                                                                       |

Code: `src/integrations/radio-io/radios/dm32uv/channelLocationCodec.ts`, `hydration.ts` (runs after the channel and
zone encodes), `protocol.ts` (`assertDm32ChannelLocationPagesWritable` in `upload`). Tests reuse the firmware's v1
vectors (`channelLocationVectors.test.ts`, whole-page SHA-256).

## Not covered

- No firmware identity check ([#613](https://github.com/pskillen/codeplug-studio/issues/613)).
- On-radio checks are on the firmware side's RC radio checklist.
