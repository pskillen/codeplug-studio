# Android App — Outstanding

Debt and follow-ups discovered during [Epic #747](https://github.com/pskillen/codeplug-studio/issues/747).

## Debt

| Item                                | Severity | Notes                                                                                                                                                                                                                                                       |
| ----------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hardware USB-OTG R/W verification   | High     | #888 acceptance required a real radio read/write; only unit/mocks shipped. Re-verify on device before calling field MVP done.                                                                                                                               |
| Land #889 on `main`                 | High     | APK CI lived on `dev` / feature branch; Release attach + version wiring added in follow-up — merge PR.                                                                                                                                                      |
| Play Store listing / Data safety    | End goal | Publish CI ships completed Open testing / Production uploads (#1206). Listing, Data safety, and first Google review remain [#890](https://github.com/pskillen/codeplug-studio/issues/890). Live verify needs the Open testing track set up in Play Console. |
| Capacitor 8 vs USB plugin peers     | Medium   | `.npmrc` `legacy-peer-deps=true` — prefer a Capacitor-8-compatible plugin fork when available                                                                                                                                                               |
| External link interceptor coverage  | Low      | Only `target="_blank"` + http(s); docs previously overstated “all external hrefs”                                                                                                                                                                           |
| GA4 custom dimensions registration  | Low      | Register `app_surface` + `build_env` in prod and pre-prod GA4 Admin (manual; code already sends params — #896)                                                                                                                                              |
| Native Drive OAuth device verify    | High     | [#895](https://github.com/pskillen/codeplug-studio/issues/895) — signed APK + real Android client id; checklist in google-drive.md                                                                                                                          |
| Adaptive icon / splash device check | Medium   | #898 generated icon + splash assets were only verified via rasterized PNG inspection (no emulator/device in this environment) — confirm on a real launcher (light + dark, circle + squircle masks) before Play submission                                   |

## Closed / fixed in verification pass

- Groovy `keyAlias` / `keyPassword` name collision breaking `assembleRelease`
- `secrets` in workflow `if:` (invalid GHA context)
- Missing app `res/xml/device_filter.xml` while manifest referenced `@xml/device_filter`
- Docs claiming Release Assets while workflow only uploaded artifacts
- Hardcoded `versionCode 1` / `versionName "1.0"`
- Play `versionCode` = `github.run_number` on tagged releases (now SemVer-derived — #1206)
- Play upload `status: draft` / weekly Production cron / free-track manual upload (#1206)
