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

## Next

- PR 2: Baofeng DM-32UV MM9PDY target and zone-scan write (scan-list id 0). [#1321](https://github.com/pskillen/codeplug-studio/issues/1321) stays open
