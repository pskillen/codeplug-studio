# WarningsList

## Purpose

Render export/write warning lists the same way everywhere: problems with counts, notes folded behind one summary line, channel wire-name rows showing callsign then name when an `entityId` is present.

## Props

| Prop           | Type                                        | Description                                                                        |
| -------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `warnings`     | `readonly ExportWarning[]`                  | Structured warnings from core export/write projection.                             |
| `mode`         | `'full' \| 'problems' \| 'chip' \| 'recap'` | Layout for step 1, Review, tight space, or Done recap.                             |
| `channelLabel` | `(entityId: string) => string \| undefined` | Optional map from channel library id to display label (callsign then name).        |
| `emptyText`    | `string`                                    | Shown in `full` and `recap` when there are no warnings (default `"No warnings."`). |
| `testId`       | `string`                                    | Root `data-testid` (default `warnings-list`).                                      |

## Usage

```tsx
import { WarningsList } from '@app/components/egress';

<WarningsList
  warnings={projectionWarnings}
  mode="full"
  channelLabel={(id) => channelById.get(id) && channelDisplayLabel(channelById.get(id)!)}
/>;
```

## Behaviour

- **`full`** — yellow problems block (open) with accordion groups per kind; notes folded (`"<n> names shortened cleanly"` or `"<n> notes"`).
- **`problems`** — problems only; renders nothing when the list has no problems.
- **`chip`** — one-line count via `summariseExportWarnings`.
- **`recap`** — chip summary plus a folded Details accordion for everything else.
- Shortening rows use `channelLabel` on the original side when `entityId` is set; exported side stays the wire string.

## Related

- [Import / export feature hub](../../../../docs/features/import-export/README.md)
- `formatExportWarnings.ts` — grouping logic
- [display.md](../../../../docs/reference/styleguide/display.md) — where each mode is used
