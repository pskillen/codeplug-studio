# RestartCountdown

## Purpose

The "radio is restarting" line and the deadline timer behind it. A radio that restarts after `END` (the AT-D890UV)
needs the user to wait; this shows how long and when to carry on. Shared by the Write stepper's step 5 and the
Danger zone's Change frequency range (steps 6 and 8).

## Props

| Prop           | Type     | Description                                                                      |
| -------------- | -------- | -------------------------------------------------------------------------------- |
| `secondsLeft`  | `number` | Seconds left. At zero the `doneText` line shows instead.                         |
| `totalSeconds` | `number` | The starting wait, shown as "about N s".                                         |
| `doneText`     | `string` | Optional. Default "Wait until the radio shows its normal screen, then continue." |
| `waitingText`  | `string` | Optional. Default "Waiting for the radio to restart".                            |
| `data-testid`  | `string` | On the counting line only.                                                       |

## `useRestartCountdown()` (`useRestartCountdown.ts`)

Returns `{ secondsLeft, start(seconds), clear() }`. The count comes from a deadline (`Date.now()`), so a background
tab does not stall it. The flow hook owns it, not the component, so the flow can enable a button at zero.

## Usage

```tsx
const countdown = useRestartCountdown();
countdown.start(20);
<RestartCountdown secondsLeft={countdown.secondsLeft} totalSeconds={20} />;
```
