# ModalShell

Base overlay shell: icon + title header, scrollable body, optional footer, close button.

## Purpose

The structural foundation `ConfirmModal` and `ProgressModal` build on. Closes the design-system-v2 "biggest structural gap" flagged in the mk2 export — no generic modal shell existed before this; every dialog hand-composed Mantine `Modal` directly.

## Props

| Prop          | Type                                     | Notes                                                              |
| ------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| `open`        | `boolean`                                | Required                                                           |
| `onClose`     | `() => void`                             | Required                                                           |
| `title`       | `ReactNode`                              | Header title                                                       |
| `icon`        | `ReactNode`                              | Optional header icon (e.g. a Tabler icon element)                  |
| `iconTone`    | `'accent' \| 'warning' \| 'destructive'` | Default `accent`                                                   |
| `size`        | `'sm' \| 'md' \| 'lg'`                   | Default `md` (400/520/720px)                                       |
| `dismissible` | `boolean`                                | Default `true` — controls escape/backdrop/close-button             |
| `footer`      | `ReactNode`                              | Right-aligned action row                                           |
| `children`    | `ReactNode`                              | Scrollable body content                                            |
| `inline`      | `boolean`                                | Renders panel markup only, no Modal overlay/portal — for embedding |
| `className`   | `string`                                 | Optional root class                                                |

## Usage

```tsx
import { DesignSystemV2Provider, ModalShell } from '@app/components/v2';

<DesignSystemV2Provider>
  <ModalShell open onClose={() => setOpen(false)} title="Example">
    Body content
  </ModalShell>
</DesignSystemV2Provider>;
```

## Behaviour

- Must render inside `DesignSystemV2Provider`.
- Not dismissible while `dismissible={false}` — escape, backdrop click, and the close button all become no-ops.
- `inline` skips the Modal portal/overlay entirely — used for embedding the same panel markup elsewhere (e.g. a page section) rather than as a true dialog.
- Portals into `.dsv2-scope` (`portalProps={{ target: DSV2_SCOPE_SELECTOR }}`), not Mantine's default `document.body` target — `--dsv2-*` custom properties are scoped to `.dsv2-scope`, so a default-portaled Modal would render its panel with no background/text colour.
- Live demos: `/styleguide/v2/overlays`

## Related

- [ConfirmModal.md](./ConfirmModal.md)
- [ProgressModal.md](./ProgressModal.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
