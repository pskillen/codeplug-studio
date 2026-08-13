# Open items

i002 is **closed**. Leftovers below are not blocking and must not reopen the brick hunt.

## Closed with i002

- **I002-1** which stack commit bricked — assemble-from-`0xff` (F1). Corrected on [PR #1118](https://github.com/pskillen/codeplug-studio/pull/1118).
- **I002-2** pause phases 4+ — lifted after `O/hw-pass-p2`; OpenGD77 stack continued.
- **I002-3** remaining `0xff` leaks after #1130 — moot once encode prior is the live cache.
- **I002-4** empty ZoneSet — 11 occupancy bits (`D/21-37`).
- **I002-5** whether verify ran on the Program Error screen — never recorded; not needed for F1.
- **I002-8** dump before recovery — `D/21-37`.
- **#1125 as remaining cause** — `D/22-37`.

## Still open elsewhere (not i002)

| Id     | Item                                                                                                                                                                                                                                                  | Where                                                                                                      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| I002-6 | Capture running SHA in write-verify reports (`Studio: local (local)`)                                                                                                                                                                                 | tooling; `R/21-10` / `R/22-36`                                                                             |
| I002-7 | Promote “recover with `main` + stash, do not Confirm init” into D890 radio reference                                                                                                                                                                  | [`docs/reference/radios/anytone/at-d890uv/`](../../reference/radios/anytone/at-d890uv/) if it earns a home |
| Parked | [#1126](https://github.com/pskillen/codeplug-studio/pull/1126) ZoneHide; [#1129](https://github.com/pskillen/codeplug-studio/issues/1129)–[#1132](https://github.com/pskillen/codeplug-studio/issues/1132) occupancy/ChannelSet/channel-prior patches | do not continue as the encode-base fix                                                                     |
