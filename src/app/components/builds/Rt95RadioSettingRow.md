# Rt95RadioSettingRow

## Purpose

One RT95 setting row on the Radio settings page: label, help, Radio column, Keep / Set control.

## Props

| Prop       | Type                              | Notes                     |
| ---------- | --------------------------------- | ------------------------- |
| `field`    | `Rt95SettingFieldDef`             | From core `radioSettings` |
| `override` | `Rt95SettingValue \| undefined`   | Session override          |
| `decoded`  | `Rt95DecodedSetting \| undefined` | Last read                 |
| `hasRead`  | `boolean`                         |                           |
| `onSet`    | `(value) => void`                 |                           |
| `onClear`  | `() => void`                      |                           |

## Related

- [Rt95RadioSettingsEditor](./Rt95RadioSettingsEditor.md)
