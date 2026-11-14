# Reference tools

Global lookup helpers — no active project required (except channel lookup on the Maidenhead tool, which needs library data).

**Tracking:** [#29](https://github.com/pskillen/codeplug-studio/issues/29), [#30](https://github.com/pskillen/codeplug-studio/issues/30)

## Routes

| Path                        | Tool                                                                     | Docs                                    |
| --------------------------- | ------------------------------------------------------------------------ | --------------------------------------- |
| `/reference`                | Hub — choose from Tools strip; a Debug section where the gate allows it  | [debug](../debug/README.md)             |
| `/reference/maidenhead`     | _(redirect)_ → `/tools/locator` or `/tools/bearing`                      | [field-tools](../field-tools/README.md) |
| `/reference/bands`          | UK band allocation table with pills                                      | [bands.md](../../reference/bands.md)    |
| `/reference/rf-propagation` | _(redirect)_ → [propagation.mm9pdy.net](https://propagation.mm9pdy.net/) | —                                       |

Reference routes are **not** behind `RequireActiveProject`. They sit under the **Tools** primary tab ([#917](https://github.com/pskillen/codeplug-studio/issues/917)). mk2 U4/U5 layouts shipped in r2 [#945](https://github.com/pskillen/codeplug-studio/issues/945).

**Propagation Visualiser** moved off-Studio to [propagation.mm9pdy.net](https://propagation.mm9pdy.net/) ([#1259](https://github.com/pskillen/codeplug-studio/issues/1259), closing epic [#1162](https://github.com/pskillen/codeplug-studio/issues/1162)). The Tools strip (`contextualStripItems.ts`) links there directly on every build env; `/reference/rf-propagation` is kept only as a client-side redirect for old bookmarks (`RfPropagationRedirectPage.tsx`).

## Debug section

Below the tool cards, the Tools page lists the Debug index and each Debug page (`DEBUG_TOOL_LINKS` in
`contextualStripItems.ts`) under a **Debug** heading with the Debug icon.
It is shown under exactly the rule that shows the avatar menu's Debug item, `resolveDebugPagesGate`: on prod only
while [developer mode](../developer-mode/README.md) is on, on every other build always. It is there because the
Android app has no URL bar. Pages that need Web Serial carry a "Desktop Chrome / Edge" badge.

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
