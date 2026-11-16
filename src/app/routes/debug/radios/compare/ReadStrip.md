# ReadStrip

## Purpose

One line per read from the second onwards, each against the read before it, so a run of repeated reads (for example the four-identical-reads relay test) reads at a glance.

## Props

| Prop         | Meaning                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| `descriptor` | The radio's descriptor; only its `compare` byte adapter is used.        |
| `store`      | The read-history store: the reads, and where a click sets the A/B pair. |

## Behaviour

`B = A, identical` (green dot) or `E ≠ D, 3 bytes` (amber dot); grey for nothing comparable or a refused pair. The verdict is the same `compareVerdict` as the summary banner (compared sections only). Clicking a line calls `setComparePair` with that pair; the line for the current pair is bold. Hidden when the radio has no adapter or there are fewer than two reads. Sits above the A/B picker, rendered by the page.

## Related

[RadioCompare](RadioCompare.md), [ComparePicker](../ComparePicker.md).
