# ComparePicker

## Purpose

The A and B pickers of a radio debug page's Compare tab: two selects over the tab-local read history and a swap button.

## Props

| Prop            | Purpose                                                                            |
| --------------- | ---------------------------------------------------------------------------------- |
| `store`         | The profile's shared read history; the pair lives in its snapshot (`comparePair`). |
| `onOpenArchive` | Optional. Opens a file into the history (shows an **Open archive** button).        |

## Behaviour

Options read `letter · time · radio name / label`, like `DebugReadHistoryControls`. By default A is the previous read and B the latest. Picking a side keeps it through new reads and navigation; a read that leaves the history sends that side back to its default. **Swap A and B** exchanges them. The pair is separate from the calibration overlay pick. With fewer than two reads the picker says so and offers **Open archive**; the same read on both sides shows an info line and no compare.

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md)
