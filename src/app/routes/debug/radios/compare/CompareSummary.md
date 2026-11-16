# CompareSummary

## Purpose

The verdict banner and per-region table at the top of a radio debug page's Compare tab.

## Props

| Prop             | Meaning                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| `comparison`     | The adapter's `ByteComparison` (sections and any whole-pair error).       |
| `onJump`         | Called with a section id when its row (or its name button) is chosen.     |
| `decoded`        | Optional `DecodedDiff`: adds **Fields by category** and the field counts. |
| `onJumpCategory` | Called with a domain id when its category row is chosen.                  |

## Behaviour

Green **Identical**, amber **A and B differ**, grey **Nothing comparable**, from `compareVerdict`: only `compared` sections decide, and nothing compared is never green. Below it, **Bytes by region** (region with its provenance note once, range, kind, result). An amber row lists its changed 16-byte row addresses (first 32, "+N more") with a Copy button. With a decoded diff the amber banner also gives changed fields and records, and **Fields by category** lists changed fields and records changed, added, removed and not comparable per category.

## Related

[Radio debug](../../../../../../docs/features/radio-debug/README.md), [HexDiff](HexDiff.md), [RadioCompare](RadioCompare.md).
