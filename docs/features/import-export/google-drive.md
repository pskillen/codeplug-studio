# Google Drive import / export

Browse Google Drive folders, open native YAML projects, and save exports back to Drive — without leaving the Studio SPA.

**Tracking:** [#61](https://github.com/pskillen/codeplug-studio/issues/61) · [#62](https://github.com/pskillen/codeplug-studio/issues/62) · [#285](https://github.com/pskillen/codeplug-studio/issues/285) · [#286](https://github.com/pskillen/codeplug-studio/issues/286) · Epic [#35](https://github.com/pskillen/codeplug-studio/issues/35)

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

### Settings — status, reconnect, and disconnect

`/settings` → **Google Drive** section (`GoogleDriveConnectSection`):

- Shows connection status and account email when the session is valid
- **Reconnect** when the OAuth session expired (no Disconnect detour required)
- **Disconnect** revokes the token and clears the session when connected
- When disconnected, copy points operators to **Open from Drive** / **Save to Drive** in the app
- When `VITE_GOOGLE_CLIENT_ID` is unset, shows OAuth setup guidance

### App chrome — portable interchange bar

`ProjectInterchangeBar` (above route content in `AppLayout`):

- Shows **Google Drive · {fileName}** or **Local file · {fileName}** from `ProjectMeta.interchange`
- **Save to Drive** — enabled when local edits are newer than the last portable sync; overwrites the remembered Drive file
- Dismissible **browser-only** warning when the project has no interchange destination
- `RefreshFromDriveBanner` — non-blocking prompt when Drive `modifiedTime` is newer than local `exportedAt`

### Session lifecycle (#286)

`DriveSessionProvider` is the single source of truth for OAuth state:

- Revalidates on window focus and before token expiry
- `withDriveAuthRetry` clears stale sessions on 401 and reconnects inline
- `DriveSessionBanner` prompts reconnect app-wide when the session lapsed

### Drive browser modal

`DriveBrowserModal` — opened from import/export panels:

- Breadcrumb navigation from **My Drive** or last-used / project-remembered folder
- Lists subfolders and `.yaml` / `.yml` files
- **Create folder** in the current directory
- Persists browse path to localStorage on navigation

| Mode   | Trigger         | Result                                                                             |
| ------ | --------------- | ---------------------------------------------------------------------------------- |
| `open` | Open from Drive | Reads file → YAML import resolver (create, overwrite with diff, or replace active) |
| `save` | Save to Drive   | Picks folder + filename → upload + record destination                              |

### Export workflow

`/import-export` → **Save to Drive** (`ExportToDrivePanel`):

1. Opens browser at `ProjectMeta.interchange.googleDrive.folderId` or browse prefs
2. Pre-fills filename from `suggestExportDestination(meta, 'googleDrive')`
3. If a same-named YAML exists in the folder → **overwrite confirm** modal
4. On success: writes file, records `ProjectMeta.interchange.googleDrive`, refreshes browse prefs

### Import workflow

- **Home** and **Import / export** panels: **Open from Drive** → select YAML
- If YAML `project.id` matches an existing IndexedDB project → **overwrite** modal with diff (last saved, entity counts)
- Otherwise Home uses `createNew`; replace panel requires matching active project id
- Successful import records `ProjectMeta.interchange` (import source memory)

When Drive is not connected, the button stays visible (greyed). Click runs GIS OAuth, then opens the Drive browser on success.

When OAuth is not configured, click opens `GoogleDriveNotConfiguredModal` with **Go to Settings**.

## Components

| Component                       | Role                                                      |
| ------------------------------- | --------------------------------------------------------- |
| `GoogleDriveButton`             | Presentational CTA styling                                |
| `GoogleDriveActionButton`       | Open/save CTAs — inline connect, then Drive browser       |
| `GoogleDriveNotConfiguredModal` | Settings redirect when `VITE_GOOGLE_CLIENT_ID` is missing |
| `DriveBrowserModal`             | Folder browser when connected                             |
| `DriveSessionBanner`            | App-wide reconnect prompt when session expired            |
| `ProjectInterchangeBar`         | Source label + Save to Drive in app chrome                |
| `RefreshFromDriveBanner`        | Newer remote YAML available — optional refresh            |
| `InterchangeOverwriteModal`     | Overwrite / adopt-remote with diff summary                |

## Error states

| Situation             | UI behaviour                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Not configured        | Drive action buttons greyed; click → modal → Settings (OAuth client setup)                                                        |
| Not connected         | Drive action buttons greyed; click → GIS OAuth → Drive browser on success                                                         |
| Sign-in cancelled     | No browser open; no error alert                                                                                                   |
| Connect failed        | Inline red alert on the action button                                                                                             |
| Auth expired          | Session cleared; greyed CTAs + **Reconnect** inline; `DriveSessionBanner`; Settings **Reconnect** — no manual Disconnect required |
| Network / API failure | Red alert with Drive error message                                                                                                |
| Duplicate folder name | Drive API conflict message                                                                                                        |
| Refresh project id mismatch | Yellow **Drive file project mismatch** banner; modal offers **Replace local content** (adopt remote into local id) or **Import as new project** ([#334](https://github.com/pskillen/codeplug-studio/issues/334)) |
| Refresh import failure | Red alert in overwrite modal; modal stays open ([#334](https://github.com/pskillen/codeplug-studio/issues/334))                  |

## Implementation status

| Area                         | Status  | Notes                                                                                     |
| ---------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| OAuth + Drive API port       | Shipped | [#61](https://github.com/pskillen/codeplug-studio/issues/61)                              |
| Settings status / disconnect | Shipped | [#62](https://github.com/pskillen/codeplug-studio/issues/62)                              |
| Drive browser modal          | Shipped | [#62](https://github.com/pskillen/codeplug-studio/issues/62)                              |
| Import / export workflow     | Shipped | [#62](https://github.com/pskillen/codeplug-studio/issues/62)                              |
| Disconnected Drive CTA UX    | Shipped | [#141](https://github.com/pskillen/codeplug-studio/issues/141) — inline connect on action |
| Shared session + reconnect   | Shipped | [#286](https://github.com/pskillen/codeplug-studio/issues/286)                            |
| App chrome Save bar          | Shipped | [#285](https://github.com/pskillen/codeplug-studio/issues/285)                            |
| UUID-match import overwrite  | Shipped | [#285](https://github.com/pskillen/codeplug-studio/issues/285)                            |
| Refresh from Drive prompt    | Shipped | [#285](https://github.com/pskillen/codeplug-studio/issues/285)                            |
| Refresh id-mismatch override | Shipped | [#334](https://github.com/pskillen/codeplug-studio/issues/334)                            |

## Manual verify checklist

- [ ] Disconnect in Settings with a real OAuth client
- [ ] Click **Open from Drive** while disconnected → GIS connect → browser opens
- [ ] Browse folders, create folder, path restored on reopen
- [ ] Token expiry greys Drive CTAs without page reload; **Reconnect** restores save/browse
- [ ] **Save to Drive** in app chrome overwrites remembered file when project is dirty
- [ ] Open YAML from Drive with matching `project.id` → diff modal → overwrite local
- [ ] Switch project with newer Drive file → **Refresh from Drive** banner
- [ ] Linked Drive file with mismatched `project.id` → mismatch banner → adopt or import as new
- [ ] Failed refresh import → error shown in modal (not console-only)
- [ ] Save to Drive → re-save defaults to last file; overwrite requires confirm
- [ ] Export YAML → import on fresh browser → `interchange.googleDrive` preserved in project meta
- [ ] Debug `/debug/local-storage` masks Drive access token

## Related

- [import-export/README.md](README.md) — interchange hub
- [native-yaml/README.md](native-yaml/README.md) — YAML format behaviour
- [operator-lifecycle.md](../workflows/operator-lifecycle.md) — end-to-end operator flow
