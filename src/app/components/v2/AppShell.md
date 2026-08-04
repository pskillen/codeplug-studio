# AppShell

Design-system primary header: wordmark, top-level tabs, project chip, avatar slot.

## Purpose

The **top** chrome bar from the Claude Design system — not a sidebar layout. Pair with `ContextualStrip` for Library sub-views and `BottomTabBar` on narrow viewports. Real route wiring is [#917](https://github.com/pskillen/codeplug-studio/issues/917).

## Props

| Prop          | Type                    | Notes                                      |
| ------------- | ----------------------- | ------------------------------------------ |
| `tabs`        | `readonly string[]`     | Top-level sections                         |
| `activeTab`   | `string`                | Selected tab label                         |
| `onTabChange` | `(tab: string) => void` | Tab click                                  |
| `projectName` | `string`                | Default `Untitled project`                 |
| `rightExtra`  | `ReactNode`             | Injected before the avatar (Help/Settings) |

## Usage

```tsx
<AppShell
  tabs={['Summary', 'Library', 'Tools', 'Export for radio']}
  activeTab="Library"
  onTabChange={setTab}
  projectName="Skywarn Repeaters"
/>
<ContextualStrip items={['Channels', 'Zones']} active={sub} onChange={setSub} />
```

## Behaviour

- Narrow CSS hides the top tab row — rely on `BottomTabBar` for mobile primary nav.
- Must render inside `DesignSystemV2Provider`.
- Live demos: `/styleguide/v2/navigation`

## Related

- [ContextualStrip.md](./ContextualStrip.md)
- [BottomTabBar.md](./BottomTabBar.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
