# AT-D890UV radio settings — progress

**Tracking:** [#1393](https://github.com/pskillen/codeplug-studio/issues/1393)  
**Feature:** [at-d890uv-radio-settings.md](at-d890uv-radio-settings.md)

## Status

| PR  | Slice                                                                                                                                                                                                                                                     | State                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1   | Patch core: field allow-list, patch helpers, mask-level preserved check, verify expects patches ([#1394](https://github.com/pskillen/codeplug-studio/issues/1394)), settings-only upload, settings read, pause before transmit; step keys migrated; no UI | Done on `1393/pskil/d890-settings-patch-core` |
| 2   | v1 field registry, codec, session store, field reference                                                                                                                                                                                                  | Done on `1393/pskil/d890-settings-fields`     |
| 3   | Settings page, Read from radio                                                                                                                                                                                                                            | Done on `1393/pskil/d890-settings-page`       |
| 4c  | D890 Review (range, receive-only channels, settings now → after, fleet choice, backup, step-key nudge), Radio settings part, settings-only Write, step-key switch removed for the D890, stun/kill guard                                                   | Not started                                   |
| 5   | Advanced fields                                                                                                                                                                                                                                           | Not started                                   |
| 7   | Frequency range display                                                                                                                                                                                                                                   | Not started                                   |

## Shipped this branch

- `settingsFields.ts` allow-list (permitted spans, never-patch offsets), `settingsPatch.ts` helpers
- `sparseEraseRmw.ts` mask-level preserved check; `protocol.ts` shared `rmwStageAndTransmit`
- `sentinelVerify.ts` / `writeVerifyHooks.ts` verify `before ⊕ patches`
- `uploadSettingsPatches`, `readSettingsSnapshot`; `radioIoAtD890SettingsWrite.ts`; `beforeTransmit` in `uploadPreparedRadioWrite`
- Golden transmitted-frame test pinning the codeplug Write

- `radioSettings.ts` (core): ids, sections, labels, value lists, 65 key functions and MM9PDY names
- `settingsFields.ts`: one spec per v1 field; `settingsCodec.ts`: decode a snapshot, language lock
- `atD890RadioSettingsSession.ts`: session-only overrides and read values
- Reference page `optional-settings.md`; layout corrections

### PR 4c: Review and settings Write

- Review sections for the D890 (`RadioWriteStepper/d890/`), the Radio settings part row, the Done-screen "don't ask again", settings-only Write from the stepper and the settings page's **Write settings…**
- `packAtD890BackupFromSession`: **Save backup now** from the Write's read
- The persisted step-key switch is gone for the D890 (the nudge replaces it); What Write updates counts the session's settings
- Stun/kill guard on `END` ([#1288](https://github.com/pskillen/codeplug-studio/issues/1288))

### PR 3: settings page

- Route `/builds/:id/export/radio-settings` and a strip entry on AT-D890UV Web Serial builds
- `AtD890RadioSettingsEditor`, `AtD890RadioSettingRow`, `Mm9pdyStepKeysNudge`; Read a radio (`radioIoAtD890SettingsRead.ts`); Copy all, Clear all, the sticky changes footer
- The strip entry and page need no Write: the footer says writing arrives with the next Write update

## Radio checks

RS1, RS2, RS8, RS8b and RS8c pending: see the feature page.

## Related

- [at-d890uv-radio-settings-outstanding.md](at-d890uv-radio-settings-outstanding.md)
