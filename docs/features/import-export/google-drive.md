# Google Drive import / export

Browse Google Drive folders, open native YAML projects, and save exports back to Drive — without leaving the Studio SPA.

**Tracking:** [#61](https://github.com/pskillen/codeplug-studio/issues/61) · [#62](https://github.com/pskillen/codeplug-studio/issues/62) · Epic [#35](https://github.com/pskillen/codeplug-studio/issues/35)

**Source:** `src/integrations/cloud/`, `src/app/components/import-export/`, Settings

## Privacy

OAuth access tokens and browse preferences stay in **browser localStorage** only. Codeplug Studio has no backend; tokens are never committed to the repo. The Debug page masks the Drive access token like the Mapbox token.

IndexedDB remains the **edit store**; Drive holds portable YAML interchange files only.

## localStorage keys

| Key                                    | Purpose                                  |
| -------------------------------------- | ---------------------------------------- |
| `codeplug-studio:drive:accessToken`    | OAuth bearer (masked in Debug)           |
| `codeplug-studio:drive:tokenExpiresAt` | Token expiry (epoch ms)                  |
| `codeplug-studio:drive:lastAccount`    | Connected Google account email           |
| `codeplug-studio:drive:lastFolderId`   | Last browsed folder id                   |
| `codeplug-studio:drive:lastFolderPath` | Breadcrumb path JSON `[{ id, name }, …]` |

## OAuth setup

1. Create a Google Cloud project and enable **Google Drive API**.
2. Create an **OAuth 2.0 Web client** with authorized JavaScript origins:
   - `http://localhost:5173` (local Vite)
   - `https://codeplug.mm9pdy.net` (prod)
   - `https://staging.codeplug.mm9pdy.net` (staging)
   - `https://next.codeplug.mm9pdy.net` (next)
   - `https://dev.codeplug.mm9pdy.net` (dev)
3. Copy the client id to `.env.local` as `VITE_GOOGLE_CLIENT_ID` (see [build README](../../build/README.md)).

### Production and pre-production (Cloudflare Pages)

Release and pre-release builds receive `VITE_GOOGLE_CLIENT_ID` from the repo Actions secret `GOOGLE_OAUTH_CLIENT_ID` (see [cloudflare-pages.yaml](../../../.github/workflows/cloudflare-pages.yaml)). Without it, the deployed SPA shows “not configured” on Settings → Google Drive. Authorized JavaScript origins must include the hostnames listed above.

## OAuth scope

`https://www.googleapis.com/auth/drive` — list folders, create folders, read/write native YAML files the operator selects.

## Port API (`GoogleDrivePort`)

| Method                                                | Purpose                                              |
| ----------------------------------------------------- | ---------------------------------------------------- |
| `connect()`                                           | GIS OAuth token flow; stores session in localStorage |
| `disconnect()`                                        | Revoke token + clear session                         |
| `isConnected()`                                       | Session present and not expired                      |
| `getAccountLabel()`                                   | Connected Google account email                       |
| `listChildren(parentId)`                              | Folders + `.yaml` / `.yml` files                     |
| `createFolder(parentId, name)`                        | New folder in parent                                 |
| `readFile(fileId)`                                    | Download file text                                   |
| `writeFile({ parentId, fileName, content, fileId? })` | Create or overwrite YAML                             |
| `getFileMetadata(fileId)`                             | Name, parents, modified time                         |

Implementation: `src/integrations/cloud/googleDrive.ts`.

## UI flows

### Settings — status and disconnect

`/settings` → **Google Drive** section (`GoogleDriveConnectSection`):

- Shows connection status and account email
- **Disconnect** revokes the token and clears the session
- When disconnected, copy points operators to **Open from Drive** / **Save to Drive** in the app (connect happens there, not in Settings)
- When `VITE_GOOGLE_CLIENT_ID` is unset, shows OAuth setup guidance

### Drive browser modal

`DriveBrowserModal` — opened from import/export panels:

- Breadcrumb navigation from **My Drive** or last-used / project-remembered folder
- Lists subfolders and `.yaml` / `.yml` files
- **Create folder** in the current directory
- Persists browse path to localStorage on navigation

| Mode   | Trigger         | Result                                                |
| ------ | --------------- | ----------------------------------------------------- |
| `open` | Open from Drive | Reads file → `importProjectFromYaml`                  |
| `save` | Save to Drive   | Picks folder + filename → upload + record destination |

### Export workflow

`/import-export` → **Save to Drive** (`ExportToDrivePanel`):

1. Opens browser at `ProjectMeta.interchange.googleDrive.folderId` or browse prefs
2. Pre-fills filename from `suggestExportDestination(meta, 'googleDrive')`
3. If a same-named YAML exists in the folder → **overwrite confirm** modal
4. On success: writes file, records `ProjectMeta.interchange.googleDrive`, refreshes browse prefs

### Import workflow

- **Home** import panel and **Import / export** replace panel: **Open from Drive** (`GoogleDriveActionButton`) → select YAML → existing create/replace confirm flow

When Drive is not connected, the button stays visible (greyed). Click runs GIS OAuth, then opens the Drive browser on success.

When OAuth is not configured, click opens `GoogleDriveNotConfiguredModal` with **Go to Settings**.

## Components

| Component                       | Role                                                      |
| ------------------------------- | --------------------------------------------------------- |
| `GoogleDriveButton`             | Presentational CTA styling                                |
| `GoogleDriveActionButton`       | Open/save CTAs — inline connect, then Drive browser       |
| `GoogleDriveNotConfiguredModal` | Settings redirect when `VITE_GOOGLE_CLIENT_ID` is missing |
| `DriveBrowserModal`             | Folder browser when connected                             |

## Error states

| Situation             | UI behaviour                                                               |
| --------------------- | -------------------------------------------------------------------------- |
| Not configured        | Drive action buttons greyed; click → modal → Settings (OAuth client setup) |
| Not connected         | Drive action buttons greyed; click → GIS OAuth → Drive browser on success  |
| Sign-in cancelled     | No browser open; no error alert                                            |
| Connect failed        | Inline red alert on the action button                                      |
| Auth expired          | Treated as not connected — same inline connect on next Drive button click  |
| Network / API failure | Red alert with Drive error message                                         |
| Duplicate folder name | Drive API conflict message                                                 |

## Implementation status

| Area                         | Status  | Notes                                                                                     |
| ---------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| OAuth + Drive API port       | Shipped | [#61](https://github.com/pskillen/codeplug-studio/issues/61)                              |
| Settings status / disconnect | Shipped | [#62](https://github.com/pskillen/codeplug-studio/issues/62)                              |
| Drive browser modal          | Shipped | [#62](https://github.com/pskillen/codeplug-studio/issues/62)                              |
| Import / export workflow     | Shipped | [#62](https://github.com/pskillen/codeplug-studio/issues/62)                              |
| Disconnected Drive CTA UX    | Shipped | [#141](https://github.com/pskillen/codeplug-studio/issues/141) — inline connect on action |

## Manual verify checklist

- [ ] Disconnect in Settings with a real OAuth client
- [ ] Click **Open from Drive** while disconnected → GIS connect → browser opens
- [ ] Browse folders, create folder, path restored on reopen
- [ ] Open YAML from Drive → replace active project (or create on Home)
- [ ] Save to Drive → re-save defaults to last file; overwrite requires confirm
- [ ] Export YAML → import on fresh browser → `interchange.googleDrive` preserved in project meta
- [ ] Debug `/debug/local-storage` masks Drive access token

## Related

- [import-export/README.md](README.md) — interchange hub
- [native-yaml/README.md](native-yaml/README.md) — YAML format behaviour
- [operator-lifecycle.md](../workflows/operator-lifecycle.md) — end-to-end operator flow
