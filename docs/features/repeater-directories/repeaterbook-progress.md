# RepeaterBook directory — progress

**Tracking:** [#274](https://github.com/pskillen/codeplug-studio/issues/274) · parent [#278](https://github.com/pskillen/codeplug-studio/issues/278)  
**Branch:** `274/pskil/repeaterbook-directory`

## Shipped on branch

| Commit                                                                             | Slice                        |
| ---------------------------------------------------------------------------------- | ---------------------------- |
| `docs: add RepeaterBook tier-3 reference and API constants`                        | Tier-3 reference + constants |
| `feat(settings): RepeaterBook user token section with obtain-token instructions`   | Settings + hook              |
| `feat(integrations): RepeaterBook client, query router, and listing normalisation` | Integration client + tests   |
| `feat(library): add-from-repeaterbook search and import UI`                        | Search UI + route            |
| `feat(library): RepeaterBook verify on channel editor`                             | Verify panel                 |
| `docs: repeater-directories hub update for RepeaterBook`                           | Tier-1 hub                   |

## Approval

| Constant    | Value                                                                                |
| ----------- | ------------------------------------------------------------------------------------ |
| App ID      | `103`                                                                                |
| User-Agent  | `CodeplugStudio/1.0 (+https://codeplug.mm9pdy.net; mm9pdy@gmail.com)` (prefix match) |
| Token model | Distributed `rbuapp_…` per user                                                      |

## Verify

- `npm run format:check && npm run lint && npm run test && npm run build`
- Manual: Settings token → Add from RepeaterBook → search → add channel; channel editor → Check RepeaterBook
