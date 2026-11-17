# DecodedDiffView

## Purpose

The decoded half of a radio debug page's Compare tab: what changed between reads A and B as records and fields, for any radio whose compare adapter has `decoded`.

## Props

| Prop                                  | Meaning                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `diff`                                | `diffDecoded` result; sensitive values are present only when revealed.          |
| `category` / `onCategoryChange`       | Selected domain id, or `all`. Owned by the parent so the summary can jump here. |
| `onlyChanges` / `onOnlyChangesChange` | The Only changes switch (on by default).                                        |
| `revealed` / `onToggleReveal`         | Show password state, shared with the hex diff.                                  |

## Behaviour

One block per record: `Slot N · callsign name` (callsign first; name alone when there is none; a rename reads `(was …)`), a kind badge and a `Field | A | B` table (plus an `Address` column, hex alone, when the decoder gave the record's fields addresses; every radio's settings do, and calibration on the RT95, AT-D890UV, OpenGD77 and UV-5R Mini) with changed cells marked. Only changes hides unchanged records and unchanged fields; off, every record and field shows, 30 records at a time. A value a capture lacks reads _Not captured_, never zero. A changed sensitive field reads _changed_ with no values until Show password. Domain notes and record caveats show dimmed. No radio literals: labels, identity and sensitivity come from the adapter.

## Related

[RadioCompare](RadioCompare.md), [CompareSummary](CompareSummary.md), [Radio debug](../../../../../../docs/features/radio-debug/README.md).
