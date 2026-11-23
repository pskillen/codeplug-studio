# SupportCellMark

One matrix or finder cell: the support mark, an optional evidence tag (`on air` / `bench` / `unverified`), and an optional dagger when a capability depends on the radio's firmware build.

## Props

| Prop           | Type                | Notes                                      |
| -------------- | ------------------- | ------------------------------------------ |
| `state`        | `SupportState`      | Passed through to `SupportMark`            |
| `title`        | `string`            | Tooltip (usually from `supportCellTitle`)  |
| `evidence`     | `SupportEvidence`   | Optional; sets `data-evidence` on the span |
| `note`         | `string`            | Optional condition; shown as †             |
| `data-testid`  | `string`             | Optional                                   |

## Usage

```tsx
<SupportCellMark
  state={cell.state}
  evidence={cell.evidence}
  note={cell.note}
  title={supportCellTitle(modeLabel(mode), cell.state, cell)}
  data-testid={`mode-${modelId}-${firmwareId}-${mode}`}
/>
```

## Behaviour

- Wraps `SupportMark` in an inline-flex `cellMark` span with the tooltip on the wrapper.
- Evidence tags use `SUPPORT_EVIDENCE_SHORT` labels and state-specific colours from `landing.module.css`.
- A `note` renders a visible dagger (`†`) plus a screen-reader-only full sentence (also included in `title` when built via `supportCellTitle`).

## Related

[SupportMark](SupportMark.md), [RadioSupportMatrix](RadioSupportMatrix.md).