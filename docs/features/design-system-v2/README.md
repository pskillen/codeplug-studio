# Design system v2

Visual/navigation redesign for Codeplug Studio ([epic #915](https://github.com/pskillen/codeplug-studio/issues/915)). Foundations ([#916](https://github.com/pskillen/codeplug-studio/issues/916)) shipped the theme + `components/v2/` library; the chrome port ([#917](https://github.com/pskillen/codeplug-studio/issues/917)) wires live `AppLayout` to v2 `AppShell` / `ContextualStrip` / `BottomTabBar`. Page content inside `<Outlet/>` stays on the v1 theme until screen ports (#918–#925).

Guiding principles for the whole epic: (1) fidelity to the Claude Design “Codeplug Studio Design System” tokens/patterns, and (2) mobile as a first-class requirement (Android app shipped; narrow viewports matter on every component demo).

## Implementation status

| Area                               | Status         | Notes                                                                                                                         |
| ---------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Theme tokens + CSS var resolver    | Shipped (#916) | `src/app/theme-v2.ts` — `DSV2_TOKENS`, `themeV2`, `dsv2CssVariablesResolver`                                                  |
| Theme isolation provider           | Shipped (#916) | `DesignSystemV2Provider` — nested `MantineProvider`, `.dsv2-scope` selector (never `:root`)                                   |
| Net-new primitives                 | Shipped (#916) | `Button`, `Pill`, `OverrideField`, `MapPanel`                                                                                 |
| Navigation chrome (presentational) | Shipped (#916) | `AppShell` (top header), `ContextualStrip`, `SectionNav`, `BottomTabBar`                                                      |
| ShuttleList family                 | Shipped (#916) | Wraps `SelectedItemList` / `AvailableItemPicker` — does not reimplement DnD                                                   |
| DataTable                          | Reuse only     | Existing `components/ui/DataTable` re-skins inside the provider; no duplicate                                                 |
| `/styleguide/v2` preview           | Shipped (#916) | Nested under `DesignSystemV2Provider`; linked from `/styleguide`                                                              |
| Live chrome port                   | In progress    | [#917](https://github.com/pskillen/codeplug-studio/issues/917) — AppLayout wired; v2 header / v1 content seam                 |
| Screen ports                       | Deferred       | [#918](https://github.com/pskillen/codeplug-studio/issues/918)–[#925](https://github.com/pskillen/codeplug-studio/issues/925) |
| Real `CodeplugMap` in MapPanel     | Deferred       | [#925](https://github.com/pskillen/codeplug-studio/issues/925)                                                                |
| Domain BandPill / ModePill re-skin | Out of scope   | Use `Pill` `tone="semantic"` when those screens port                                                                          |

## Theme scoping (for contributors)

Mantine `theme.components.*.defaultProps` and CSS variables are **global** if applied on the root provider. Editing `theme.ts` for v2 would regress every v1 screen still in production.

**Mechanism:**

1. `themeV2` = `mergeMantineTheme(mergeMantineTheme(DEFAULT_THEME, theme), themeV2Override)` — keeps v1 combobox / modal z-index plumbing (#902) inside the v2 subtree.
2. `dsv2CssVariablesResolver` **composes over** `defaultCssVariablesResolver` (spread base, then add `--dsv2-*` and semantic `--mantine-color-body` / text overrides). A custom resolver **replaces** the default entirely if you forget to compose.
3. Nested `<MantineProvider cssVariablesSelector=".dsv2-scope">` wraps children in `<div className="dsv2-scope">`. Vars never attach to `:root`.

`theme.radius` is remapped in the v2 override so reused shells (`DataTable`, `PageSection` `Paper`) pick up v2 corners. `theme.spacing` is **not** remapped — net-new components use `--dsv2-space-*` / `DSV2_TOKENS.spacing` in CSS modules (accepted #916 gap).

## Component map

| Component                | Sidecar                                                                               | Notes                                 |
| ------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------- |
| `DesignSystemV2Provider` | [DesignSystemV2Provider.md](../../../src/app/components/v2/DesignSystemV2Provider.md) | Required wrapper for all v2 UI        |
| `Button`                 | [Button.md](../../../src/app/components/v2/Button.md)                                 | Includes dashed variant               |
| `Pill`                   | [Pill.md](../../../src/app/components/v2/Pill.md)                                     | `tone="semantic"` for band/mode fills |
| `OverrideField`          | [OverrideField.md](../../../src/app/components/v2/OverrideField.md)                   | Build override chrome                 |
| `MapPanel`               | [MapPanel.md](../../../src/app/components/v2/MapPanel.md)                             | Hatch placeholder                     |
| `AppShell`               | [AppShell.md](../../../src/app/components/v2/AppShell.md)                             | Top header bar (not a sidebar shell)  |
| `ContextualStrip`        | [ContextualStrip.md](../../../src/app/components/v2/ContextualStrip.md)               | Section sub-view pills under AppShell |
| `SectionNav`             | [SectionNav.md](../../../src/app/components/v2/SectionNav.md)                         | In-page section rail                  |
| `BottomTabBar`           | [BottomTabBar.md](../../../src/app/components/v2/BottomTabBar.md)                     | Mobile primary nav                    |
| `ShuttleList*`           | [ShuttleList.md](../../../src/app/components/v2/ShuttleList.md)                       | Reuses list-kit                       |

Barrel: `src/app/components/v2/index.ts`.

## Interactive demos

| Path                          | Contents                                            |
| ----------------------------- | --------------------------------------------------- |
| `/styleguide/v2`              | Index                                               |
| `/styleguide/v2/forms`        | Button, OverrideField                               |
| `/styleguide/v2/data-display` | Pill, DataTable re-skin, MapPanel                   |
| `/styleguide/v2/navigation`   | AppShell, ContextualStrip, SectionNav, BottomTabBar |
| `/styleguide/v2/patterns`     | ShuttleList family                                  |

## Progress tracking

Multi-PR epic — see:

- [design-system-v2-progress.md](design-system-v2-progress.md)
- [design-system-v2-outstanding.md](design-system-v2-outstanding.md)

## Related

- Epic [#915](https://github.com/pskillen/codeplug-studio/issues/915) · Foundations [#916](https://github.com/pskillen/codeplug-studio/issues/916) · Chrome [#917](https://github.com/pskillen/codeplug-studio/issues/917) · Milestone 2 [#495](https://github.com/pskillen/codeplug-studio/issues/495)
- [docs/reference/styleguide/](../../reference/styleguide/) — v1 UI interaction contract (still authoritative for list-kit roles)
- [app-shell/](../app-shell/) — live application chrome (v2 shell as of #917)
