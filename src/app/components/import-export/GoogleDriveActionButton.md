# GoogleDriveActionButton

Drive file-action CTA with connection gating — wraps `GoogleDriveButton` for open/save workflows.

## Purpose

When Google Drive is not connected, the button stays **visible and greyed** but remains clickable. Click runs GIS OAuth via `useGoogleDrive().connect()`, then calls the parent `onClick` (typically opening `DriveBrowserModal`) on success.

When OAuth is not configured (`!VITE_GOOGLE_CLIENT_ID`), click opens `GoogleDriveNotConfiguredModal` with a link to **Settings → Google Drive**.

## Props

| Prop       | Type                      | Notes                                                    |
| ---------- | ------------------------- | -------------------------------------------------------- |
| `onClick`  | `() => void`              | Runs when Drive is ready (after connect if needed)       |
| `disabled` | `boolean`                 | Blocks action (e.g. importing, no channels)              |
| `loading`  | `boolean`                 | Parent busy state; combined with OAuth loading on button |
| …          | `GoogleDriveButton` props | `children`, `styles`, etc.                               |

## Usage

```tsx
<GoogleDriveActionButton disabled={importing} onClick={() => setDriveOpen(true)}>
  Open from Drive
</GoogleDriveActionButton>
```

## Behaviour

- `driveReady = connected && isConfigured` from `useGoogleDrive`
- Not configured: click → `GoogleDriveNotConfiguredModal` → Settings
- Configured but not connected: click → `connect()` → parent `onClick` on success; cancelled sign-in is silent; other failures show inline `Alert`
- Ready: delegates `onClick` to parent immediately

## Related

- `GoogleDriveButton.tsx` — presentational CTA
- `GoogleDriveNotConfiguredModal.tsx`
- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
