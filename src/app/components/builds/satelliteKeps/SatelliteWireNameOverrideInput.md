# SatelliteWireNameOverrideInput

Inline editor for a per-transmitter encoded wire name on the build Satellite keps tab.

## Purpose

Lets operators fill **Familiar** or **OSCAR** suggestions into the draft, type a custom ≤`N`-character name, or **Reset** to clear the override. Overrides persist on `RadioBuild.satelliteOverrides` keyed by transmitter id.

## Props

| Prop                | Type                         | Description                                             |
| ------------------- | ---------------------------- | ------------------------------------------------------- |
| `committedWireName` | `string`                     | Persisted override, or `''` when none is set            |
| `suggestedFamiliar` | `string`                     | Familiar-path encoded suggestion for this transmitter   |
| `suggestedOscar`    | `string \| null` (optional)  | OSCAR encoded suggestion when the spacecraft has Tier A |
| `nameLimit`         | `number`                     | Max length from radio limits (e.g. 8 on D890)           |
| `onWireNameChange`  | `(wireName: string) => void` | Persist draft or clear; `''` clears override            |
| `onDirtyChange`     | `(dirty: boolean) => void`   | Optional dirty-state callback                           |
| `onCancel`          | `() => void`                 | Optional cancel callback (Escape / X)                   |

## Behaviour

- Apply (check) commits draft when changed and within `nameLimit`.
- **Familiar** / **OSCAR** underlined links fill the draft only — they do not persist until Apply.
- **Reset** clears the build override immediately so the name tracks live generation again, and empties the draft (placeholder shows Familiar).

## Related

- [`SatelliteEncodedNameCell`](./SatelliteEncodedNameCell.md) — view/edit wrapper for the preview table
- [name-shortening.md](../../../../docs/features/satellite-keps/name-shortening.md)
