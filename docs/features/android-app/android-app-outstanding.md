# Android App — Outstanding

Debt and follow-ups discovered during [Epic #747](https://github.com/pskillen/codeplug-studio/issues/747).

## Debt

| Item                                | Severity | Notes                                                                                                                         |
| ----------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Hardware USB-OTG R/W verification   | High     | #888 acceptance required a real radio read/write; only unit/mocks shipped. Re-verify on device before calling field MVP done. |
| Land #889 on `main`                 | High     | APK CI lived on `dev` / feature branch; Release attach + version wiring added in follow-up — merge PR.                        |
| Play Store AAB / listing            | End goal | [#890](https://github.com/pskillen/codeplug-studio/issues/890)                                                                |
| Capacitor 8 vs USB plugin peers     | Medium   | `.npmrc` `legacy-peer-deps=true` — prefer a Capacitor-8-compatible plugin fork when available                                 |
| External link interceptor coverage  | Low      | Only `target="_blank"` + http(s); docs previously overstated “all external hrefs”                                             |
| `versionCode` = `github.run_number` | Low      | Monotonic for CI; not SemVer-derived — fine for sideload; revisit for Play if needed                                          |

## Closed / fixed in verification pass

- Groovy `keyAlias` / `keyPassword` name collision breaking `assembleRelease`
- `secrets` in workflow `if:` (invalid GHA context)
- Missing app `res/xml/device_filter.xml` while manifest referenced `@xml/device_filter`
- Docs claiming Release Assets while workflow only uploaded artifacts
- Hardcoded `versionCode 1` / `versionName "1.0"`
