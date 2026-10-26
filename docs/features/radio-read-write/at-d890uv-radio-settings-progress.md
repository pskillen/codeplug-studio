# AT-D890UV radio settings — progress

**Tracking:** [#1393](https://github.com/pskillen/codeplug-studio/issues/1393)  
**Feature:** [at-d890uv-radio-settings.md](at-d890uv-radio-settings.md)

## Status

| PR  | Slice                                                                                                                                                                                                                                                     | State                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1   | Patch core: field allow-list, patch helpers, mask-level preserved check, verify expects patches ([#1394](https://github.com/pskillen/codeplug-studio/issues/1394)), settings-only upload, settings read, pause before transmit; step keys migrated; no UI | Done on `1393/pskil/d890-settings-patch-core` |
| 2   | Field registry and codec, session store                                                                                                                                                                                                                   | Not started                                   |
| 3   | Settings page, Read from radio                                                                                                                                                                                                                            | Not started                                   |
| 4   | Write UI (confirm, settings-only, fleet default)                                                                                                                                                                                                          | Not started                                   |
| 5   | Advanced fields                                                                                                                                                                                                                                           | Not started                                   |
| 7   | Frequency range display                                                                                                                                                                                                                                   | Not started                                   |

## Shipped this branch

- `settingsFields.ts` allow-list (permitted spans, never-patch offsets), `settingsPatch.ts` helpers
- `sparseEraseRmw.ts` mask-level preserved check; `protocol.ts` shared `rmwStageAndTransmit`
- `sentinelVerify.ts` / `writeVerifyHooks.ts` verify `before ⊕ patches`
- `uploadSettingsPatches`, `readSettingsSnapshot`; `radioIoAtD890SettingsWrite.ts`; `beforeTransmit` in `uploadPreparedRadioWrite`
- Golden transmitted-frame test pinning the codeplug Write

## Radio checks

RS1 and RS2 pending: see the feature page.

## Related

- [at-d890uv-radio-settings-outstanding.md](at-d890uv-radio-settings-outstanding.md)
