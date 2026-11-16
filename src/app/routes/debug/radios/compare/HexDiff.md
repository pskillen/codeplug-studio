# HexDiff

## Purpose

Byte-level diff of one compared region: A over B in 16-byte rows, changed bytes marked.

## Props

| Prop                  | Meaning                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `section`             | A `CompareSection` with both `a` and `b` bytes (from `@integrations/radio-io/debugCompare`). |
| `rangesA` / `rangesB` | Password ranges of each side, in absolute addresses; masked until `revealed`.                |
| `revealed`            | Show masked bytes.                                                                           |
| `onlyChanged`         | Filtered view (controlled by the parent so the summary can switch it on).                    |
| `onOnlyChangedChange` | Called when the toggle changes, or when Go to address needs the full view.                   |

## Behaviour

Rows sit on absolute 16-byte boundaries. Differing bytes are amber and bold, and a gutter shows the row's count (`3≠`). The filtered view shows changed rows plus 0, 1, 2 or 4 context rows (`hexHunks`), with "… identical (N rows)" separators, 20 hunks to a page; the full view pages 256 bytes. **Previous change** / **Next change** step through changed rows (the current one is outlined); **Go to address** opens the full view there. A longer side's extra tail is stated once and counted as missing. Masked bytes read `••` on both sides but still mark when they differ, with "[masked bytes differ]" on the row.

## Related

[Radio debug](../../../../../../docs/features/radio-debug/README.md), [CompareSummary](CompareSummary.md), [RadioCompare](RadioCompare.md).
