# RadioIoProgressModal

## Purpose

Blocking modal during Web Serial **Read** / **Write** / **Keps write** / **Restore** on a Direct radio FormatBuild. Shows coarse steps, a transfer progress bar (from existing `ProgressUpdate`), and a prominent keep-tab-open warning. Does not change radio adapter code.

Reused as-is for satellite-keps writes (#859, Workflow A + B) — `operation: 'keps-write'` gets its own step list/title distinct from codeplug `'write'` (no "assemble channels into image" step, no write-verify concept), while sharing the same modal shell, progress bar, and cancel/navigation-guard behaviour.

`operation: 'restore'` (#1140) replays a backup zip. Copy must not say “Writing codeplug.” There is no assemble step.

## Props

| Prop                   | Type                                                                             | Description                                                      |
| ---------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `opened`               | `boolean`                                                                        | Show while an operation is in progress                           |
| `operation`            | `'read' \| 'write' \| 'keps-write' \| 'restore'`                                 | Chooses step list and title                                      |
| `phase`                | `'connecting' \| 'preparing' \| 'transfer' \| 'saving' \| 'verifying' \| 'done'` | Active coarse phase                                              |
| `progress`             | `ProgressUpdate \| null`                                                         | Block-level progress during `transfer` (`msg`, optional `stage`) |
| `transferStages`       | `readonly string[]`                                                              | Checklist labels accumulated from `progress.stage`               |
| `navigationBlocked`    | `boolean`                                                                        | Extra alert after an in-app navigation attempt                   |
| `writeVerifyStatus`    | `'none' \| 'unverified' \| 'verifying' \| 'verified' \| 'failed'`                | AT-D890 optional post-Write preserved-settings check             |
| `verifyMismatches`     | `readonly { id: string; label: string }[]`                                       | Named regions when verify fails                                  |
| `onVerify`             | `() => void`                                                                     | Start optional verify (AT-D890)                                  |
| `onCloseWithoutVerify` | `() => void`                                                                     | Dismiss after Write without running verify                       |
| `onCancel`             | `() => void`                                                                     | Abort the in-flight transfer                                     |
| `onClose`              | `() => void`                                                                     | Dismiss after `phase === 'done'` (Write stays open until Close)  |

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

- Modal cannot be dismissed via escape, overlay click, or close button while transferring — only **Cancel** (parent aborts). On success (`phase === 'done'`), **Close** dismisses so the operator can review the checklist (especially Write).
- Parent should pair with `useUnsavedNavigationGuard(busy)` + `beforeunload` so route changes and tab close are blocked while open.
- When adapters emit `ProgressUpdate.stage`, the parent appends unique labels to `transferStages` so the checklist grows (Read: Discover memory map → Channels → Zones → …; Write: Channels → Zones → Scan lists → …).
- **AT-D890 Write verify:** when `writeVerifyStatus === 'unverified'`, done state shows a calm alert with optional **Check preserved settings** and **Close**. Checking waits for the radio to restart on its own after commit, then reconnects and diffs never-write regions.

## Related

- [BuildRadioIoPanel.md](./BuildRadioIoPanel.md)
- [adding-a-radio-adapter.md](../../../docs/features/radio-read-write/adding-a-radio-adapter.md)
