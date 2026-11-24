# StageProgress

Unified progress list for radio read, write, restart wait, and check.

## Purpose

Shows one pattern for every transfer inside export and write dialogs: an overall bar, elapsed time, an optional time-left estimate, group headings when several phases run in one step, and the planned stage list (or a growing list when the radio declares no plan).

## Props

| Prop               | Type                      | Notes                                              |
| ------------------ | ------------------------- | -------------------------------------------------- |
| `groups`           | `StageProgressGroup[]`    | Rows per phase; optional `title`                   |
| `progress`         | `ProgressUpdate \| null`  | Latest event from the radio session                |
| `startedAt`        | `number \| null`          | Run start (ms) for elapsed                         |
| `estimateSeconds`  | `number \| null`          | Shown after 2 s while `running`                    |
| `running`          | `boolean`                 | Ticks elapsed; drives estimates                  |
| `lead`             | `ReactNode`               | Intro line above the bar                           |
| `testId`           | `string`                  | Root `data-testid`; default `stage-progress`     |

## Usage

```tsx
<StageProgress
  lead={<>Connecting to {radioLabel} and reading it…</>}
  groups={[{ id: 'read', rows: view.readRows }]}
  progress={view.progress}
  startedAt={view.readStartedAt}
  running={view.busy}
/>
```

## Behaviour

- Overall progress weights every row that has a `weight` across all groups.
- `RadioIoStageList` renders each group with `hideOverall` (row icons and in-stage bars only).
- Pending planned rows are dimmed until the first row leaves `pending`.
- Headings render only when `groups.length > 1` and the group has a `title`.
- Elapsed updates every second while `running`; stays visible when the run ends.
- Optional `bytes` / `bytesPerSecond` on a progress update show under the meta line when present.

## Related

- [RadioIoStageList.md](../../builds/RadioIoStageList.md)
- [docs/features/radio-read-write/README.md](../../../../docs/features/radio-read-write/README.md)