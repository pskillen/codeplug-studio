# RadioIoStageList

## Purpose

Fixed-height list of transfer steps with an overall progress bar and a time-remaining estimate (#1393, workflow design §2.5). The caller passes every step up front, so the user sees the whole plan before the first byte moves. The list never changes height as steps advance: it scrolls inside a fixed box and keeps the current step in view, so the bar above and the buttons below stay put. Used by [`RadioIoProgressModal`](./RadioIoProgressModal.md) when an adapter declared a plan; the Write stepper reuses it.

## Props

| Prop          | Type                     | Description                                                                                                                                                                                 |
| ------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rows`        | `readonly StageRow[]`    | `{ id, label, status: 'pending' \| 'active' \| 'success' \| 'error', detail?, weight?, optional? }`. `weight` is the planned bytes for the step; rows without one are shown but not counted |
| `progress`    | `ProgressUpdate \| null` | Latest adapter event; `cur / max` drives the current step's small bar                                                                                                                       |
| `startedAt`   | `number`                 | When the operation began (ms). The estimate waits 2 s after it. Defaults to mount time                                                                                                      |
| `hideOverall` | `boolean`                | Hide the overall bar and estimate                                                                                                                                                           |

## Usage

```tsx
<RadioIoStageList rows={rows} progress={progress} startedAt={startedAt} />
```

Inside a `ProgressModal`, pass it as `body` (which replaces the default bar and step list).

## Behaviour

- Rows: done (check), current (spinner plus a small per-step bar), pending (dashed circle). About eight rows are visible; more scroll (`max-height` with `overflow-y: auto`, set inline so tests can measure it).
- Overall bar: `(done weights + current weight × cur/max) / total weight`. A step's share never goes backwards if the adapter re-enters it with a smaller fraction. An `optional` row that was passed without ever being current is dropped from the total.
- Estimate: weight per second as an exponential moving average (time constant about 5 s) over progress events. "About N min M s left" appears after 2 s of progress; it is empty when the weight total is 0, the rate is unknown, and never negative or `NaN`.
- Arithmetic lives in `radioIoStageProgress.ts` (pure, takes `now`), tested without React.

## Related

- [RadioIoProgressModal.md](./RadioIoProgressModal.md)
- [protocol-kit-architecture.md](../../../docs/features/radio-read-write/protocol-kit-architecture.md) (planned stages)
- [adding-a-radio-adapter.md](../../../docs/features/radio-read-write/adding-a-radio-adapter.md)
