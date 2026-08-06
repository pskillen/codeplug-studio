# WriteVerifyReport

Simple bordered write/verify results card.

## Purpose

The results view for a radio write/verify flow — big-number summary stats plus a per-item status list. **Stub only in this PR** — static fixture props, no interactivity. Full data wiring to real `WriteVerifyResult` types lands in the builds ticket ([#924](https://github.com/pskillen/codeplug-studio/issues/924)).

## Props

| Prop      | Type                             | Notes                                                                |
| --------- | -------------------------------- | -------------------------------------------------------------------- |
| `title`   | `ReactNode`                      | Default `Write & verify report`                                      |
| `summary` | `{ value, label, tone? }[]`      | Big-number stat row. `tone`: `default` \| `warning` \| `destructive` |
| `rows`    | `{ id, tone, label, detail? }[]` | Required — each rendered as a `StatusDot` + detail text              |
| `caption` | `ReactNode`                      |                                                                      |

## Usage

```tsx
import { DesignSystemV2Provider, WriteVerifyReport } from '@app/components/v2';

<DesignSystemV2Provider>
  <WriteVerifyReport
    summary={[{ value: 42, label: 'Channels written' }]}
    rows={[{ id: '1', tone: 'success', label: 'Channel 1', detail: 'Verified' }]}
  />
</DesignSystemV2Provider>;
```

## Behaviour

- Must render inside `DesignSystemV2Provider`.
- Simple bordered card, no interactivity.
- Each row composes `StatusDot` for the tone + label, with the detail right-aligned.
- Visual shape referenced from `builds/WriteVerifyReport.tsx` for parity, but this component does not import from it or type against real domain types.
- Live demos: `/styleguide/v2/data-display`

## Related

- [StatusDot.md](./StatusDot.md)
- [WirePreviewTable.md](./WirePreviewTable.md)
- [ProgressModal.md](./ProgressModal.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
