# SatelliteWireNameOverrideInput

Inline editor for a per-transmitter encoded wire name on the build Satellite keps tab.

## Purpose

Lets operators pin **Familiar** or **OSCAR** suggestions, type a custom ≤`N`-character name, or **Reset** to generated defaults. Overrides persist on `RadioBuild.satelliteOverrides` keyed by transmitter id.

## Props

| Prop                | Type                         | Description                                             |
| ------------------- | ---------------------------- | ------------------------------------------------------- |
| `committedWireName` | `string`                     | Current effective encoded name                          |
| `suggestedFamiliar` | `string`                     | Familiar-path encoded suggestion for this transmitter   |
| `suggestedOscar`    | `string \| null` (optional)  | OSCAR encoded suggestion when the spacecraft has Tier A |
| `nameLimit`         | `number`                     | Max length from radio limits (e.g. 8 on D890)           |
| `onWireNameChange`  | `(wireName: string) => void` | Apply suggestion or custom text; `''` clears override   |
| `onDirtyChange`     | `(dirty: boolean) => void`   | Optional dirty-state callback                           |
| `onCancel`          | `() => void`                 | Optional cancel callback (Escape / X)                   |

## Behaviour

- Apply (check) commits draft when changed and within `nameLimit`.
- **Familiar** / **OSCAR** underlined links store that suggestion as an explicit override.
- **Reset** clears the build override so the name tracks live generation again.

## Related

- [`SatelliteEncodedNameCell`](./SatelliteEncodedNameCell.md) — view/edit wrapper for the preview table
- [name-shortening.md](../../../../docs/features/satellite-keps/name-shortening.md)
