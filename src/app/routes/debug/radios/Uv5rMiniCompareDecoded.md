# Uv5rMiniCompareDecoded

## Purpose

The UV-5R Mini's decoded channel differences, in the shared compare's decoded slot (the Mini descriptor's `DecodedDiff`). A temporary home until the shared decoded diff replaces it.

## Props

| Prop     | Meaning                                      |
| -------- | -------------------------------------------- |
| `first`  | Archive A (decoded clone in region `clone`). |
| `second` | Archive B.                                   |

## Behaviour

`diffUv5rMiniChannels` over the two clones: one line per changed slot with its named fields, and slots 248 and 249 kept apart. Renders nothing when either archive has no `clone` region. The byte verdict (log sectors skipped, VFO and settings frames reported, spans and calibration compared) comes from the Mini's compare adapter in the shared summary, not from here.

## Related

[RadioCompare](compare/RadioCompare.md), [radio debug](../../../../../docs/features/radio-debug/README.md).
