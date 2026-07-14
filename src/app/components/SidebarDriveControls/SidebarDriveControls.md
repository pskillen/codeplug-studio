# SidebarDriveControls

Drive save and remote-check icon buttons in the primary sidebar, below the active project header.

## Purpose

Compact interchange controls for linked Google Drive projects: **Save to Drive** and **Check Drive**, with click-to-reconnect when the OAuth session has expired (no separate Reconnect button).

## Usage

```tsx
<DriveRefreshProvider>
  <AppNav />
</DriveRefreshProvider>
```

Rendered inside `AppNav` below `ActiveProjectBar` when the project has a Drive link, local-file export link, or the operator has connected Drive on this browser before.

## Behaviour

| State                                     | UI                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| Linked Drive + dirty                      | Save enabled                                                                         |
| Linked Drive + clean                      | Save disabled                                                                        |
| Session expired                           | `SoftWarning` danger tone with greyed Save/Check; buttons still clickable for reauth |
| Check Drive                               | Runs manual remote-newer check via `useDriveRefresh().checkNow()`                    |
| Local file only                           | Export YAML link to `/import-export`                                                 |
| No portable destination + prior Drive use | `BrowserOnlyWarning` (dismissible)                                                   |
| Never connected Drive                     | Cluster hidden unless project has Drive/local interchange                            |

## Related

- [DriveRefreshProvider.tsx](../ProjectInterchangeBar/DriveRefreshProvider.tsx)
- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
- [app-shell/README.md](../../../../docs/features/app-shell/README.md)
