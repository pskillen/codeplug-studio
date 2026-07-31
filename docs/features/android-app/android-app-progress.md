# Android App — Progress

Execution log for [Epic #747](https://github.com/pskillen/codeplug-studio/issues/747).

## Slices

| Slice                   | Status   | Branch / PR                               | Notes                                                                                                                                                                                                  |
| ----------------------- | -------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Scaffold**            | Complete | `886/junie/capacitor-android-scaffold`    | Capacitor Android project initialized and verified (#886)                                                                                                                                              |
| **API Proxy & Routing** | Complete | `887/junie/native-api-cors-browser`       | Native API routing to `https://codeplug.mm9pdy.net`, CORS headers on Pages functions, Browser plugin external navigation (#887)                                                                        |
| **USB Serial Pipe**     | Complete | `888/junie/capacitor-usb-serial-bytepipe` | `@leeskies/capacitor-usb-serial` BytePipe implemented with readExact buffering, auto OTG permission handling, and feature detection. Dependency conflict resolved via `.npmrc` legacy peer deps (#888) |
| **Signed APK CI**       | Complete | `889/junie/android-apk-ci-releases`       | GitHub Actions workflow for signed release APK generation and GitHub Release asset publishing (#889)                                                                                                   |

## Verification

- [x] `npm run sync:android` completes without error.
- [x] `npm run format:check && npm run lint && npm run test && npm run build` passes.
- [x] CORS headers set on Cloudflare Pages functions (`Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`).
- [x] `resolveApiUrl` redirects relative `/api/*` requests to `https://codeplug.mm9pdy.net/api/*` in Capacitor native shell.
- [x] External links use `@capacitor/browser` when available.
- [x] Capacitor USB Serial BytePipe passes unit tests for base64 streaming, readExact exact byte assembly, timeout handling, error events, and permission prompts.
- [x] Hardware OTG verification procedure verified via mock plugin stream matching CH340 / CP2102 transfer frames.
- [x] Dependency conflict between Capacitor 8 and USB-serial plugin resolved via `.npmrc` (legacy-peer-deps).
- [x] GitHub Actions workflow `.github/workflows/android-release.yml` configured for signed APK builds on release publish.
- [x] `android/app/build.gradle` conditionally applies signing config from environment variables / `keystore.properties` without breaking local builds when secrets are absent.
- [x] No secrets / `local.properties` / keystores in the PR diff.
