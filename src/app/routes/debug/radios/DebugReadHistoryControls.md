# DebugReadHistoryControls

## Purpose

Select, download and explicitly clear a tab-local debug read history.

## Props

| Prop         | Purpose                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| `descriptor` | Radio profile slug and archive model identifier.                        |
| `store`      | The profile's shared history store.                                     |
| `onClear`    | Optional callback to reset dependent comparison and overlay selections. |

## Behaviour

Selection shows each capture's label and time. The **Selected read** `Select` shows a firmware-coloured dot (`DEBUG_FIRMWARE_COLOR`) in the field and beside every option, matching the switch and sibling-read markers. Download all captures a snapshot of the current entries and only marks those IDs downloaded after a successful save. Clear requires confirmation. Retaining captures and generating a ZIP consume tab memory; history is not persisted or uploaded.

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md)
