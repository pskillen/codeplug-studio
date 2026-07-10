# IRTS Ireland repeater directory — progress

**Tracking:** [#273](https://github.com/pskillen/codeplug-studio/issues/273) · parent [#272](https://github.com/pskillen/codeplug-studio/issues/272)  
**Branch:** `273/pskil/irts-repeater-directory`

## Shipped on branch

| Commit                                                                   | Slice                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------- |
| `docs(repeaters): add IRTS Ireland spike reference and progress logs`    | Spike doc + progress pair                               |
| `feat(infra): add IRTS CORS bridge via Pages Function and wrangler.toml` | `wrangler.toml`, Pages Function, Vite proxy, build docs |
| `feat(integrations): add IRTS Anytone CSV repeater client`               | `irtsClient.ts` + tests                                 |
| `feat(app): add IRTS repeater directory search and import route`         | Add from IRTS UI + modal entry                          |
| `feat(app): add Check IRTS verify on channel editor`                     | `RepeaterVerifyPanel`                                   |
| `docs(repeaters): document shipped IRTS directory workflows`             | Feature hub + Help                                      |

## Verify

- `npm run format:check && npm run lint && npm run test && npm run build`
- Manual: Add from IRTS → filter → add channel; channel editor → Check IRTS
