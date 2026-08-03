# Android App — Progress

Execution log for [Epic #747](https://github.com/pskillen/codeplug-studio/issues/747).

## Slices

| Slice               | Status      | Branch / PR                    | Notes                                                                          |
| ------------------- | ----------- | ------------------------------ | ------------------------------------------------------------------------------ |
| Scaffold            | Complete    | PR #891 (`886/…`)              | Capacitor Android shell (#886)                                                 |
| API Proxy & Routing | Complete    | PR #892 (`887/…`)              | Absolute API base, CORS allowlist, Browser (#887)                              |
| USB Serial Pipe     | Complete\*  | PR #893 (`888/…`)              | Capacitor `BytePipe` + feature detect (#888). \*Hardware OTG still outstanding |
| Signed APK CI       | Complete    | PR #889                        | Workflow + signing + Release attach + versionName/Code (#889)                  |
| Native Drive OAuth  | In progress | `895/pskil/native-drive-oauth` | PKCE + Custom Tabs + deep link (#895); on-device verify pending                |
| Play Store          | Deferred    | —                              | #890                                                                           |

## Verification

### Done

- [x] `npm run sync:android` / format / lint / test / build (as of phase PRs)
- [x] CORS allowlist in `functions/lib/codeplugOrigin.ts` mirrors Capacitor origins (not `*`)
- [x] `resolveApiUrl` picks native API origin from `BUILD_ENV` (`prod` → apex; else staging) (#899)
- [x] External `_blank` http(s) links via `@capacitor/browser`
- [x] Capacitor USB Serial `BytePipe` unit tests (`readExact`, timeouts, etc.)
- [x] `.npmrc` legacy-peer-deps for Cap 8 + USB plugin
- [x] Signing config without Groovy `keyAlias` collision
- [x] Workflow maps secrets via job `env` (not `if: secrets…`)
- [x] App `device_filter.xml` committed for USB auto-attach VIDs
- [x] Release event attaches `codeplug-studio-<version>.apk` to the GitHub Release
- [x] `ANDROID_VERSION_NAME` / `ANDROID_VERSION_CODE` fed into `defaultConfig`
- [x] Native Drive OAuth code + unit tests (#895)

### Outstanding

- [ ] **#895 on-device:** connect/disconnect, background mid-consent, cold-start redirect, refresh, denied consent, open/save via Drive
- [ ] Hardware: physical Android + OTG + supported radio Read/Write
- [ ] Play Store (#890)
