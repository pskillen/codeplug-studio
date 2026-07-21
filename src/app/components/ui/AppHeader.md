# AppHeader

Primary app-shell header: mobile nav burger plus branded wordmark.

## Purpose

Gives every route a recognisable **Codeplug Studio** mark in the Mantine `AppShell` header, with accessible alt text and a home link. Replaces the previous plain-text title.

## Props

| Prop       | Type         | Default | Description                           |
| ---------- | ------------ | ------- | ------------------------------------- |
| `opened`   | `boolean`    | —       | Mobile navbar open state for `Burger` |
| `onToggle` | `() => void` | —       | Toggle mobile navbar                  |

## Usage

```tsx
<AppShell.Header>
  <AppHeader opened={opened} onToggle={toggle} />
</AppShell.Header>
```

## Behaviour

- Wordmark image: `/branding/studio-logo.svg` (dark-theme colours; app default is dark).
- Clicking the wordmark navigates to `/` (Projects).
- Favicon / browser chrome use `/branding/studio-icon.svg` from `index.html` — see [app-shell branding](../../../../docs/features/app-shell/README.md#branding).

## Related

- [AppLayout](../AppLayout/AppLayout.md)
- [docs/features/app-shell](../../../../docs/features/app-shell/README.md)
