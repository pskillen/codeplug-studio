# FirmwareSwitch

## Purpose

Lets the operator pick which firmware family they expect on a radio debug page, without leaving the hardware model.

## Props

| Prop        | Type                                                             | Description                                                        |
| ----------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `options`   | `readonly Pick<RadioDebugDescriptor, 'firmware' \| 'capture'>[]` | Firmware choices for this radio, in display order (`firmwaresOf`). |
| `value`     | `DebugFirmwareFamily`                                            | Active firmware segment.                                           |
| `onChange`  | `(firmware: DebugFirmwareFamily) => void`                        | Called when the operator picks another firmware.                   |
| `disabled?` | `boolean`                                                        | Disables interaction (for example while a read runs).              |

## Usage

Rendered under the radio title on `RadioDebugPage`, above the tab bar.

## Behaviour

Mantine `SegmentedControl`, full width, coloured with `DEBUG_FIRMWARE_COLOR[value]`. Each segment shows a dot in that firmware’s colour (hollow when the descriptor has no `capture` yet) and `DEBUG_FIRMWARE_LABEL`. With one option the control is shown but not clickable (`readOnly`). Helper copy: “Firmware you expect. The Read checks it first.” `aria-label="Firmware"`.

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md) · [debugFirmware.ts](./debugFirmware.ts)
