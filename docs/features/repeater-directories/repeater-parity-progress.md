# Repeater directory parity — progress

**Tracking:** [#43](https://github.com/pskillen/codeplug-studio/issues/43) · [#44](https://github.com/pskillen/codeplug-studio/issues/44)  
**Branch:** `43/pskil/repeater-directory-parity`

## Shipped on branch

| Commit                                                                | Slice                                         |
| --------------------------------------------------------------------- | --------------------------------------------- |
| `feat(integrations): add ukrepeater query router and band search`     | Query router, band endpoint, tests            |
| `feat(integrations): title-case UK repeater text and skip BM comment` | `toTitleCase`, `MapListingOptions`            |
| `feat(app): ukrepeater search full parity UI`                         | Unified search form, bulk add, simplex        |
| `feat(app): brandmeister search parity on shared repeater shell`      | Capability flags, BM client tests             |
| `feat(app): ukrepeater verify on channel edit`                        | Dual verify buttons, `matchListingForChannel` |
| `docs: repeater directory parity status and BM reference`             | Feature + tier-3 docs                         |

## Verify

- `npm run format:check && npm run lint && npm run test && npm run build`
- Manual: UK search modes, BM add, channel edit dual verify
