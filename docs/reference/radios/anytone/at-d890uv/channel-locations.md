# AT-D890UV channel location table (MM9PDY)

The MM9PDY modded firmware shows the distance and compass point from the radio's GPS position to the current
channel's site. The channel record has no room for a position, so the **MM9PDY target** writes a separate table into
flash the stock firmware and the official CPS never use.

**The firmware repo owns the byte layout.** This page says what Studio does with it; it does not copy it.

- Layout (storage contract v1): [anytone-d890-firmware — channel distance storage layout](https://github.com/pskillen/anytone-d890-firmware/blob/main/docs/features/channel-distance/storage-layout.md)
  and the "Scope and plan" comment on [anytone-d890-firmware#75](https://github.com/pskillen/anytone-d890-firmware/issues/75)
- User-facing behaviour: the shared spec `firmware-mods/features/channel-distance.md`
- Studio ticket: [#1383](https://github.com/pskillen/codeplug-studio/issues/1383)

## Where

The dedicated erase-unit pair `0x05C00000` / `0x05C40000`. Studio addresses the A half only (`0x05C00000`); the
radio's `W` handling puts the data in the non-live half and `END` promotes it, like any other A/B unit
([flash-sectors.md](flash-sectors.md)). The pair sits above the write `MemoryMap`, so the table never lives in the
image: the upload stages it straight into the sparse cache.

## What Studio writes

| Rule                | Studio                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Targets             | `radio-io-at-d890uv-mm9pdy` only. The stock target clears the pair from the upload cache and never reads or writes it                         |
| Entry count         | The highest occupied memory channel after the channel encode (`ChannelSet`), at most 4000                                                     |
| Slots               | Header and **every** slot `0 .. count-1`. A slot without a position is 16 × `00`                                                              |
| Position            | Channel `location` when _Use location_ is on and the point is usable (`channelHasUsableLocation`)                                             |
| Fingerprint         | RX bytes and name CRC read from the **encoded** channel record in the write image, so they match what the firmware compares                   |
| Unit                | Build export setting `channelDistanceUnit` (`km` default, or `mi`)                                                                            |
| Owning the unit     | The merged erase unit starts as erased flash (`FF`), never from the fresh read: the factory test pattern at `+0x1000` is not carried over     |
| Allow-list          | `writableExtents` entry `ChannelLocationTable`: `0x05C00000`, length `0xFA20` (header + 4000 entries). Neighbours and the B half stay refused |
| One run per session | The unit is staged with the others and sent once, in ascending address order (it is the highest unit Studio writes)                           |
| Verify              | `channelLocationTable` region in the write-verify read list (group _Channel locations (MM9PDY firmware)_)                                     |

Code: `src/integrations/radio-io/radios/at-d890uv/channelLocationCodec.ts` (encode/decode),
`memory.ts` (`stageAtD890ChannelLocationTable`), `protocol.ts` (unit ownership in `upload`). Tests reuse the
firmware's v1 vectors (`channelLocationVectors.test.ts`).

## Not covered

- No firmware identity check: an MM9PDY Write to a radio on stock firmware still writes the table, which the stock
  firmware never reads ([#613](https://github.com/pskillen/codeplug-studio/issues/613)).
- On-radio checks (live half after `END`, distance against a known site, official-CPS write leaves the table) are on
  the firmware side's RC radio checklist.
