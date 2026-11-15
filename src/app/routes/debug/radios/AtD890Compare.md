# AT-D890UV comparison

## Purpose

Compare two local AT-D890UV archives without radio I/O: bytes, acquisition claims and decoded fields.

## Props

| Prop     | Meaning                   |
| -------- | ------------------------- |
| `first`  | Primary debug archive.    |
| `second` | Comparison debug archive. |

## Behaviour

Three sections, kept apart:

- **Byte divergence.** The versioned acquisition sidecar is validated against stored regions; missing or invalid claims refuse this section. Sparse configuration and each requested vital unit occupy separate comparison spaces; intersecting ranges are compared even if sparse entries were split differently. Missing and overlapping ambiguous ranges are incomparable. Range summaries and every changed byte run (address, length, first bytes before and after) are paged.
- **Provenance divergence.** Differing acquisition claims (acquisition kind, requested unit, responding-unit claim, repeat-read claim), shown separately from the bytes. The responding-unit verdict is Same or Different only when both archives explicitly name a responding unit; otherwise Unknown, never inferred from equal bytes, serials, labels or the expected mapping.
- **Decoded differences.** Built from `projectAtD890Memory` and the core calibration decoder (`atD890DecodedDiff.ts`): slot-matched records, field-matched settings and calibration. Additions and removals need captured occupancy on both sides; uncaptured values are unavailable, not zero or deleted. Filter by domain; results are paged. Shown even when the sidecar is refused, without making those bytes trusted.

Reopened sidecars are archive claims, never live identity evidence.

## Related

[Archive viewers](ArchiveViewers.md) and [radio debug](../../../../../docs/features/radio-debug/README.md).
