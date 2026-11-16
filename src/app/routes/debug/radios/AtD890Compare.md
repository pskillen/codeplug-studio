# AT-D890UV comparison

## Purpose

The AT-D890UV's extra panel under the shared compare (`CompareExtra` on its descriptor): acquisition claims and provenance divergence for two local archives, without radio I/O. Decoded fields come from the shared [DecodedDiffView](compare/DecodedDiffView.md).

## Props

| Prop     | Meaning                   |
| -------- | ------------------------- |
| `first`  | Primary debug archive.    |
| `second` | Comparison debug archive. |

## Behaviour

The D890's extra slot under the shared summary and hex diff ([RadioCompare](compare/RadioCompare.md)):

- **Acquisition ranges and provenance divergence.** The versioned acquisition sidecar is validated against stored regions; a missing or invalid claim refuses the byte compare (the shared view says so) and this panel renders nothing then (one alert, not two). Sparse configuration and each requested vital unit occupy separate comparison spaces (one shared-compare section each); missing, ambiguous and unclassified ranges are incomparable. Each range lists both captures' claims and the responding-unit verdict, Same or Different only when both archives explicitly name a unit, otherwise Unknown, never inferred from equal bytes, serials, labels or the expected mapping. Differing claims (acquisition kind, requested unit, responding-unit claim, repeat-read claim) are listed apart from the bytes.
- **Password bytes** are masked in the shared hex diff (the descriptor's ranges, per side), not here.

Reopened sidecars are archive claims, never live identity evidence.

## Related

[Archive viewers](ArchiveViewers.md) and [radio debug](../../../../../docs/features/radio-debug/README.md).
