# WirePreviewTable

Read-only, monospace preview table for build wire output.

## Purpose

Dense read-only preview of CPS wire columns before write/export. **Stub only in this PR** — static fixture props, no sort/select/actions/interactivity. Full data wiring to real build/wire-preview types (`WirePreviewRow` and friends) lands in the builds ticket ([#924](https://github.com/pskillen/codeplug-studio/issues/924)).

## Props

| Prop           | Type                                             | Notes                                                                                        |
| -------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `title`        | `ReactNode`                                      |                                                                                              |
| `columns`      | `{ key, label, width?, align?, render, dim? }[]` | Required                                                                                     |
| `rows`         | `T[]`                                            | Required                                                                                     |
| `getRowId`     | `(row: T) => string`                             | Required                                                                                     |
| `isRowChanged` | `(row: T) => boolean`                            | Highlights the row; shows the "Overridden rows highlighted" header pill when any row matches |
| `caption`      | `ReactNode`                                      |                                                                                              |

## Usage

```tsx
import { DesignSystemV2Provider, WirePreviewTable } from '@app/components/v2';

<DesignSystemV2Provider>
  <WirePreviewTable
    title="Channels"
    columns={[{ key: 'name', label: 'Name', render: (row) => row.name }]}
    rows={rows}
    getRowId={(row) => row.id}
    isRowChanged={(row) => row.overridden}
  />
</DesignSystemV2Provider>;
```

## Behaviour

- Must render inside `DesignSystemV2Provider`.
- Monospace, no sort/select/actions — read-only by design.
- Visual shape referenced from `builds/wirePreview/WirePreviewDataTable.tsx` for parity, but this component does not import from it or type against real wire-preview domain types.
- Live demos: `/styleguide/data-display`

## Related

- [WriteVerifyReport.md](./WriteVerifyReport.md)
- [DataTable.md](./DataTable.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
