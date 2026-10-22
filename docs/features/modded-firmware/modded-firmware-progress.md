# MM9PDY modded firmware — progress

**Tracking:** [codeplug-studio#1312](https://github.com/pskillen/codeplug-studio/issues/1312)
**Plan:** `.cursor/plans/modded_firmware_targets_2b72a5b6.plan.md`
**Branch:** `1313/pskil/mm9pdy-d890`

---

## Overall status

**Status:** In progress

**Branch:** `1313/pskil/mm9pdy-d890` (from `origin/main`)

---

## Register the AT-D890UV target

**Status:** Complete on this branch
**Issues:** [#1315](https://github.com/pskillen/codeplug-studio/issues/1315)

**Delivered**

- Radio target `anytone-at-d890uv-mm9pdy`, label `Anytone AT-D890UV (MM9PDY modded firmware)`
- Web Serial profile `radio-io-at-d890uv-mm9pdy` (same hardware caps; scan lists `not_used`)
- Trait profile without m×n, dedicated scan lists, or timeslot clones
- Export defaults leave RX-group expansion off
- Same D890 descriptor and satellite-keps adapters as the stock Web Serial profile

**Verify**

- Catalog and trait tests for the new target; stock `anytone-at-d890uv` tests unchanged
- Build nav for the MM9PDY target has Zones and RX group lists, and no Scan lists

---

## One channel per repeater

**Status:** Complete on this branch
**Issues:** [#1316](https://github.com/pskillen/codeplug-studio/issues/1316)

**Delivered**

- MM9PDY write uses the stock D890 codec and emits one digital channel per repeater
- That channel keeps its RX group; talk-group members are bank indexes
- No scan-list records (scan-list limits stay `not_used`)
- Optional-settings `+0x200`..`+0x21F` is not rewritten

**Verify**

- Two talk groups on one repeater → one channel and one RX group; stock target still expands
- Firmware settings marker at `OptionalSettingsMain + 0x200` survives encode

---

## Per-member timeslot

**Status:** Complete on this branch
**Issues:** [#1317](https://github.com/pskillen/codeplug-studio/issues/1317)

**Delivered**

- MM9PDY write stores `timeSlotOverride` at RX-group stride `+0x120 + index` (`0x01` / `0x02`)
- Omitted members stay `0xFF`
- Stock encode fills that tail with `0xFF`, including over a previous `0x01` / `0x02`
- Decode reads the tail back into `1` / `2` / unset

**Verify**

- Codec test: MM9PDY `0x02` at `+0x121`; stock fill is `0xFF`
- Projection copies overrides only when the radio target is MM9PDY

---

## Optional TG step keys

**Status:** Complete on this branch
**Issues:** [#1318](https://github.com/pskillen/codeplug-studio/issues/1318)

**Delivered**

- `assignMm9pdyStepKeys` on the build's export settings. Unset or false leaves P1 and P2 as read
- When on, the MM9PDY write sets P1 short to 14 (TG next) and P2 short to 13 (TG previous)
- The same switch is on the export settings page and in the Write radio popup
- Upload patches those two bytes on the fresh optional-settings erase unit. `+0x200` stays the radio's own bytes
- Stock AT-D890UV writes ignore the flag

**Verify**

- Encode: pre-seeded P1/P2 unchanged when off; 14 and 13 when on; `+0x200` marker intact
- Protocol: the 16-byte frame at `+0x10` carries 14 and 13, and `+0x200` matches the fresh read
- Popup: stock target has no switch; MM9PDY saves the same field

---

## DM-32UV radio target

**Status:** Complete on this branch
**Issues:** [#1319](https://github.com/pskillen/codeplug-studio/issues/1319)

**Delivered**

- Radio target `baofeng-dm32uv-mm9pdy` and Web Serial profile `radio-io-dm32uv-mm9pdy`
- Traits: zone grouping, zone as scan list, multi talk group per channel, separate digital ID list
- No m×n, no scan-list bank, no timeslot clones. Stock CSV and NeonPlug stay on `baofeng-dm32uv`

**Verify**

- Catalog and trait tests. Stock `baofeng-dm32uv` traits are unchanged

---

## DM-32UV zone-scan write

**Status:** Complete on this branch
**Issues:** [#1320](https://github.com/pskillen/codeplug-studio/issues/1320)

**Delivered**

- One digital channel per repeater. Every channel scan-list id is 0. No scan-list records
- Tag `0x04` byte `+0xB0` stays as read on the shared encoder
- Radio-ID bank, address book, and dual-bank directory stay on for both DM-32 profiles

**Verify**

- Projection test: two talk groups, one channel, `scanLists` empty. Stock profile still expands and keeps a scan-list record
- Hydration test: settings `+0xB0` unchanged when scan lists are cleared

---

## AT-D890UV default scan list on Write

**Status:** Complete on this branch

**Delivered**

- An AT-D890UV MM9PDY Write with no zone-derived lists still writes one scan list containing the first channel so the occupancy bitmap is not empty
- Channels stay without a scan-list id. Stock AT-D890UV zone-derived lists and the DM-32 MM9PDY write (scan-list id 0, no records) are unchanged

**Verify**

- Projection: one repeater, two talk groups → list index 1, name `Scan list 1`, that channel's slot; `scanListId` unset
- No channel → `scanLists` stays empty

---

## Next

- Nothing open on the DM-32UV slice beyond the outstanding list.

---

## DM-32UV timeslot store and step keys

**Status:** Complete on this branch
**Issues:** [#1321](https://github.com/pskillen/codeplug-studio/issues/1321)
**Depends on:** firmware format in [baofeng-dm32-firmware#69](https://github.com/pskillen/baofeng-dm32-firmware/pull/69)

**Delivered**

- MM9PDY write stores `timeSlotOverride` in the RX-group page tail (marker, 2 bits per member, per-group check byte) when any member has one
- Stock write keeps the `0xFF` tail
- Decoder returns slots only when the marker and the group's check match
- `assignMm9pdyStepKeys` now applies to the DM-32UV: P1 short 20, P2 short 21
