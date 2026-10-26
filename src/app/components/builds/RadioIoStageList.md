# RadioIoStageList

## Purpose

Fixed-height list of transfer steps with an overall progress bar and a time-remaining estimate (#1393, workflow design §2.5). The caller passes every step up front, so the user sees the whole plan before the first byte moves. The list never changes height as steps advance: it scrolls inside a fixed box and keeps the current step in view, so the bar above and the buttons below stay put. Used by [`RadioIoProgressModal`](./RadioIoProgressModal.md) when an adapter declared a plan; the Write stepper reuses it.

## Props

| Prop          | Type                     | Description                                                                                                                                                                                                                                                                                                                      |
| ------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rows`        | `readonly StageRow[]`    | `{ id, label, status: 'pending' \| 'active' \| 'success' \| 'error', detail?, weight?, optional?, fraction?, coarse? }`. `weight` is the planned bytes for the step; rows without one are shown but not counted. `fraction` is a held 0..1 share for the current row (from the stage cursor); `coarse` rows have no per-step bar |
| `progress`    | `ProgressUpdate \| null` | Latest adapter event; `cur / max` drives the current step's small bar                                                                                                                                                                                                                                                            |
| `hideOverall` | `boolean`                | Hide the overall bar and estimate                                                                                                                                                                                                                                                                                                |

## Usage

```tsx
<RadioIoStageList rows={rows} progress={progress} />
```

Inside a `ProgressModal`, pass it as `body` (which replaces the default bar and step list).

## Behaviour

- Rows: done (check), current (spinner plus a small per-step bar), pending (dashed circle). About eight rows are visible; more scroll (`max-height` with `overflow-y: auto`, set inline so tests can measure it).
- Overall bar: `(done weights + current weight × fraction) / total weight`. The current row's fraction is the held `fraction` when given (the progress window supplies it from the stage cursor), otherwise `cur / max` of the latest event; either way a row's share never decreases. The overall bar therefore only moves forward, except that an `optional` row passed without ever being current drops out of the total (which can only raise it).
- The current row keeps its place when an adapter re-emits an earlier label; that mapping is [`radioIoStageCursor.ts`](./radioIoStageCursor.ts) (see [RadioIoProgressModal.md](./RadioIoProgressModal.md)). The current row sits about a third from the top of the list so the next steps stay visible; only the list scrolls, never the modal or page.
- Estimate: weight per second as an exponential moving average (time constant about 5 s), sampled only when done weight moves and measured over the time since it last moved, so a long read between sparse events counts as slow progress rather than decaying the rate. When done weight has not moved for 2 s the whole-run average rate is used instead. "About N min M s left" appears 2 s after the **first progress event** (not after the window opened); it is empty when the weight total is 0 or the rate is unknown, and never negative or `NaN`.
- Arithmetic lives in `radioIoStageProgress.ts` (pure, takes `now`), tested without React.

## Related

- [RadioIoProgressModal.md](./RadioIoProgressModal.md)
- [protocol-kit-architecture.md](../../../docs/features/radio-read-write/protocol-kit-architecture.md) (planned stages)
- [adding-a-radio-adapter.md](../../../docs/features/radio-read-write/adding-a-radio-adapter.md)
