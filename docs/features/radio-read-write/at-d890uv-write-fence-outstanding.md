# AT-D890UV Write-path safety (WATCH-08) — outstanding

**Tracking:** [#753](https://github.com/pskillen/codeplug-studio/issues/753)

Debt discovered during execution — not the plan's upcoming slices.

## Open

- [ ] Cross-session post-commit verify (power-cycle + reconnect diff) — [#769](https://github.com/pskillen/codeplug-studio/issues/769) slice 5b / PR6
- [ ] Full firmware band-mode table validation — defer to follow-up issue under [#645](https://github.com/pskillen/codeplug-studio/issues/645)
- [ ] Hardware Read→Write→Read-back clearance before clearing `prodWriteDisabled` ([#741](https://github.com/pskillen/codeplug-studio/issues/741))

## Closed / filed elsewhere

- [x] LocalInfo pre/post recovery diff — bag diffs show LocalInfo byte-identical across healthy and faulted reads; brick was optional-settings erase collateral ([#768](https://github.com/pskillen/codeplug-studio/issues/768))
- [x] Sparse erase-unit RMW shipped — optional settings / alarm preserved through fresh-read + unchanged re-stage ([#768](https://github.com/pskillen/codeplug-studio/issues/768))
- [x] In-session pre/post sentinel verify removed — invalid on commit-on-`END` radio ([#769](https://github.com/pskillen/codeplug-studio/issues/769) 5a)
- [x] Fail-closed upload — failed Write does not send `END` ([#769](https://github.com/pskillen/codeplug-studio/issues/769) 5a)
