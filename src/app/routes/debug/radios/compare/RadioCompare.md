# RadioCompare

## Purpose

The Compare tab body for two chosen reads on every radio with a capture (RT95, DM-32UV, OpenGD77, AT-D890UV, UV-5R Mini): summary, hex diff, then the radio's decoded changes.

## Props

| Prop         | Meaning                                                                   |
| ------------ | ------------------------------------------------------------------------- |
| `descriptor` | The radio's descriptor: its `compare` adapter and optional `DecodedDiff`. |
| `a` / `b`    | The picked archives (the A/B picker is rendered by the page, above this). |

## Behaviour

Runs the adapter's `sections(a, b)`, shows [CompareSummary](CompareSummary.md), then a **Comparison region** select and [HexDiff](HexDiff.md) for the chosen region (default: the first changed one). Choosing a summary row selects that region, turns Only changed rows on and scrolls there. **Show password** is one toggle for the tab and resets when A or B changes. `descriptor.DecodedDiff` renders in the decoded slot with `first`/`second` (the D890 provenance panel and decoded changes, the Mini's channel differences); it also renders when the byte compare is refused, since decoded changes do not depend on it. The page mounts it only while the Compare tab is open. No radio literals here; masking comes from each descriptor's `sensitiveRanges`.

## Related

[Radio debug](../../../../../../docs/features/radio-debug/README.md), [ComparePicker](../ComparePicker.md).
