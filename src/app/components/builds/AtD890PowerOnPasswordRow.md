# AtD890PowerOnPasswordRow

## Purpose

The AT-D890UV power-on password on the Radio settings page (#1393): one control over the on/off byte and the eight password bytes. Advanced settings only.

## Props

| Prop              | Type                                | Notes                                                 |
| ----------------- | ----------------------------------- | ----------------------------------------------------- |
| `enabledOverride` | `boolean \| undefined`              | `true` password on, `false` cleared, `undefined` Keep |
| `digitsOverride`  | `string \| undefined`               | The digits the override carries (empty when cleared)  |
| `decodedEnabled`  | `AtD890DecodedSetting \| undefined` | The Radio column: On or Off, never the digits         |
| `hasRead`         | `boolean`                           | False shows "not read"                                |
| `onSetPassword`   | `(digits) => void`                  | Both overrides set together                           |
| `onClearPassword` | `() => void`                        | Enable off, digits empty; works without a read        |
| `onKeep`          | `() => void`                        | Back to Keep                                          |

## Usage

```tsx
<AtD890PowerOnPasswordRow
  enabledOverride={enabled}
  digitsOverride={digits}
  decodedEnabled={read?.decoded.powerOnPasswordEnabled}
  hasRead={read !== undefined}
  onSetPassword={(d) => setPowerOnPassword(buildId, d)}
  onClearPassword={() => setPowerOnPasswordOff(buildId)}
  onKeep={() => clearPowerOnPassword(buildId)}
/>
```

## Behaviour

- Two boxes, digits only (1 to 8), shown in clear, typed twice. The override is set only when both are valid and equal (`powerOnPasswordProblem`); a broken edit after a good one returns to Keep. Typing after **Clear password** replaces it.
- **Clear password** is always available. Boxes that still hold a complete password the overrides no longer carry (Clear all) show empty.
- The warning ("The radio won't start until this is typed. Write it down. If you forget it, the radio can't be programmed until it is typed.") shows while a password is set.

## Related

- [AtD890RadioSettingsEditor](./AtD890RadioSettingsEditor.md)
- [AT-D890UV radio settings](../../../../docs/features/radio-read-write/at-d890uv-radio-settings.md)
