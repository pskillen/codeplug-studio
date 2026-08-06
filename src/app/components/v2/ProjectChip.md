# ProjectChip (v2)

**Purpose:** mk2 S2 combined project identity control — project name, calm status dot/label, chevron indicating the S3 quick switcher. Distinct from Drive Save/Check icons in `rightExtra`.

## Props

| Prop          | Type             | Default   | Description                                  |
| ------------- | ---------------- | --------- | -------------------------------------------- |
| `name`        | `string`         | —         | Project name or `Projects` when none open    |
| `statusTone`  | `StatusDotTone`  | `success` | Dot colour for save/sync state               |
| `statusLabel` | `string \| null` | `null`    | Secondary label; omitted when saved & synced |
| `compact`     | `boolean`        | `false`   | Mobile: dot + chevron only                   |
| `onClick`     | `() => void`     | —         | Opens quick project switcher                 |

## Usage

```tsx
<ProjectChip
  name="Skywarn Repeaters"
  statusTone="warning"
  statusLabel="Google Drive update"
  onClick={() => setSwitcherOpen(true)}
  aria-expanded={switcherOpen}
  aria-haspopup="dialog"
/>
```

## Behaviour

- Warning tone for Drive drift and session expiry — never destructive red.
- `useProjectChipStatus` in `src/app/hooks/` derives tone/label from dirty, saving, and Drive refresh state.

## Related

- [AppShell](./AppShell.md)
- [QuickProjectSwitcher](../shell/QuickProjectSwitcher.md)
- [app-shell feature hub](../../../../docs/features/app-shell/README.md)
