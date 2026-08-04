# SidebarDriveControls

Drive save and remote-check icon buttons in the AppShell `rightExtra` slot.

## Purpose

Compact interchange controls for linked Google Drive projects: **Save to Drive** and **Check Drive**, with click-to-reconnect when the OAuth session has expired.

## Usage

```tsx
<DriveRefreshProvider>
  <AppShell rightExtra={<SidebarDriveControls />} … />
</DriveRefreshProvider>
```

## Behaviour

| State                | UI                                                          |
| -------------------- | ----------------------------------------------------------- |
| Linked Drive + dirty | Save enabled                                                |
| Linked Drive + clean | Save disabled                                               |
| Session expired      | Icons stay clickable for reauth (greyed when disconnected)  |
| No Drive link        | Cluster hidden (conflict/save modals still mount if needed) |

## Related

- [DriveRefreshProvider.tsx](../ProjectInterchangeBar/DriveRefreshProvider.tsx)
- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
- [app-shell/README.md](../../../../docs/features/app-shell/README.md)
