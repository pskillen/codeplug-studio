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

## Next

- One channel per repeater on the D890 write, with the RX group attached, and optional-settings `+0x200` left unchanged
