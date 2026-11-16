# ConfidenceBadge

Layout or meaning confidence, as a pill.

## Purpose

One badge for every debug table and chart card. Fixes the old DM-32 badge that truncated ("TR…").

## Props

| Prop    | Type         | Notes                                  |
| ------- | ------------ | -------------------------------------- |
| `value` | `Confidence` | See the table below                    |
| `kind`  | `string`     | "layout" or "meaning", for the tooltip |

| Value              | Text               | Tone    |
| ------------------ | ------------------ | ------- |
| `traced`           | traced             | success |
| `partially-traced` | partly traced      | warning |
| `inferred`         | inferred           | warning |
| `unknown`          | unknown            | neutral |
| `unused`           | unused (no reader) | neutral |

## Behaviour

- Never truncates: the pill is `nowrap` and not shrunk with an ellipsis.
- Tooltip reads `<kind> confidence: <text>`.

## Related

- [DebugSection.md](./DebugSection.md), [HexDecValue.md](./HexDecValue.md)
