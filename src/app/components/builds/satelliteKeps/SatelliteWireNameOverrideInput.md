# SatelliteWireNameOverrideInput

## Purpose

Editable wire-name field for a satellite on the build **Satellite keps** tab (#1090). Mirrors channel wire preview: draft/apply/revert, clickable **Default** to pin the generated short name, and **Reset** to drop the build override.

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `committedWireName` | `string` | Value last saved on the build (override or live generated). |
| `generatedWireName` | `string` | Algorithm default from `shortenSatelliteNames` for the current write set. |
| `nameLimit` | `number` | Radio name field ceiling (from limits module). |
| `onWireNameChange` | `(wireName: string) => void` | Apply (`wireName`) or clear override (`''`). |
| `onDirtyChange` | `(dirty: boolean) => void` | Optional dirty-state callback. |

## Usage

```tsx
<SatelliteWireNameOverrideInput
  committedWireName={committed}
  generatedWireName={entry.generatedWireName}
  nameLimit={AT_D890UV_LIMITS.SATELLITE_NAME_LENGTH}
  onWireNameChange={(wireName) => persistOverride(satelliteId, wireName)}
/>
```

## Behaviour

- Placeholder shows `generatedWireName` when the field is empty.
- **Default** stores `generatedWireName` as an explicit `satelliteOverrides` entry.
- **Reset** clears the override so the name tracks live generation again.
- Apply is disabled when the draft exceeds `nameLimit`.

## Related

- [Satellite keps feature hub](../../../../docs/features/satellite-keps/README.md)
- [WireNameOverrideInput](../wirePreview/WireNameOverrideInput.tsx) — channel wire preview analogue
