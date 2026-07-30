# Android Companion App

Capacitor-based Android shell for Codeplug Studio. Allows operators to carry their library on a phone and program radios over USB-OTG.

## Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| Scaffold | In progress | Capacitor core + Android platform (#886) |
| API Proxy | Deferred | CORS and absolute URL handling (#887) |
| USB Serial | Deferred | BytePipe implementation (#888) |
| APK CI | Deferred | GitHub Actions build (#889) |

## Documentation map

| Doc | Purpose |
| --- | --- |
| [android-app-progress.md](android-app-progress.md) | Execution log for Epic #747 |
| [android-app-outstanding.md](android-app-outstanding.md) | Discovered debt and follow-ups |

## Concepts

- **Capacitor Shell:** The app is a thin wrapper around the same Vite SPA used in the browser.
- **USB-OTG:** Used for radio programming since Web Serial is unavailable in mobile browsers.

## Cross-links

- **Epic:** [codeplug-studio#747](https://github.com/pskillen/codeplug-studio/issues/747)
- **Current Phase:** [codeplug-studio#886](https://github.com/pskillen/codeplug-studio/issues/886)
