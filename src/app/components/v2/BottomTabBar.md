# BottomTabBar

Mobile primary navigation as a bottom tab strip.

## Purpose

Narrow-viewport primary nav for the v2 shell. Presentational in #916; wired to real routes in [#917](https://github.com/pskillen/codeplug-studio/issues/917).

## Props

| Prop       | Type                       | Notes                                   |
| ---------- | -------------------------- | --------------------------------------- |
| `items`    | `readonly BottomTabItem[]` | `id`, `label`, `icon`, optional `badge` |
| `activeId` | `string`                   | Matches an item `id`                    |
| `onChange` | `(id: string) => void`     | Tab selection callback                  |

## Usage

```tsx
<BottomTabBar
  items={[
    { id: 'library', label: 'Library', icon: <IconBooks size={ICON_SIZE_NAV} /> },
    { id: 'summary', label: 'Summary', icon: <IconChartBar size={ICON_SIZE_NAV} /> },
  ]}
  activeId="library"
  onChange={setActive}
/>
```

## Behaviour

- Active tab gets `aria-current="page"` and accent styling.
- Prefer `ICON_SIZE_NAV` / `ICON_STROKE` from `lib/iconSizes.ts` for icons.
- Must render inside `DesignSystemV2Provider`.
- Live `AppLayout` keeps this bar in the flex shell footer (viewport-locked on mobile); do not rely on `position: sticky` alone after scrolling page content.
- Live demos: `/styleguide/v2/navigation`

## Related

- [AppShell.md](./AppShell.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
