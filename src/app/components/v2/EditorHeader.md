# EditorHeader

Editor page title block with back crumb — shared Batch 3 chrome for library editors (E1–E8).

## Purpose

Replaces the mk1 channel editor sticky header. Provides breadcrumb navigation, title, and optional subtitle without save actions (those live in `StickyFooter`).

## Props

| Prop            | Type              | Notes                                      |
| --------------- | ----------------- | ------------------------------------------ |
| `crumb`         | `string`          | Breadcrumb label (e.g. `"Channels"`)       |
| `crumbTo`       | `string`          | Router `Link` target for the crumb         |
| `onCrumbClick`  | `() => void`      | Button crumb when no `crumbTo`             |
| `title`         | `ReactNode`       | Main heading                               |
| `subtitle`      | `ReactNode`       | Optional supporting line                   |
| `compact`       | `boolean`         | Narrow padding and smaller title           |

## Usage

```tsx
<EditorHeader
  crumb="Channels"
  crumbTo="/library/channels"
  title={isNew ? 'New channel' : channel.name}
  subtitle={isNew ? 'Set up the identity, frequency and mode for this channel.' : 'FM + DMR · editing'}
  compact={isMobile}
/>
```

## Related

- [StickyFooter.md](./StickyFooter.md)
- [docs/features/library/README.md](../../../../docs/features/library/README.md)
