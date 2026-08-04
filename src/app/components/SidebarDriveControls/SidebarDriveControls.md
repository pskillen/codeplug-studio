# SidebarDriveControls

Drive save and remote-check icon buttons for interchange — sidebar stack or compact header cluster.

## Purpose

Compact interchange controls for linked Google Drive projects: **Save to Drive** and **Check Drive**, with click-to-reconnect when the OAuth session has expired (no separate Reconnect button).

## Props

| Prop      | Type                    | Notes                                                                     |
| --------- | ----------------------- | ------------------------------------------------------------------------- |
| `variant` | `'sidebar' \| 'header'` | `header` = icon cluster for AppShell `rightExtra` (default `sidebar`) |

## Usage

```tsx
<DriveRefreshProvider>
  <SidebarDriveControls variant="header" />
</DriveRefreshProvider>
```

## Behaviour

| State                                     | UI                                                                                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Linked Drive + dirty                      | Save enabled                                                                                                                                    |
| Linked Drive + clean                      | Save disabled                                                                                                                                   |
| Session expired                           | Sidebar: `SoftWarning` + buttons; header: icon buttons only                                                                                     |
| Check Drive                               | Runs manual remote-newer check via `useDriveRefresh().checkNow()`; failures show inline in red below the buttons (sidebar only)                 |
| Local file only                           | Export YAML link to `/summary` (sidebar only)                                                                                                   |
| No portable destination + prior Drive use | `BrowserOnlyWarning` (dismissible, sidebar only)                                                                                                |
| Never connected Drive                     | Cluster hidden unless project has Drive/local interchange                                                                                       |

## Related

- [DriveRefreshProvider.tsx](../ProjectInterchangeBar/DriveRefreshProvider.tsx)
- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
- [app-shell/README.md](../../../../docs/features/app-shell/README.md)
