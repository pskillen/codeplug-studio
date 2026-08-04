# SectionNav

In-page section navigation (vertical rail or horizontal pills).

## Purpose

Used in dense editors (e.g. channel editor sections). Matches the design-system `SectionNav` component.

## Props

| Prop          | Type                         | Notes              |
| ------------- | ---------------------------- | ------------------ |
| `items`       | `readonly string[]`          | Section labels     |
| `active`      | `string`                     | Selected label     |
| `onChange`    | `(item: string) => void`     | Selection handler  |
| `orientation` | `'vertical' \| 'horizontal'` | Default `vertical` |

## Usage

```tsx
<SectionNav items={['Identity', 'Frequencies', 'Modes']} active={section} onChange={setSection} />
```

## Related

- [AppShell.md](./AppShell.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
