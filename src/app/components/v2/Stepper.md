# Stepper

Step indicator for multi-step flows.

## Purpose

Shows where the operator is in a wizard: which steps are done, which is current, and which failed. It is
presentational: it renders an ordered list and has no navigation or state of its own. The page owns the steps.

## Props

| Prop          | Type                                                                                   | Notes                         |
| ------------- | -------------------------------------------------------------------------------------- | ----------------------------- |
| `steps`       | `{ id: string; label: string; status: 'pending' \| 'current' \| 'done' \| 'error' }[]` | In display order              |
| `orientation` | `'horizontal' \| 'vertical'`                                                           | Default `horizontal`          |
| `ariaLabel`   | `string`                                                                               | Nav label; default `Progress` |
| `className`   | `string`                                                                               | Extra class on the list       |

## Usage

```tsx
<Stepper
  ariaLabel="Firmware flasher steps"
  steps={[
    { id: 'radio', label: 'Radio', status: 'done' },
    { id: 'firmware', label: 'Firmware', status: 'current' },
    { id: 'flash', label: 'Flash', status: 'pending' },
  ]}
/>
```

## Behaviour

- Renders `<nav aria-label>` around an `<ol>`; the current step has `aria-current="step"`.
- Markers show the step number, a check when done, or a cross on error.
- Horizontal steps wrap on narrow viewports.
- Must render inside `DesignSystemV2Provider`. Live demo: `/styleguide/navigation`.

## Related

- [ProgressModal.md](./ProgressModal.md) — step list for a running operation
- [docs/features/firmware-flashing/README.md](../../../../docs/features/firmware-flashing/README.md) — first user
