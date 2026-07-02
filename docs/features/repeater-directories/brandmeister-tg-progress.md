# BrandMeister talk groups + RX list — progress

**Tracking:** [#65](https://github.com/pskillen/codeplug-studio/issues/65)  
**Branch:** `65/pskil/brandmeister-tg-rgl`

## Shipped on branch

| Commit    | Slice                                                                 |
| --------- | --------------------------------------------------------------------- |
| `14a77f9` | Model `RxGroupListMember.timeSlotOverride`                            |
| `3c3b826` | Integrations: fetch, resolve, import bundle, RX list diff             |
| `011c33a` | Import flow: checkbox + multi-entity persist on Add from BrandMeister |
| `d4a9188` | Verify flow: `BrandmeisterRxGroupListSyncDialog` after channel diff   |
| (docs)    | Feature + tier-3 reference + library README                           |

## Verify

- `npm run format:check && npm run lint && npm run test && npm run build`
- Manual: GB7AC import with TG+RGL; verify sync with shared-list warning
