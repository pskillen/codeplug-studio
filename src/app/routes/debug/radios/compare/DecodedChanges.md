# DecodedChanges

## Purpose

The radio-neutral "Decoded changes" list: one line per changed value, grouped by section, for any radio whose descriptor's `compare.decoded` supplies decoded domains. It replaces the RT95-shaped block the legacy `CompareViewer` used to carry.

## Props

| Prop                          | Meaning                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `changes`                     | `DecodedChange[]` (section, record, label, A, B, address, sensitive, kind) from `decodedChanges(diffDecoded(...))`; `undefined` when unavailable. |
| `notCaptured`                 | Values not captured on a side (`notCapturedCount`); shown dimmed, never counted as changes.                                                       |
| `revealed` / `onToggleReveal` | Show password state.                                                                                                                              |

## Behaviour

`Record · Label: A → B · 0xADDRESS` under a bold section heading. A changed sensitive value reads `changed` until Show password. No changes reads "No decoded changes."; no decoder reads "Decoded changes are unavailable for these captures." No radio literals.

## Related

[DecodedDiffView](DecodedDiffView.md), [RadioCompare](RadioCompare.md), [Radio debug](../../../../../../docs/features/radio-debug/README.md).
