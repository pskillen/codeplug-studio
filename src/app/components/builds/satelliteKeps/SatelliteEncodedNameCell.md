# SatelliteEncodedNameCell

View/edit toggle for a transmitter row's encoded wire name on the build Satellite keps preview table.

## Purpose

Shows the effective encoded name with truncation hint and an edit affordance. In edit mode, delegates to [`SatelliteWireNameOverrideInput`](./SatelliteWireNameOverrideInput.md).

## Props

| Prop                 | Type                              | Description                                      |
| -------------------- | --------------------------------- | ------------------------------------------------ |
| `entry`              | `SatelliteWritePreviewEntry`      | Preview row for this transmitter                 |
| `nameLimit`          | `number`                          | Max encoded name length from radio limits        |
| `editing`            | `boolean`                         | When true, shows the inline override editor      |
| `committedWireName`  | `string`                          | Current persisted or generated encoded name      |
| `onStartEdit`        | `() => void`                      | Opens edit mode                                  |
| `onCancelEdit`       | `() => void`                      | Closes edit mode without saving                  |
| `onWireNameChange`   | `(wireName: string) => void`      | Apply or Reset — empty string clears override    |

## Related

- [Build Satellite keps page](../../../routes/builds/BuildSatelliteKepsPage.tsx)
- [name-shortening.md](../../../../docs/features/satellite-keps/name-shortening.md)
