# ChannelToneField

## Purpose

Analog CTCSS/DCS picker for a library channel tone (`rxTone` / `txTone`). The operator picks **Off**, **CTCSS**, or **DCS**, then only that kind’s values. Inverted DCS is stored as `D023I`.

## Props

| Prop            | Type                               | Description                                                                                          |
| --------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `label`         | `string` (optional)                | Visible label on the kind control. Omit when a parent already names the field (bulk edit).           |
| `groupLabel`    | `string` (optional)                | Accessible name for the group when `label` is omitted.                                               |
| `value`         | `ChannelTone`                      | `'none'`, a CTCSS Hz string, or a DCS code (`D023N` / `D023I`). Legacy `D023P` displays as inverted. |
| `onChange`      | `(tone: ChannelTone) => void`      | Called when the stored tone should change.                                                           |
| `comboboxProps` | Mantine `ComboboxProps` (optional) | Forwarded to the value select (modal menus).                                                         |
| `disabled`      | `boolean`                          | Optional. Default `false`.                                                                           |

## Usage

```tsx
import ChannelToneField from '@app/components/channels/ChannelToneField.tsx';

<ChannelToneField
  label="RX tone"
  value={profile.rxTone}
  onChange={(rxTone) => onPatch({ rxTone })}
/>;
```

## Behaviour

- **Off** stores `'none'` and hides the value controls.
- **CTCSS** shows the Hz list (`88.5 Hz`). No Hz is chosen until the operator picks one; until then the stored string stays `'none'`.
- **DCS** shows the code list plus **Normal | Inverted**. Normal stores `D023N`; inverted stores `D023I`. Changing polarity keeps the code.
- Switching between CTCSS and DCS clears the previous value immediately so an Hz is never left stored as DCS, or the reverse.
- A Hz or DCS code that parses but is not in the catalog stays as an extra option.
- A string that is neither Off, CTCSS, nor DCS is shown as “Stored value: …” and is left unchanged until the operator picks a kind.
- Opening `D023P` shows inverted DCS and does not rewrite storage until this field changes; the next write uses `I`.
- RX and TX are two independent fields.

## Related

- [ChannelModeProfilesEditor](./ChannelModeProfilesEditor.md)
- [ChannelBulkEditModal](../library/ChannelBulkEditModal.md)
- [Library feature hub](../../../../docs/features/library/README.md)
