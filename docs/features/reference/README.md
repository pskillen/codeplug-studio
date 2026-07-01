# Reference tools

Global lookup helpers — no active project required (except channel lookup on the Maidenhead tool, which needs library data).

**Tracking:** [#29](https://github.com/pskillen/codeplug-studio/issues/29), [#30](https://github.com/pskillen/codeplug-studio/issues/30)

## Routes

| Path                    | Tool                                | Docs                                 |
| ----------------------- | ----------------------------------- | ------------------------------------ |
| `/reference`            | Hub — choose from section nav       | —                                    |
| `/reference/maidenhead` | Maidenhead locator ↔ coordinates    | [maidenhead.md](../maidenhead.md)    |
| `/reference/bands`      | UK band allocation table with pills | [bands.md](../../reference/bands.md) |

Reference routes are **not** behind `RequireActiveProject`. Section nav uses route `NavLink`s (not scroll anchors).

## Code anchors

| Path                                                             | Role                                   |
| ---------------------------------------------------------------- | -------------------------------------- |
| `src/app/routes/reference/`                                      | Index, Maidenhead, and Bands pages     |
| `src/app/components/reference/BandPlanTable.tsx`                 | Grouped allocation tables              |
| `src/app/components/SectionNav/sections/ReferenceSectionNav.tsx` | Hub sidebar links                      |
| `src/core/domain/maidenhead.ts`                                  | Locator math                           |
| `src/core/domain/bandCatalog.ts`                                 | Full band catalog                      |
| `src/core/domain/bandPlan.ts`                                    | Hz lookup helpers for summary/channels |

## Related

- [app-shell](../app-shell/README.md) · [maidenhead](../maidenhead.md) · [bands reference](../../reference/bands.md)
