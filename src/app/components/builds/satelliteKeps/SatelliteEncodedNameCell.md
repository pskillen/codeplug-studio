# SatelliteEncodedNameCell

View/edit toggle for a transmitter row's encoded wire name on the build Satellite keps preview table.

## Purpose

Shows the effective encoded name with a severity marker and an edit affordance. Converged onto
the shared wire-preview components (wire-preview rework phase 6): read state uses
[`WireNameRemediationMarker`](../wirePreview/WireNameRemediationMarker.md) — driven by
`src/app/lib/satelliteWireNameRemediation.ts` mapping this radio's `nameTruncated` boolean onto
the shared severity table (only a hard byte-budget cut gets the orange triangle; clean
dictionary shortening stays a dimmed `≈`) — and edit mode uses
[`WireNameInlineEditor`](../wirePreview/WireNameInlineEditor.md) directly with two suggestions,
Familiar and OSCAR (two different source identities for the same spacecraft — not two renderings
of one name, ux-proposal.md §6).

## Props

| Prop                | Type                         | Description                                   |
| ------------------- | ---------------------------- | --------------------------------------------- |
| `entry`             | `SatelliteWritePreviewEntry` | Preview row for this transmitter              |
| `nameLimit`         | `number`                     | Max encoded name length from radio limits     |
| `editing`           | `boolean`                    | When true, shows the inline override editor   |
| `committedWireName` | `string`                     | Persisted override, or `''` when none is set  |
| `onStartEdit`       | `() => void`                 | Opens edit mode                               |
| `onCancelEdit`      | `() => void`                 | Closes edit mode without saving               |
| `onWireNameChange`  | `(wireName: string) => void` | Apply or Reset — empty string clears override |

## Related

- [Build Satellite keps page](../../../routes/builds/BuildSatelliteKepsPage.tsx)
- [name-shortening.md](../../../../docs/features/satellite-keps/name-shortening.md)
