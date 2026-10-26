# RadioIoProgressModal

## Purpose

Blocking modal during Web Serial **Read** / **Write** / **Keps write** / **Restore** on a Direct radio FormatBuild. Shows coarse steps, a transfer progress bar (from existing `ProgressUpdate`), and a prominent keep-tab-open warning. Does not change radio adapter code.

Reused as-is for satellite-keps writes (#859, Workflow A + B) — `operation: 'keps-write'` gets its own step list/title distinct from codeplug `'write'` (no "assemble channels into image" step, no write-verify concept), while sharing the same modal shell, progress bar, and cancel/navigation-guard behaviour.

`operation: 'restore'` (#1140) replays a backup zip. Copy must not say “Writing codeplug.” There is no assemble step.

## Props

| Prop                            | Type                                                                             | Description                                                                                                                                                                                                                                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `opened`                        | `boolean`                                                                        | Show while an operation is in progress                                                                                                                                                                                                                                                                                       |
| `operation`                     | `'read' \| 'write' \| 'keps-write' \| 'restore'`                                 | Chooses step list and title                                                                                                                                                                                                                                                                                                  |
| `phase`                         | `'connecting' \| 'preparing' \| 'transfer' \| 'saving' \| 'verifying' \| 'done'` | Active coarse phase                                                                                                                                                                                                                                                                                                          |
| `progress`                      | `ProgressUpdate \| null`                                                         | Block-level progress during `transfer` (`msg`, optional `stage`) and during `preparing` when directory assemble reports `ProgressUpdate` (determinate bar + step detail)                                                                                                                                                     |
| `transferStages`                | `readonly string[]`                                                              | Checklist labels accumulated from `progress.stage`                                                                                                                                                                                                                                                                           |
| `plan`                          | `readonly PlannedStage[]`                                                        | Stages the adapter declared before the transfer (`planForOperation`). Shows the whole list up front in a fixed-height [`RadioIoStageList`](./RadioIoStageList.md) with an overall bar and time remaining. Omitted: today's growing list. A label the adapter emits twice with other stages between appears twice in the plan |
| `navigationBlocked`             | `boolean`                                                                        | Extra alert after an in-app navigation attempt                                                                                                                                                                                                                                                                               |
| `writeVerifyStatus`             | `'none' \| 'unverified' \| 'verifying' \| 'verified' \| 'failed'`                | Optional post-Write check. Default `'none'`                                                                                                                                                                                                                                                                                  |
| `requiresCrossSessionReconnect` | `boolean`                                                                        | When unverified, chooses the restart-wait sentence vs “Click Verify write”. Default `true`. The modal does not reconnect                                                                                                                                                                                                     |
| `verifyButtonEnabled`           | `boolean`                                                                        | Enables **Verify write** after the brief post-write lockout. Default `true`                                                                                                                                                                                                                                                  |
| `onVerify`                      | `() => void`                                                                     | Start optional verify                                                                                                                                                                                                                                                                                                        |
| `onCloseWithoutVerify`          | `() => void`                                                                     | Dismiss after Write without running verify                                                                                                                                                                                                                                                                                   |
| `onCancel`                      | `() => void`                                                                     | Abort the in-flight transfer                                                                                                                                                                                                                                                                                                 |
| `onClose`                       | `() => void`                                                                     | Dismiss after `phase === 'done'` (Write stays open until Close)                                                                                                                                                                                                                                                              |
| `successNote`                   | `string`                                                                         | Extra sentence under a successful Write or Restore alert. The modal renders this string only; it has no radio-specific default                                                                                                                                                                                               |

## Usage

```tsx
<RadioIoProgressModal
  opened={busy}
  operation={operation}
  phase={phase}
  progress={progress}
  transferStages={transferStages}
  navigationBlocked={navBlockedHint}
  writeVerifyStatus={writeVerifyStatus}
  onVerify={handleVerify}
  onCloseWithoutVerify={handleCloseWithoutVerify}
  onCancel={handleCancel}
  onClose={handleProgressClose}
/>
```

## Behaviour

- **Planned stages (#1393):** with `plan`, the transfer rows are the plan's labels in order (a stage the adapter emits that the plan did not name is appended, never dropped), the first planned stage is current before any event arrives, and the list sits in a fixed-height box so nothing under it moves. Weights come from the plan. **Progress never goes backwards:** each event is mapped onto the plan by a cursor (`radioIoStageCursor.ts`). A label the adapter re-emits maps to the next occurrence the plan declares after the current row, and a label that only occurs earlier is ignored (stale). `cur` restarting on the current row is the next `passes` of that stage. Events at `cur` 0 move the cursor only to the next row and only once the current row has finished, which ignores the DM-32UV "Queued" seed burst. `coarse` stages (D890 download, where `cur` is the stage index) show no per-step bar. When the Write finishes the plan rows stay (all done) above the post-upload rows, so the list does not shrink. Without `plan` (Read, Restore and keps writes today) the list grows as before.
- Modal cannot be dismissed via escape, overlay click, or close button while transferring — only **Cancel** (parent aborts). On success (`phase === 'done'`), **Close** dismisses so the operator can review the checklist (especially Write).
- Parent should pair with `useUnsavedNavigationGuard(busy)` + `beforeunload` so route changes and tab close are blocked while open.
- When adapters emit `ProgressUpdate.stage`, the parent appends unique labels to `transferStages` so the checklist grows (Read: Discover memory map → Channels → Zones → …; Write: Channels → Zones → Scan lists → …; OpenGD77 Write: **Pre-write read** → **FLASH sectors**; UV-17Pro family Write: **Pre-write read** → **Upload**).
- **Write assemble:** when `phase === 'preparing'` and the parent passes `progress` (e.g. paging a large RadioID directory shadow), the modal shows a determinate bar and `progress.msg` as the preparing-step detail ([#1247](https://github.com/pskillen/codeplug-studio/issues/1247)).
- **Write verify:** when `writeVerifyStatus === 'unverified'`, the done state shows a calm alert with **Verify write** and **Skip verify**. `requiresCrossSessionReconnect` selects the body: wait for the normal screen, or “Click Verify write” when the radio does not restart. Verify failure names the report; mismatch rows are not listed in this modal.
- **`successNote`:** shown only after a successful finish — Write when `phase === 'done'` and `writeVerifyStatus` is `none`, `unverified`, or `verified` (including the “Click Verify write” alert), and Restore when **Restore finished** is shown. Hidden while connecting, preparing, or transferring; hidden on verify-failed; hidden for Read and keps-write; hidden when the caller omits it. DM-32 stock and MM9PDY Write and Restore pass the power-cycle sentence. Other radios omit it.

## Related

- [BuildRadioIoPanel.md](./BuildRadioIoPanel.md)
- [adding-a-radio-adapter.md](../../../docs/features/radio-read-write/adding-a-radio-adapter.md)
