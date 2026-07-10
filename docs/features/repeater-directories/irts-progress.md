# IRTS Ireland repeater directory — progress

**Tracking:** [#273](https://github.com/pskillen/codeplug-studio/issues/273) · parent [#272](https://github.com/pskillen/codeplug-studio/issues/272)  
**Branch:** `273/pskil/irts-repeater-directory`

## In flight

| Slice | Status | Notes |
| ----- | ------ | ----- |
| 0 Spike + reference doc | In progress | `docs/reference/irts/README.md`, progress pair |
| 1 CORS bridge | Pending | `wrangler.toml`, Pages Function, Vite proxy |
| 2 Integration client | Pending | `irtsClient.ts` + tests |
| 3 Add-from UI | Pending | Route, modal entry, shared search shell |
| 4 Channel verify | Pending | `RepeaterVerifyPanel` |
| 5 Feature docs closeout | Pending | Hub README, Help |
| 6 PR | Pending | |

## Verify (when complete)

- `npm run format:check && npm run lint && npm run test && npm run build`
- Manual: Add from IRTS → filter → add channel; channel editor → Check IRTS
