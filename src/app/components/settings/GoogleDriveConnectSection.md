# GoogleDriveConnectSection

Settings panel for Google Drive session status and disconnect.

## Purpose

Shows connection status, connected account email, and disconnect. OAuth connect happens from Drive action buttons in import/export and build export — not from Settings.

## Usage

```tsx
<PageSection title="Google Drive">
  <GoogleDriveConnectSection />
</PageSection>
```

## Behaviour

- When `VITE_GOOGLE_CLIENT_ID` is missing, shows a configuration warning.
- When disconnected, explains that **Open from Drive** / **Save to Drive** in the app trigger connect.
- When connected, shows account email and **Disconnect** (revokes token and clears session).

## Related

- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
- `GoogleDriveActionButton.tsx`
- `src/app/hooks/useGoogleDrive.ts`
