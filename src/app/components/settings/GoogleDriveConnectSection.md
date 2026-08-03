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

- Always states, before connecting, that Drive access is the `drive.file` scope scoped to Studio's own "Codeplug Studio" folder, not the rest of the operator's Drive — Google OAuth verification's "prominently displayed" in-product disclosure requirement.
- When `VITE_GOOGLE_CLIENT_ID` (web) or `VITE_GOOGLE_ANDROID_CLIENT_ID` (Android APK) is missing, shows a configuration warning.
- OAuth tokens stay on this device only (web browser or Capacitor WebView).
- When disconnected, explains that **Open from Drive** / **Save to Drive** in the app trigger connect.
- When the session expired, shows **Reconnect** (no Disconnect detour required).
- When connected, shows account email and **Disconnect** (revokes token and clears session).

## Related

- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
- `GoogleDriveActionButton.tsx`
- `useDriveSession.ts` / `DriveSessionProvider.tsx`
