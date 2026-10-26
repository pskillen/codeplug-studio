# AtD890RadioSettingRow

## Purpose

One AT-D890UV radio setting on the Radio settings page: label, a tag saying where the radio lets you change it ("On radio menu", "CPS only", "Hidden"), a one-line help, the value the radio holds, and a Keep / Set control. Purely presentational: the editor feeds it the field definition, the override and the decoded read.

## Props

| Prop       | Type                                | Notes                                                         |
| ---------- | ----------------------------------- | ------------------------------------------------------------- |
| `field`    | `AtD890SettingFieldDef`             | From core `radioSettings.ts`                                  |
| `target`   | `'stock' \| 'mm9pdy'`               | MM9PDY key function names and exposure                        |
| `override` | `AtD890SettingValue \| undefined`   | The session override; `undefined` means Keep                  |
| `decoded`  | `AtD890DecodedSetting \| undefined` | What the last read found for this field                       |
| `hasRead`  | `boolean`                           | False shows "not read"                                        |
| `onSet`    | `(value) => void`                   | Called when the control picks or types a value                |
| `onClear`  | `() => void`                        | Back to Keep (the select's first option, or the Clear button) |
| `note`     | `string`                            | Optional line under the control                               |

## Usage

```tsx
<AtD890RadioSettingRow
  field={field}
  target="stock"
  override={overrides.get(field.id)}
  decoded={read?.decoded[field.id]}
  hasRead={read !== undefined}
  onSet={(v) => setOverride(buildId, field.id, v)}
  onClear={() => clearOverride(buildId, field.id)}
/>
```

## Behaviour

- Select controls (enums, levels, Off/On for booleans) list **Keep radio's value** first. Text lines are a text box whose placeholder is "Keep radio's value"; an empty value that was typed is a set value (an empty line): the box then shows the placeholder "(empty line)" and the hint "Will be set to an empty line.", so it does not read as Keep, and Clear returns to Keep.
- A value the radio holds that Studio does not offer (a custom picture, a corrupt byte) appears only in the Radio column, as "<name or raw bytes> (not offered)"; it is never an option.
- Text lines are checked with the core `atD890TextProblem` (16 characters, printable ASCII); the problem shows under the box.
- A set row shows a dot and a **Clear** button.
- The Radio column never logs anything; power-on text and serial are never sent anywhere.

## Related

- [AtD890RadioSettingsEditor](./AtD890RadioSettingsEditor.md)
- [AT-D890UV radio settings](../../../../docs/features/radio-read-write/at-d890uv-radio-settings.md)
