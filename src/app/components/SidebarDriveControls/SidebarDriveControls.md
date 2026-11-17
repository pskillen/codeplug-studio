# SidebarDriveControls

Drive save and remote-check icon buttons in the AppShell `rightExtra` slot.

## Purpose

Compact interchange controls for linked Google Drive projects: **Save to Drive**, **Review changes to save** and **Check Drive**, with click-to-reconnect when the OAuth session has expired.

## Usage

```tsx
<DriveRefreshProvider>
  <AppShell rightExtra={<SidebarDriveControls />} … />
</DriveRefreshProvider>
```

## Behaviour

| State                | UI                                                          |
| -------------------- | ----------------------------------------------------------- |
| Linked Drive + dirty | Save and Review enabled                                     |
| Linked Drive + clean | Save and Review disabled                                    |
| Session expired      | Icons stay clickable for reauth (greyed when disconnected)  |
| No Drive link        | Cluster hidden (conflict/save modals still mount if needed) |

**Review changes to save** (compare icon, beside Save) reads the linked Drive file and opens `DriveOutgoingChangesModal` listing what saving would add to, change on or remove from it. It writes nothing; **Save** still saves immediately. A failed read shows a dismissible "Could not read Google Drive to review changes" notice (`ChromeDismissibleNotices`).

## Related

- [DriveRefreshProvider.tsx](../ProjectInterchangeBar/DriveRefreshProvider.tsx)
- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
- [app-shell/README.md](../../../../docs/features/app-shell/README.md)
