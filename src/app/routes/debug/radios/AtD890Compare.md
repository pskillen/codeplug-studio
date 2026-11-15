# AT-D890UV comparison

## Purpose

Compare captured acquisition ranges in two local AT-D890UV archives without radio I/O.

## Props

| Prop     | Meaning                   |
| -------- | ------------------------- |
| `first`  | Primary debug archive.    |
| `second` | Comparison debug archive. |

## Behaviour

The versioned acquisition sidecar is validated against stored regions. Missing or invalid claims are refused. Sparse configuration and each requested vital unit occupy separate comparison spaces; intersecting ranges are compared even if sparse entries were split differently. Missing and overlapping ambiguous ranges remain incomparable. Results are paged. The responding physical unit is unknown; repeat-read agreement does not establish unit identity or calibration validity. Reopened sidecars are archive claims. Decoded field differences are not yet available.

## Related

[Archive viewers](ArchiveViewers.md) and [radio debug](../../../../../docs/features/radio-debug/README.md).
