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

## OAuth setup

1. Create a Google Cloud project and enable **Google Drive API**.
2. Create an **OAuth 2.0 Web client** with authorized JavaScript origins:
   - `http://localhost:5173` (local Vite)
   - `https://<user>.github.io` (GitHub Pages)
3. Copy the client id to `.env.local` as `VITE_GOOGLE_CLIENT_ID` (see [build README](../../build/README.md)).

## OAuth scope

`https://www.googleapis.com/auth/drive` — list folders, create folders, read/write native YAML files the operator selects.

## Port API (`GoogleDrivePort`)

| Method | Purpose |
| --- | --- |
| `connect()` | GIS OAuth token flow; stores session in localStorage |
| `disconnect()` | Revoke token + clear session |
| `isConnected()` | Session present and not expired |
| `getAccountLabel()` | Connected Google account email |
| `listChildren(parentId)` | Folders + `.yaml` / `.yml` files |
| `createFolder(parentId, name)` | New folder in parent |
| `readFile(fileId)` | Download file text |
| `writeFile({ parentId, fileName, content, fileId? })` | Create or overwrite YAML |
| `getFileMetadata(fileId)` | Name, parents, modified time |

Implementation: `src/integrations/cloud/googleDrive.ts`.

## UI flows

### Settings — connect / disconnect

`/settings` → **Google Drive** section (`GoogleDriveConnectSection`):

- Shows connection status and account email
- **Connect** opens GIS OAuth (disabled when `VITE_GOOGLE_CLIENT_ID` is unset)
- **Disconnect** revokes the token and clears the session

### Drive browser modal

`DriveBrowserModal` — opened from import/export panels:

- Breadcrumb navigation from **My Drive** or last-used / project-remembered folder
- Lists subfolders and `.yaml` / `.yml` files
- **Create folder** in the current directory
- Persists browse path to localStorage on navigation

| Mode | Trigger | Result |
| --- | --- | --- |
| `open` | Open from Drive | Reads file → `importProjectFromYaml` |
| `save` | Save to Drive | Picks folder + filename → upload + record destination |

### Export workflow

`/import-export` → **Save to Drive** (`ExportToDrivePanel`):

1. Opens browser at `ProjectMeta.interchange.googleDrive.folderId` or browse prefs
2. Pre-fills filename from `suggestExportDestination(meta, 'googleDrive')`
3. If a same-named YAML exists in the folder → **overwrite confirm** modal
4. On success: writes file, records `ProjectMeta.interchange.googleDrive`, refreshes browse prefs

### Import workflow

- **Home** import panel and **Import / export** replace panel: **Open from Drive** → select YAML → existing create/replace confirm flow

## Error states

| Situation | UI behaviour |
| --- | --- |
| Not configured | Yellow alert — missing `VITE_GOOGLE_CLIENT_ID` |
| Not connected | Prompt to connect in Settings |
| Auth expired | Error alert + reconnect hint |
| Sign-in cancelled | Non-destructive message |
| Network / API failure | Red alert with Drive error message |
| Duplicate folder name | Drive API conflict message |

## Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| OAuth + Drive API port | Shipped | [#61](https://github.com/pskillen/codeplug-studio/issues/61) |
| Settings connect / disconnect | Shipped | [#62](https://github.com/pskillen/codeplug-studio/issues/62) |
| Drive browser modal | Shipped | [#62](https://github.com/pskillen/codeplug-studio/issues/62) |
| Import / export workflow | Shipped | [#62](https://github.com/pskillen/codeplug-studio/issues/62) |

## Manual verify checklist

- [ ] Connect / disconnect in Settings with a real OAuth client
- [ ] Browse folders, create folder, path restored on reopen
- [ ] Open YAML from Drive → replace active project (or create on Home)
- [ ] Save to Drive → re-save defaults to last file; overwrite requires confirm
- [ ] Export YAML → import on fresh browser → `interchange.googleDrive` preserved in project meta
- [ ] Debug `/debug/local-storage` masks Drive access token

## Related

- [import-export/README.md](README.md) — interchange hub
- [native-yaml/README.md](native-yaml/README.md) — YAML format behaviour
- [operator-lifecycle.md](../workflows/operator-lifecycle.md) — end-to-end operator flow
