# Channel behavioural defaults — progress

**Tracking:** Epic [#388](https://github.com/pskillen/codeplug-studio/issues/388) · format export [#422](https://github.com/pskillen/codeplug-studio/issues/422)–[#425](https://github.com/pskillen/codeplug-studio/issues/425)

## Status

Anytone, CHIRP, and OpenGD77 mappers merged ([#432](https://github.com/pskillen/codeplug-studio/pull/432), [#435](https://github.com/pskillen/codeplug-studio/pull/435), [#434](https://github.com/pskillen/codeplug-studio/pull/434)). DM32 [#433](https://github.com/pskillen/codeplug-studio/pull/433) PR open.

## Format export mappers

| Slice                                      | Ticket | PR   | Status  |
| ------------------------------------------ | ------ | ---- | ------- |
| Anytone Busy Lock / Talker Alias / Squelch | #422   | #432 | Merged  |
| DM32 TX Admit / RX Squelch Mode            | #423   | #433 | PR open |
| OpenGD77 forbid + loss docs                | #424   | #434 | Merged  |
| CHIRP forbid + loss docs                   | #425   | #435 | Merged  |

## Shipped (pre-export)

| Slice                                       | Status   | Notes                                                                                     |
| ------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| Progress tracking                           | Complete | This file + outstanding sibling                                                           |
| Core cascade foundation (#419)              | Complete | Schema v18, resolve helpers, persistence                                                  |
| Docs pattern (#419)                         | Complete | `docs/reference/channel-behavioural-defaults.md`                                          |
| Forbid TX export bridge                     | Complete | DM32, OpenGD77, Anytone, CHIRP                                                            |
| Library fields + Channel defaults UI (#398) | Complete | `/library/channels/defaults`; talker alias on DMR profile; squelch mode on analog profile |
| Build export overrides (#420)               | Complete | Export panel optional overrides                                                           |
| Export resolution summary (#421)            | Complete | `/builds/:id/export-resolution`                                                           |
