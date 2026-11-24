# SiblingReads

## Purpose

Reminds the operator that another firmware profile for the same radio may still have read history in this tab.

## Props

| Prop         | Type                                                | Description                                                 |
| ------------ | --------------------------------------------------- | ----------------------------------------------------------- |
| `descriptor` | `Pick<RadioDebugDescriptor, 'radio' \| 'firmware'>` | Current page.                                               |
| `onSwitch`   | `(firmware: DebugFirmwareFamily) => void`           | Navigate to the sibling firmware (same as the page switch). |

## Usage

On the Overview (after Capabilities) and on the Backup tab (after history controls).

## Behaviour

One line per sibling descriptor with `readHistory` that has entries in its store: count, firmware label, optional undownloaded count, and a Switch control. Coloured with `DEBUG_FIRMWARE_COLOR`. Switching firmware does not trigger the leave guard; leaving the radio still does.

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md) · [DebugReadHistoryControls](./DebugReadHistoryControls.md)
