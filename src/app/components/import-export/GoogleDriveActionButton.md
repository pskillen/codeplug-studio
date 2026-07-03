# GoogleDriveActionButton

Drive file-action CTA with connection gating — wraps `GoogleDriveButton` for open/save workflows outside Settings.

## Purpose

When Google Drive is not connected (or OAuth is not configured), the button stays **visible and greyed** but remains clickable. Click opens `GoogleDriveConnectPromptModal` with a link to **Settings → Google Drive** instead of the Drive browser.

Use raw `GoogleDriveButton` on the Settings connect action itself.

## Props

| Prop       | Type                      | Notes                                                  |
| ---------- | ------------------------- | ------------------------------------------------------ |
| `onClick`  | `() => void`              | Runs when Drive is ready                               |
| `disabled` | `boolean`                 | Blocks action and prompt (e.g. importing, no channels) |
| `loading`  | `boolean`                 | Standard Mantine loading state                         |
| …          | `GoogleDriveButton` props | `children`, `styles`, etc.                             |

## Usage

```tsx
<GoogleDriveActionButton disabled={importing} onClick={() => setDriveOpen(true)}>
  Open from Drive
</GoogleDriveActionButton>
```

## Behaviour

- `driveReady = connected && isConfigured` from `useGoogleDrive`
- Not ready: reduced opacity; click → prompt modal → `/settings` with `scrollTo: settings-drive`
- Ready: delegates `onClick` to parent (opens `DriveBrowserModal`, etc.)

## Related

- `GoogleDriveButton.tsx` — presentational CTA
- `GoogleDriveConnectPromptModal.tsx`
- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
