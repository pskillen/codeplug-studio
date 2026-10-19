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

## Next

- Optional `assignMm9pdyStepKeys` on export settings and the Write radio modal; P1 short = 14, P2 short = 13 when on
