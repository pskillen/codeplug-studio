# AT-D890UV radio settings — outstanding

**Tracking:** [#1393](https://github.com/pskillen/codeplug-studio/issues/1393)

## Open

- [ ] PRs 4–5 and 7 (Write UI, advanced fields, frequency range); the page's range line shows "code N" until #1395 lands (`TODO(#1393 PR 7)`)
- [ ] Start-up channel `+0xD6..+0xDA` (zone and channel byte encodings not settled: the settings page leaves it out; settle with an emulator boot pair in PR 5) and the key-lock scope `+0xBE` (bits not settled statically)
- [ ] Last-caller value order and the time-slot / colour-code bits on a DMR channel (radio checks RS8b, RS8c)
- [ ] Remove the persisted MM9PDY step-key switch for the D890 (the nudge is on the settings page; Review adds it with the Write UI)
- [ ] Owner radio checks RS1, RS2, RS8, RS8b, RS8c (see the feature page)

## Closed / filed elsewhere

- [x] Settings-only emulator vectors for every v1 field at its highest and lowest value (PR 2)
- [x] False "Preserved settings: FAIL" after MM9PDY step keys — [#1394](https://github.com/pskillen/codeplug-studio/issues/1394)
