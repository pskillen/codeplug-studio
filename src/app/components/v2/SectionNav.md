# SectionNav

In-page section navigation (vertical rail or horizontal pills).

## Purpose

Used in dense editors (e.g. channel editor sections). Matches the design-system `SectionNav` component.

## Props

| Prop          | Type                         | Notes                                                 |
| ------------- | ---------------------------- | ----------------------------------------------------- |
| `items`       | `readonly SectionNavItem[]`  | `string \| { id: string; label: string }` — see below |
| `active`      | `string`                     | Matches item id (object form) or label (string form)  |
| `onChange`    | `(item: string) => void`     | Emits id for object items, label for string items     |
| `orientation` | `'vertical' \| 'horizontal'` | Default `vertical`                                    |

`SectionNavItem = string | { id: string; label: string }`. A bare string is both the match key and the
display label (today's behaviour, unchanged). An `{id, label}` pair lets the anchor id (e.g. a Panel's
`id`, used by `useSectionScrollSpy`) differ from the display text — the intended shape for scroll-spy
driven nav such as the channel editor's jump-nav (`channelEditorSections.ts`).

## Usage

```tsx
<SectionNav items={['Identity', 'Frequencies', 'Modes']} active={section} onChange={setSection} />
```

```tsx
// Scroll-spy driven nav (id ≠ label)
<SectionNav
  items={[
    { id: 'identity', label: 'Identity' },
    { id: 'rf', label: 'RF' },
  ]}
  active={activeSectionId}
  onChange={(id) => scrollToPageSection(id)}
  orientation="horizontal"
/>
```

## Related

- [AppShell.md](./AppShell.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
