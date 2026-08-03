# Google Drive import / export

Open native YAML projects and save exports back to a Studio-owned Drive folder — without leaving the Studio SPA.

**Tracking:** [#61](https://github.com/pskillen/codeplug-studio/issues/61) · [#62](https://github.com/pskillen/codeplug-studio/issues/62) · [#285](https://github.com/pskillen/codeplug-studio/issues/285) · [#286](https://github.com/pskillen/codeplug-studio/issues/286) · [#361](https://github.com/pskillen/codeplug-studio/issues/361) · [#368](https://github.com/pskillen/codeplug-studio/issues/368) · [#477](https://github.com/pskillen/codeplug-studio/issues/477) · [#909](https://github.com/pskillen/codeplug-studio/issues/909) · Epic [#35](https://github.com/pskillen/codeplug-studio/issues/35)

**Source:** `src/integrations/cloud/`, `src/app/components/import-export/`, Settings

## Privacy

OAuth access tokens and browse preferences stay in **browser localStorage** only. Codeplug Studio has no backend; tokens are never committed to the repo. The Debug page masks the Drive access token like the Mapbox token.

IndexedDB remains the **edit store**; Drive holds portable YAML interchange files only.

## localStorage keys

| Key                                       | Purpose                                                          |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `codeplug-studio:drive:accessToken`       | OAuth bearer (masked in Debug)                                   |
| `codeplug-studio:drive:tokenExpiresAt`    | Token expiry (epoch ms)                                          |
| `codeplug-studio:drive:refreshToken`      | Native-only OAuth refresh token (masked)                         |
| `codeplug-studio:drive:pendingNativeAuth` | Ephemeral PKCE state (native OAuth only)                         |
| `codeplug-studio:drive:lastAccount`       | Connected Google account email                                   |
| `codeplug-studio:drive:lastFolderId`      | Last browsed folder id                                           |
| `codeplug-studio:drive:lastFolderPath`    | Breadcrumb path JSON `[{ id, name }, …]`                         |
| `codeplug-studio:drive:appRootFolderId`   | Resolved "Codeplug Studio" folder id, refreshed on every connect |

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

### Android Companion App (Capacitor native)

Native Android uses **PKCE authorization-code OAuth** in Chrome Custom Tabs — not GIS popups inside the WebView.

1. In the same Google Cloud project, create an **OAuth 2.0 Android client**:
   - Package name: `net.mm9pdy.codeplugstudio`
   - SHA-1: release signing certificate fingerprint (see [Android app hub](../android-app/README.md))
   - Enable **custom URI scheme** under Advanced settings (required for redirect `net.mm9pdy.codeplugstudio:/oauth2redirect`)
2. Copy the Android client id to `.env.local` as `VITE_GOOGLE_ANDROID_CLIENT_ID` for local APK builds.
3. CI APK builds receive `VITE_GOOGLE_ANDROID_CLIENT_ID` from the repo secret `ANDROID_GOOGLE_OAUTH_CLIENT_ID` (see [android-release.yaml](../../../.github/workflows/android-release.yaml)).

Flow: `connect()` opens Google's authorize URL in Custom Tabs → operator consents → redirect re-enters the app via `@capacitor/app` `appUrlOpen` (or cold-start `getLaunchUrl`) → code exchange → session in the same localStorage keys as web (plus optional `refreshToken` for silent refresh).

Implementation: `nativeGoogleAuth.ts`, `nativeAuthRedirect.ts`, `nativeGoogleDrive.ts` behind the shared `GoogleDrivePort`.

**Manual verify (Android APK):**

- [ ] Connect from Settings → Reconnect or Open/Save from Drive
- [ ] Background app mid-consent, resume — session completes
- [ ] Force-kill mid-consent, relaunch — cold-start redirect completes auth
- [ ] Disconnect / revoke
- [ ] Token expiry + silent refresh (wait or shorten expiry in test)
- [ ] Denied consent — no error storm; can retry

## OAuth scope

`https://www.googleapis.com/auth/drive.file` ([#909](https://github.com/pskillen/codeplug-studio/issues/909)) — access limited to files/folders Studio itself creates. Google classifies the previously-used full `drive` scope as **restricted** (annual third-party security assessment + submitted demo video before OAuth verification); `drive.file` is non-sensitive and verifies near-instantly.

### App-owned root folder

Because `drive.file` can't list arbitrary pre-existing Drive folders, Studio creates and manages its own **"Codeplug Studio"** folder in the operator's Drive on first connect (`resolveAppRootFolder` in `driveApi.ts`), and all browsing/open/save happens inside that folder — `DriveBrowserModal` cannot navigate above it. That grant is tied to the (Google account, OAuth client) pair rather than a single browser session, so reconnecting from a different device rediscovers the same folder (by name + mimetype query) instead of creating a duplicate.

Operators who want to open a YAML they didn't create via Studio need to move/copy it into the "Codeplug Studio" folder first using Drive's own UI — Studio's custom browser has no way to reach it otherwise (Picker-based access was considered and declined for this iteration; see [#909](https://github.com/pskillen/codeplug-studio/issues/909)).

## Port API (`GoogleDrivePort`)

| Method                                                | Purpose                                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `connect()`                                           | OAuth token flow (GIS on web; PKCE + Custom Tabs on Android); also resolves/creates the app root folder |
| `disconnect()`                                        | Revoke token + clear session                                                                            |
| `isConnected()`                                       | Session present and not expired                                                                         |
| `getAccountLabel()`                                   | Connected Google account email                                                                          |
| `getAppRootFolderId()`                                | Resolved "Codeplug Studio" folder id from the last connect                                              |
| `listChildren(parentId)`                              | Folders + `.yaml` / `.yml` files                                                                        |
| `createFolder(parentId, name)`                        | New folder in parent                                                                                    |
| `readFile(fileId)`                                    | Download file text                                                                                      |
| `writeFile({ parentId, fileName, content, fileId? })` | Create or overwrite YAML                                                                                |
| `getFileMetadata(fileId)`                             | Name, parents, modified time                                                                            |

Implementation: `src/integrations/cloud/googleDrive.ts`, `src/integrations/cloud/driveApi.ts`.

## UI flows

### Settings — status, reconnect, and disconnect

`/settings` → **Google Drive** section (`GoogleDriveConnectSection`):

- Shows connection status and account email when the session is valid
- **Reconnect** when the OAuth session expired (no Disconnect detour required)
- **Disconnect** revokes the token and clears the session when connected
- When disconnected, copy points operators to **Open from Drive** / **Save to Drive** in the app
- When `VITE_GOOGLE_CLIENT_ID` (web) or `VITE_GOOGLE_ANDROID_CLIENT_ID` (Android) is unset, shows OAuth setup guidance

### Primary sidebar — Drive controls ([#368](https://github.com/pskillen/codeplug-studio/issues/368))

`SidebarDriveControls` in `AppNav`, below the active project header:

- Shows **Google Drive · {fileName}** (or **Local file · {fileName}**) from `ProjectMeta.interchange`
- **Save to Drive** (floppy icon) — enabled when local edits are newer than the last portable sync; assesses linked file before overwrite ([#335](https://github.com/pskillen/codeplug-studio/issues/335))
- **Check Drive** (refresh icon) — manual remote-newer check; complements automatic check on project focus
- Dismissible **browser-only** warning when the project has no interchange destination **and** the operator has connected Drive on this browser before (`codeplug-studio:drive:lastAccount`)
- Session expiry: subtle red panel beside the buttons; **Save** or **Check** click runs reconnect — no separate Reconnect button; local editing continues

`RefreshFromDriveBanner` stays in main content when a newer remote copy is detected (automatic or manual check).

### Session lifecycle (#286)

`DriveSessionProvider` is the single source of truth for OAuth state:

- Revalidates on window focus and before token expiry
- `withDriveAuthRetry` clears stale sessions on 401 and reconnects inline
- Expired sessions show inline beside sidebar Drive controls; any Drive action button click reconnects

### Drive browser modal

`DriveBrowserModal` — opened from import/export panels:

- Breadcrumb navigation rooted at the app-owned **"Codeplug Studio"** folder (not "My Drive") or last-used / project-remembered folder within it
- Lists subfolders and `.yaml` / `.yml` files
- **Create folder** in the current directory
- Persists browse path to localStorage on navigation

| Mode   | Trigger         | Result                                                                             |
| ------ | --------------- | ---------------------------------------------------------------------------------- |
| `open` | Open from Drive | Reads file → YAML import resolver (create, overwrite with diff, or replace active) |
| `save` | Save to Drive   | Picks folder + filename → upload + record destination                              |

### Export workflow

`/summary` → **Project interchange** → **Save to Drive** (`ExportToDrivePanel`):

1. Opens browser at `ProjectMeta.interchange.googleDrive.folderId` or browse prefs
2. Pre-fills filename from `suggestExportDestination(meta, 'googleDrive')`
3. If a same-named YAML exists in the folder → **overwrite confirm** modal (filename only)
4. Before overwriting an existing file → **Drive save conflict** modal when remote is newer or `project.id` differs ([#335](https://github.com/pskillen/codeplug-studio/issues/335))
5. On success: writes file, records `ProjectMeta.interchange.googleDrive`, refreshes browse prefs

### Import workflow

- **Home** and **Summary** panels: **Open from Drive** → select YAML
- If YAML `project.id` matches an existing IndexedDB project → **overwrite** modal with a left/right **diff table** (**Last edited** / **Last Drive or file save**, all entity counts including APRS)
- If YAML `project.id` is **not** in IndexedDB → `seedPreservingId` — seeds with the YAML's portable id ([#361](https://github.com/pskillen/codeplug-studio/issues/361)); same for local file drop on Home
- **Import as new project** (refresh / mismatch modals only) → `createNew` — fresh UUID by explicit operator choice
- Replace-active panel requires matching active project id, or offers `adoptRemote` / import-as-new on mismatch ([#334](https://github.com/pskillen/codeplug-studio/issues/334))
- Successful import records `ProjectMeta.interchange` (import source memory) including `remoteProjectId` when opened from Drive

When Drive is not connected, the button stays visible (greyed). Click runs GIS OAuth, then opens the Drive browser on success.

When OAuth is not configured, click opens `GoogleDriveNotConfiguredModal` with **Go to Settings**.

## Components

| Component                       | Role                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `GoogleDriveButton`             | Presentational CTA styling                                                                                                  |
| `GoogleDriveActionButton`       | Open/save CTAs — inline connect, then Drive browser                                                                         |
| `GoogleDriveNotConfiguredModal` | Settings redirect when the platform client id env is missing                                                                |
| `DriveBrowserModal`             | Folder browser when connected                                                                                               |
| `SidebarDriveControls`          | Sidebar Save / Check Drive icon buttons ([#368](https://github.com/pskillen/codeplug-studio/issues/368))                    |
| `DriveRefreshProvider`          | Shared remote-check state for sidebar + refresh banner                                                                      |
| `RefreshFromDriveBanner`        | Newer remote YAML available — optional refresh                                                                              |
| `InterchangeOverwriteModal`     | Overwrite / adopt-remote with tabular local vs remote diff ([#477](https://github.com/pskillen/codeplug-studio/issues/477)) |
| `DriveSaveConflictModal`        | Pre-save conflict when remote is newer or id mismatches                                                                     |
| `ProjectSyncDiffTable`          | Shared Metric / Local / Remote / Δ table for overwrite and save conflict                                                    |

## Error states

| Situation                   | UI behaviour                                                                                                                                                                                                                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Not configured              | Drive action buttons greyed; click → modal → Settings (OAuth client setup)                                                                                                                                                                                                                   |
| Not connected               | Drive action buttons greyed; click → OAuth connect → Drive browser on success                                                                                                                                                                                                                |
| Sign-in cancelled           | No browser open; no error alert                                                                                                                                                                                                                                                              |
| Connect failed              | Inline red alert on the action button                                                                                                                                                                                                                                                        |
| Auth expired                | Session cleared; greyed sidebar Save/Check with inline hint; click either button to reconnect; Settings **Reconnect** — no manual Disconnect required                                                                                                                                        |
| Network / API failure       | Red alert with Drive error message                                                                                                                                                                                                                                                           |
| Duplicate folder name       | Drive API conflict message                                                                                                                                                                                                                                                                   |
| Refresh project id mismatch | Yellow **Drive file project mismatch** banner; modal offers **Replace local content** (adopt remote into local id) or **Import as new project** ([#334](https://github.com/pskillen/codeplug-studio/issues/334))                                                                             |
| Refresh import failure      | Red alert in overwrite modal; modal stays open ([#334](https://github.com/pskillen/codeplug-studio/issues/334))                                                                                                                                                                              |
| Save remote newer           | **Drive save conflict** modal before overwrite — **Refresh from Drive**, **Save anyway**, **Save as new file**, or Cancel ([#335](https://github.com/pskillen/codeplug-studio/issues/335))                                                                                                   |
| Save project id mismatch    | Same modal — shows local vs remote `project.id` and diff; no silent overwrite of another project's file ([#335](https://github.com/pskillen/codeplug-studio/issues/335))                                                                                                                     |
| Save failure                | Red alert in conflict modal or inline on the Save bar                                                                                                                                                                                                                                        |
| Drive scope error (403)     | A file/folder opened (not created) via Studio before the `drive.file` scope change is no longer reachable — actionable message via `driveErrorMessage`, surfaced in the browser modal, save flow, and sidebar "Check Drive" ([#909](https://github.com/pskillen/codeplug-studio/issues/909)) |

## Implementation status

| Area                              | Status  | Notes                                                                                                                                                                                |
| --------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OAuth + Drive API port            | Shipped | [#61](https://github.com/pskillen/codeplug-studio/issues/61)                                                                                                                         |
| Settings status / disconnect      | Shipped | [#62](https://github.com/pskillen/codeplug-studio/issues/62)                                                                                                                         |
| Drive browser modal               | Shipped | [#62](https://github.com/pskillen/codeplug-studio/issues/62)                                                                                                                         |
| Summary project interchange       | Shipped | [#62](https://github.com/pskillen/codeplug-studio/issues/62); YAML on Summary [#569](https://github.com/pskillen/codeplug-studio/issues/569)                                         |
| Disconnected Drive CTA UX         | Shipped | [#141](https://github.com/pskillen/codeplug-studio/issues/141) — inline connect on action                                                                                            |
| Shared session + reconnect        | Shipped | [#286](https://github.com/pskillen/codeplug-studio/issues/286)                                                                                                                       |
| App chrome Save bar               | Shipped | [#285](https://github.com/pskillen/codeplug-studio/issues/285)                                                                                                                       |
| UUID-match import overwrite       | Shipped | [#285](https://github.com/pskillen/codeplug-studio/issues/285)                                                                                                                       |
| Refresh from Drive prompt         | Shipped | [#285](https://github.com/pskillen/codeplug-studio/issues/285)                                                                                                                       |
| Refresh id-mismatch override      | Shipped | [#334](https://github.com/pskillen/codeplug-studio/issues/334)                                                                                                                       |
| Save conflict detection           | Shipped | [#335](https://github.com/pskillen/codeplug-studio/issues/335)                                                                                                                       |
| Tabular overwrite / conflict diff | Shipped | [#477](https://github.com/pskillen/codeplug-studio/issues/477) — full entity counts + timestamps                                                                                     |
| Portable project id on open       | Shipped | [#361](https://github.com/pskillen/codeplug-studio/issues/361) — `seedPreservingId` default                                                                                          |
| Sidebar Drive controls            | Shipped | [#368](https://github.com/pskillen/codeplug-studio/issues/368) — Save/Check in primary nav                                                                                           |
| Android native OAuth (PKCE)       | Shipped | [#895](https://github.com/pskillen/codeplug-studio/issues/895) — Custom Tabs + deep link; on-device verify pending                                                                   |
| `drive.file` scope narrowing      | Shipped | [#909](https://github.com/pskillen/codeplug-studio/issues/909) — app-owned "Codeplug Studio" root folder; cross-device rediscovery unverified against a real account (see checklist) |

## Manual verify checklist

- [ ] Disconnect in Settings with a real OAuth client
- [ ] Click **Open from Drive** while disconnected → GIS connect → browser opens
- [ ] Connect creates a **"Codeplug Studio"** folder in the real Drive account (check via drive.google.com)
- [ ] Browse folders (within the app root), create folder, path restored on reopen
- [ ] Connect from a **second browser profile/incognito** with the same Google account → the same "Codeplug Studio" folder is found, not duplicated ([#909](https://github.com/pskillen/codeplug-studio/issues/909) key risk)
- [ ] Token expiry greys sidebar Drive buttons without page reload; click Save or Check reconnects
- [ ] **Save to Drive** in sidebar overwrites remembered file when project is dirty
- [ ] **Check Drive** finds newer remote copy and shows refresh banner
- [ ] Open YAML from Drive on fresh browser (unknown UUID) → IndexedDB `project.id` matches YAML ([#361](https://github.com/pskillen/codeplug-studio/issues/361))
- [ ] Open YAML from Drive with matching `project.id` → tabular diff modal (all entity counts) → overwrite local
- [ ] Switch project with newer Drive file → **Refresh from Drive** banner
- [ ] Linked Drive file with mismatched `project.id` → mismatch banner → adopt or import as new
- [ ] Failed refresh import → error shown in modal (not console-only)
- [ ] Machine B saves → Machine A **Save to Drive** → conflict modal (not silent overwrite)
- [ ] Linked Drive file with mismatched `project.id` → **Save to Drive** → UUID mismatch warning before write
- [ ] Save to Drive → re-save defaults to last file; overwrite requires confirm
- [ ] Export YAML → import on fresh browser → `interchange.googleDrive` preserved in project meta
- [ ] Debug `/debug/local-storage` masks Drive access token

## Related

- [import-export/README.md](README.md) — interchange hub
- [native-yaml/README.md](native-yaml/README.md) — YAML format behaviour
- [operator-lifecycle.md](../workflows/operator-lifecycle.md) — end-to-end operator flow
