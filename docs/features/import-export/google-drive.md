# Google Drive import / export

Browse Google Drive folders, open native YAML projects, and save exports back to Drive — without leaving the Studio SPA.

**Tracking:** [#61](https://github.com/pskillen/codeplug-studio/issues/61) · [#62](https://github.com/pskillen/codeplug-studio/issues/62) · Epic [#35](https://github.com/pskillen/codeplug-studio/issues/35)

**Source:** `src/integrations/cloud/`, `src/app/components/import-export/`, Settings

## Privacy

OAuth access tokens and browse preferences stay in **browser localStorage** only. Codeplug Studio has no backend; tokens are never committed to the repo. The Debug page masks the Drive access token like the Mapbox token.

IndexedDB remains the **edit store**; Drive holds portable YAML interchange files only.

## localStorage keys

| Key | Purpose |
| --- | --- |
| `codeplug-studio:drive:accessToken` | OAuth bearer (masked in Debug) |
| `codeplug-studio:drive:tokenExpiresAt` | Token expiry (epoch ms) |
| `codeplug-studio:drive:lastAccount` | Connected Google account email |
| `codeplug-studio:drive:lastFolderId` | Last browsed folder id |
| `codeplug-studio:drive:lastFolderPath` | Breadcrumb path JSON `[{ id, name }, …]` |

## Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| OAuth + Drive API port | In progress | `GoogleDrivePort` — [#61](https://github.com/pskillen/codeplug-studio/issues/61) |
| Settings connect / disconnect | Planned | [#62](https://github.com/pskillen/codeplug-studio/issues/62) |
| Drive browser modal | Planned | [#62](https://github.com/pskillen/codeplug-studio/issues/62) |
| Import / export workflow | Planned | [#62](https://github.com/pskillen/codeplug-studio/issues/62) |

## Related

- [import-export/README.md](README.md) — interchange hub
- [native-yaml/README.md](native-yaml/README.md) — YAML format behaviour
- [operator-lifecycle.md](../workflows/operator-lifecycle.md) — end-to-end operator flow
