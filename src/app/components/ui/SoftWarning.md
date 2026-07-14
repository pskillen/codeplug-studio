# SoftWarning

Theme-aware compact warning panel for sidebar and dense chrome.

## Purpose

Non-blocking notices that sit better on the dark `AppShell` than Mantine `Alert variant="light"` (which targets light surfaces). Uses translucent tint + border via `light-dark()`.

## Props

| Prop           | Type                    | Notes                         |
| -------------- | ----------------------- | ----------------------------- |
| `tone`         | `'warning' \| 'danger'` | Default `warning` (amber)     |
| `title`        | `string`                | Optional short heading        |
| `children`     | `ReactNode`             | Body copy or nested controls  |
| `onDismiss`    | `() => void`            | Shows close button when set   |
| `dismissLabel` | `string`                | `aria-label` for close button |

## Usage

```tsx
<SoftWarning title="Browser-only backup" onDismiss={() => setDismissed(true)}>
  This project is only stored in this browser — export YAML to back up.
</SoftWarning>

<SoftWarning tone="danger">
  Session expired — click Save or Check to reconnect.
</SoftWarning>
```

## Behaviour

- `warning` — amber tint (backup nudges, soft notices)
- `danger` — red tint (Drive session expired beside sidebar controls)
- Live demos: `/styleguide` → **SoftWarning**

## Related

- [alerts.md](../../../../docs/features/app-shell/alerts.md)
- [StyleguidePage.tsx](../../../routes/StyleguidePage.tsx)
