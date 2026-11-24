# RadioIoProgressModal

## Purpose

Blocking modal during Web Serial **Read** / **Read into library** / **Restore** on a Direct radio FormatBuild. Codeplug and satellite-keps **Write** use the Write stepper and [`StageProgress`](../egress/StageProgress/StageProgress.md) instead. Shows coarse steps, a transfer progress bar (from existing `ProgressUpdate`), and a prominent keep-tab-open warning.

`operation: 'restore'` (#1140) replays a backup zip. Copy must not say “Writing codeplug.” There is no assemble step.

`operation: 'library-read'` shows **Save library and build changes** after transfer. The save runs to completion once started. The finished alert says **Library and build changes are saved.**

## Props

| Prop                | Type                                                                             | Description                                                                                                                                                                                                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `opened`            | `boolean`                                                                        | Show while an operation is in progress                                                                                                                                                                                                                                                                                       |
| `operation`         | `'read' \| 'library-read' \| 'restore' \| 'vital-read' \| 'safety-read'`         | Chooses step list and title                                                                                                                                                                                                                                                                                                  |
| `phase`             | `'connecting' \| 'preparing' \| 'transfer' \| 'saving' \| 'verifying' \| 'done'` | Active coarse phase                                                                                                                                                                                                                                                                                                          |
| `progress`          | `ProgressUpdate \| null`                                                         | Block-level progress during `transfer` (`msg`, optional `stage`) and during `preparing` when directory assemble reports `ProgressUpdate` (determinate bar + step detail)                                                                                                                                                     |
| `transferStages`    | `readonly string[]`                                                              | Checklist labels accumulated from `progress.stage`                                                                                                                                                                                                                                                                           |
| `plan`              | `readonly PlannedStage[]`                                                        | Stages the adapter declared before the transfer (`planForOperation`). Shows the whole list up front in a fixed-height [`RadioIoStageList`](./RadioIoStageList.md) with an overall bar and time remaining. Omitted: today's growing list. A label the adapter emits twice with other stages between appears twice in the plan |
| `navigationBlocked` | `boolean`                                                                        | Extra alert after an in-app navigation attempt                                                                                                                                                                                                                                                                               |
| `onCancel`          | `() => void`                                                                     | Abort the in-flight transfer                                                                                                                                                                                                                                                                                                 |
| `onClose`           | `() => void`                                                                     | Dismiss after `phase === 'done'`                                                                                                                                                                                                                                                                                             |
| `finishAction`      | `{ label, onClick }`                                                             | Optional button beside Close once the run finishes; Backup / Restore passes "Back to Export" after a Restore                                                                                                                                                                                                                 |
| `successNote`       | `string`                                                                         | Extra sentence under a successful **Restore finished** alert. The modal renders this string only; it has no radio-specific default                                                                                                                                                                                           |

## Usage

```tsx
<RadioIoProgressModal
  opened={busy}
  operation={operation}
  phase={phase}
  progress={progress}
  transferStages={transferStages}
  navigationBlocked={navBlockedHint}
  onCancel={handleCancel}
  onClose={handleProgressClose}
/>
```

## Behaviour

- **Planned stages (#1393):** with `plan`, the transfer rows are the plan's labels in order (a stage the adapter emits that the plan did not name is appended, never dropped), the first planned stage is current before any event arrives, and the list sits in a fixed-height box so nothing under it moves. Weights come from the plan. **Progress never goes backwards:** each event is mapped onto the plan by a cursor (`radioIoStageCursor.ts`). A label the adapter re-emits maps to the next occurrence the plan declares after the current row, and a label that only occurs earlier is ignored (stale). `cur` restarting on the current row is the next `passes` of that stage. Events at `cur` 0 move the cursor only to the next row and only once the current row has finished, which ignores the DM-32UV "Queued" seed burst. `coarse` stages (D890 download, where `cur` is the stage index) show no per-step bar. When the Write finishes the plan rows stay (all done) above the post-upload rows, so the list does not shrink. Without `plan` (Read, Restore and keps writes today) the list grows as before.
- Modal cannot be dismissed via escape, overlay click, or close button while transferring — only **Cancel** (parent aborts). On success (`phase === 'done'`), **Close** dismisses so the operator can review the checklist.
- Parent should pair with `useUnsavedNavigationGuard(busy)` + `beforeunload` so route changes and tab close are blocked while open.
- When adapters emit `ProgressUpdate.stage`, the parent appends unique labels to `transferStages` so the checklist grows (Read: Discover memory map → Channels → Zones → …).
- **`successNote`:** shown only after **Restore finished**. Hidden while connecting, preparing, or transferring; hidden for Read and keps-write; hidden when the caller omits it. DM-32 Restore may pass the power-cycle sentence.

## Related

- [BuildRadioIoPanel.md](./BuildRadioIoPanel.md)
- [adding-a-radio-adapter.md](../../../docs/features/radio-read-write/adding-a-radio-adapter.md)
- [Read into library](../../../../docs/features/radio-read-write/read-into-library.md)
