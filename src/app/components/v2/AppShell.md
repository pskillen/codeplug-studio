# AppShell

Presentational layout chrome for design-system v2 (header / nav / strip / main / bottom bar).

## Purpose

Demo and future live shell for v2 screens. Fixture-driven in foundations (#916); real route wiring is [#917](https://github.com/pskillen/codeplug-studio/issues/917).

## Props

| Prop              | Type        | Notes                                   |
| ----------------- | ----------- | --------------------------------------- |
| `header`          | `ReactNode` | Top brand / project strip               |
| `nav`             | `ReactNode` | Desktop side nav (hidden ≤640px)        |
| `contextualStrip` | `ReactNode` | Optional section strip under the header |
| `children`        | `ReactNode` | Main content                            |
| `bottomBar`       | `ReactNode` | Typically a `BottomTabBar` for mobile   |

## Usage

```tsx
<AppShell
  header={<strong>Codeplug Studio</strong>}
  nav={<nav>…</nav>}
  contextualStrip={<span>Channels</span>}
  bottomBar={<BottomTabBar items={tabs} activeId="library" />}
>
  Page body
</AppShell>
```

## Behaviour

- Narrow viewports hide the side `nav` and rely on `bottomBar`.
- Must render inside `DesignSystemV2Provider`.
- Live demos: `/styleguide/v2/navigation`

## Related

- [BottomTabBar.md](./BottomTabBar.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
