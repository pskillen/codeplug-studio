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

## Next

- Per-member timeslot byte at RX-group `+0x120` on the MM9PDY target only; stock tail stays `0xFF`
