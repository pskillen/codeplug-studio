# DriveSessionBanner

Non-blocking app-wide banner when the Google Drive OAuth session has expired.

## Purpose

Prompts the operator to reconnect without visiting Settings. Shown in `AppLayout` above route content when `sessionExpired` is true and Drive is not connected.

## Usage

```tsx
<DriveSessionBanner />
```

## Behaviour

- Renders nothing when Drive is connected or the session has not lapsed.
- **Reconnect** runs `useDriveSession().connect()` (GIS silent re-auth when possible).

## Related

- `DriveSessionProvider.tsx`
- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
