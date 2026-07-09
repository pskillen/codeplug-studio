# GoogleDriveConnectSection

Settings panel for Google Drive session status and disconnect.

## Purpose

Shows connection status, connected account email, reconnect when the session lapsed, and disconnect when connected.

OAuth connect happens from Drive action buttons in import/export and build export — Settings offers **Reconnect** when the session expired without requiring Disconnect first.

## Usage

```tsx
<PageSection title="Google Drive">
  <GoogleDriveConnectSection />
</PageSection>
```

## Behaviour

- When `VITE_GOOGLE_CLIENT_ID` is missing, shows a configuration warning.
- When disconnected, explains that **Open from Drive** / **Save to Drive** in the app trigger connect.
- When the session expired, shows **Reconnect** (no Disconnect detour required).
- When connected, shows account email and **Disconnect** (revokes token and clears session).

## Related

- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
- `GoogleDriveActionButton.tsx`
- `useDriveSession.ts` / `DriveSessionProvider.tsx`
