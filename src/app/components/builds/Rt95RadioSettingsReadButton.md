# Rt95RadioSettingsReadButton

## Purpose

**Read a radio** on the RT95 settings page and Export panel card. Calls `readRt95SettingsFromRadio`, stores the result in `rt95RadioSettingsSession`, sets no override.

## Props

| Prop      | Type                       | Notes                                  |
| --------- | -------------------------- | -------------------------------------- |
| `buildId` | `string`                   |                                        |
| `egress`  | `EgressPath`               |                                        |
| `variant` | `'primary' \| 'secondary'` | Default `primary` on the settings page |

## Related

- [Rt95RadioSettingsEditor](./Rt95RadioSettingsEditor.md)
