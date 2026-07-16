# Channel behavioural defaults — progress

**Tracking:** Epic [#388](https://github.com/pskillen/codeplug-studio/issues/388) · [#419](https://github.com/pskillen/codeplug-studio/issues/419), [#398](https://github.com/pskillen/codeplug-studio/issues/398), [#420](https://github.com/pskillen/codeplug-studio/issues/420), [#421](https://github.com/pskillen/codeplug-studio/issues/421)

**Branch:** `388/pskil/channel-behavioural-defaults`

## Status

Pre-export layers shipped in one PR. Format wire mappers remain on [#422](https://github.com/pskillen/codeplug-studio/issues/422)–[#425](https://github.com/pskillen/codeplug-studio/issues/425).

## Shipped

| Slice                                       | Status   | Notes                                                  |
| ------------------------------------------- | -------- | ------------------------------------------------------ |
| Progress tracking                           | Complete | This file + outstanding sibling                        |
| Core cascade foundation (#419)              | Complete | Schema v18, resolve helpers, persistence               |
| Docs pattern (#419)                         | Complete | `docs/reference/channel-behavioural-defaults.md`       |
| Forbid TX export bridge                     | Complete | DM32, OpenGD77, Anytone, CHIRP                         |
| Library fields + Channel defaults UI (#398) | Complete | `/library/channels/defaults`, Behaviour tab, bulk edit |
| Build export overrides (#420)               | Complete | Export panel optional overrides                        |
| Export resolution summary (#421)            | Complete | `/builds/:id/export-resolution`                        |

## Next

- Format adapter wire mapping ([#422](https://github.com/pskillen/codeplug-studio/issues/422)–[#425](https://github.com/pskillen/codeplug-studio/issues/425))
