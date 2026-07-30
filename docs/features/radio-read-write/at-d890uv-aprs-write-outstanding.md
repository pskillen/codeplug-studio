# AT-D890UV APRS serial Write — outstanding

**Tracking:** [#758](https://github.com/pskillen/codeplug-studio/issues/758) · hardware bug [#884](https://github.com/pskillen/codeplug-studio/issues/884)

Debt discovered during execution — not the plan backlog.

## Open

- [ ] Hardware Read→Write→Read-back of modelled digital APRS fields after [#884](https://github.com/pskillen/codeplug-studio/issues/884) cache-sync fix (see progress checklist)
- [ ] AmAir/FM cross-bank `channelN` refs on serial Write — [#756](https://github.com/pskillen/codeplug-studio/issues/756)

## Closed / filed elsewhere

- [x] Digital report channel slots not uploaded — `applyAtD890WriteImageToCache` omitted `AprsConfigMain`; fixed via `syncAprsRegionsToCache` + regression in `memory.test.ts` — [#884](https://github.com/pskillen/codeplug-studio/issues/884)
