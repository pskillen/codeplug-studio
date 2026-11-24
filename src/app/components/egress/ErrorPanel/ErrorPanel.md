# ErrorPanel

## Purpose

Shows a radio or Write dialog error with a consistent layout: what reached the radio, the message, an optional retry button, optional escape actions, and Debug details on every error.

## Props

| Prop         | Type                | Description                                                                 |
| ------------ | ------------------- | --------------------------------------------------------------------------- |
| `outcome`    | `WriteErrorOutcome` | Classified error (`kind: 'error'` only; cancelled outcomes render nothing). |
| `retryLabel` | `string \| null`    | From `retryLabelFor`; no button when null.                                  |
| `onRetry`    | `() => void`        | Retry handler; paired with `retryLabel`.                                    |
| `wayOut`     | `ReactNode`         | Extra actions (pending-units clear, Change the ticks, …).                   |
| `testId`     | `string`            | Root test id (default `error-panel`); debug block uses `${testId}-debug`.   |

## Usage

```tsx
<ErrorPanel
  outcome={errorOutcome}
  retryLabel={retryLabel}
  onRetry={onRetry}
  testId="write-stepper-error"
/>
```

## Behaviour

- Title comes from `outcome.sent`; chip text from `sentStateLabel`.
- Copy debug text puts `message` and `debugText` on the clipboard.
- Does not decide retry wording itself.

## Related

- [Radio read & write](../../../../docs/features/radio-read-write/README.md)
- `src/app/services/egress/writeErrorOutcome.ts`
