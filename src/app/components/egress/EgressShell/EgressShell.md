# EgressShell

Shared modal frame for export and write dialogs.

## Purpose

One dialog shell for every egress flow: a title, a counted step header, the v2 `Stepper`, an optional error panel and
notice, the keep-screen-on hint while a transfer runs, and the step body in the footer slot.

## Props

| Prop           | Type              | Notes                                                |
| -------------- | ----------------- | ---------------------------------------------------- |
| `open`         | `boolean`         | Modal visibility                                     |
| `title`        | `string`          | Header title                                         |
| `onClose`      | `() => void`      | Dismiss handler                                      |
| `dismissible`  | `boolean`         | Overlay/Escape/close while false during transfer   |
| `steps`        | `EgressStep[]`    | Step bar; skipped steps are not counted in the header |
| `busy`         | `boolean`         | Transfer in flight (wake lock + hint)                |
| `error`        | `ReactNode`       | Usually `ErrorPanel`                                 |
| `notice`       | `ReactNode`       | Quiet return line above the body                     |
| `footer`       | `ReactNode`       | Step actions                                         |
| `children`     | `ReactNode`       | Step body                                            |

## Usage

```tsx
<EgressShell
  open={view.open}
  title={`Write radio · ${config.options.radioLabel}`}
  onClose={actions.onClose}
  dismissible={!view.busy}
  steps={writeSteps(view, config.options)}
  busy={view.busy}
  error={view.errorOutcome ? <ErrorPanel … /> : null}
  notice={view.notice}
  footer={footer}
>
  {body}
</EgressShell>
```

## Behaviour

- Header shows `n of m · label` where `m` counts only steps whose status is not `skipped`.
- Renders v2 `Stepper` with the same steps (including skipped markers).
- Holds a screen wake lock while `open && busy`; shows the keep-screen-on hint when the lock is not held.

## Related

- [docs/features/radio-read-write/README.md](../../../../../docs/features/radio-read-write/README.md)
- [RadioWriteStepper.md](../../builds/RadioWriteStepper/RadioWriteStepper.md)