# GoogleDriveConnectSection

Settings panel for Google Drive OAuth connect / disconnect.

## Purpose

Shows connection status, connected account email, and connect/disconnect actions. Delegates to `useGoogleDrive` and `GoogleDrivePort`.

## Usage

```tsx
<PageSection title="Google Drive">
  <GoogleDriveConnectSection />
</PageSection>
```

## Behaviour

- When `VITE_GOOGLE_CLIENT_ID` is missing, shows a configuration warning and disables Connect.
- On connect, opens GIS OAuth and stores the token in localStorage.
- On disconnect, revokes the token and clears the session.

## Related

- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
- `src/app/hooks/useGoogleDrive.ts`
