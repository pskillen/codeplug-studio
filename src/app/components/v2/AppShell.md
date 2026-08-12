# AppShell

Design-system primary header: brand logo, top-level tabs, project chip, avatar slot.

## Purpose

The **top** chrome bar from the Claude Design system — not a sidebar layout. Pair with `ContextualStrip` for Library sub-views and `BottomTabBar` on narrow viewports. Wired into live routes by [#917](https://github.com/pskillen/codeplug-studio/issues/917).

Brand uses the shipped product logo (`public/branding/studio-logo.svg`) rather than the design-kit’s three-line mark + text wordmark, which read as a burger control.

## Props

| Prop             | Type                    | Notes                                                             |
| ---------------- | ----------------------- | ----------------------------------------------------------------- |
| `tabs`           | `readonly string[]`     | Top-level sections                                                |
| `activeTab`      | `string`                | Selected tab label                                                |
| `onTabChange`    | `(tab: string) => void` | Tab click                                                         |
| `disabledTabs`   | `readonly string[]`     | Labels rendered disabled                                          |
| `showTabs`       | `boolean`               | Hide desktop tab row when `BottomTabBar` is active (default true) |
| `projectName`    | `string`                | Default `Untitled project`                                        |
| `onProjectClick` | `() => void`            | Makes the project chip a button (home / switch project)           |
| `onBrandClick`   | `() => void`            | Makes the logo a home button                                      |
| `rightExtra`     | `ReactNode`             | Injected before the avatar (Drive controls)                       |
| `avatar`         | `ReactNode`             | Replaces the default avatar square (overflow menu target)         |

## Usage

```tsx
<AppShell
  tabs={['Summary', 'Library', 'Tools', 'Export for radio', 'Help']}
  activeTab="Library"
  onTabChange={goToTab}
  projectName="Skywarn Repeaters"
  onProjectClick={() => navigate('/')}
  onBrandClick={() => navigate('/')}
  rightExtra={<SidebarDriveControls />}
  avatar={overflowMenu}
/>
<ContextualStrip items={['Channels', 'Zones']} active={sub} onChange={setSub} />
```

## Behaviour

- Desktop shows the tab row; mobile hides it via `showTabs={false}` and uses `BottomTabBar`.
- Must render inside `DesignSystemV2Provider`.
- Live demos: `/styleguide/navigation`

## Related

- [ContextualStrip.md](./ContextualStrip.md)
- [BottomTabBar.md](./BottomTabBar.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
- [docs/features/app-shell/README.md](../../../../docs/features/app-shell/README.md)
