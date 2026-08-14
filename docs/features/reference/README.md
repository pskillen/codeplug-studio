# Reference tools

Global lookup helpers — no active project required (except channel lookup on the Maidenhead tool, which needs library data).

**Tracking:** [#29](https://github.com/pskillen/codeplug-studio/issues/29), [#30](https://github.com/pskillen/codeplug-studio/issues/30)

## Routes

| Path                    | Tool                                | Docs                                 |
| ----------------------- | ----------------------------------- | ------------------------------------ |
| `/reference`            | Hub — choose from Tools strip       | —                                    |
| `/reference/maidenhead` | Maidenhead locator ↔ coordinates    | [maidenhead.md](../maidenhead.md)    |
| `/reference/bands`      | UK band allocation table with pills | [bands.md](../../reference/bands.md) |
| `/reference/rf-propagation` | Propagation Visualiser          | [hf-propagation/](../hf-propagation/README.md) |

Reference routes are **not** behind `RequireActiveProject`. They sit under the **Tools** primary tab ([#917](https://github.com/pskillen/codeplug-studio/issues/917)). mk2 U4/U5 layouts shipped in r2 [#945](https://github.com/pskillen/codeplug-studio/issues/945).

## Code anchors

| Path                                             | Role                                   |
| ------------------------------------------------ | -------------------------------------- |
| `src/app/routes/reference/`                      | Index, Maidenhead, and Bands pages     |
| `src/app/components/reference/BandPlanTable.tsx` | Grouped allocation tables              |
| `src/app/nav/contextualStripItems.ts`            | Tools strip destinations               |
| `src/core/domain/maidenhead.ts`                  | Locator math                           |
| `src/core/domain/bandCatalog.ts`                 | Full band catalog                      |
| `src/core/domain/bandPlan.ts`                    | Hz lookup helpers for summary/channels |

## Related

- [app-shell](../app-shell/README.md) · [onboarding](../onboarding/README.md) · [maidenhead](../maidenhead.md) · [bands reference](../../reference/bands.md)
