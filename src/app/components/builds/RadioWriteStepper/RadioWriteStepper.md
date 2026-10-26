# RadioWriteStepper

## Purpose

The Write dialog for every Web Serial radio (#1393, workflow design §2): one ModalShell with six steps, replacing the old Write popup (`WriteRadioModal`) and the progress modal for Write.

| #   | Step            | What happens                                                                                                                                                                                                                                                    |
| --- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | What to write   | One tick per part (Codeplug, Digital contacts, Satellite keps; Radio settings arrives with the D890 settings work). Options show only under ticked parts. Rows a radio does not support are not shown. Button **Connect & read**, disabled with nothing ticked. |
| 2   | Read            | Port picker, then the in-session read every Write already did, with the planned stage list. Ends with the radio's identity (model, serial last four, name and firmware where known).                                                                            |
| 3   | Review          | Always shown. Identity, "N channels will be written", contacts and keps counts, "About M min S s". Primary **Write codeplug / Write codeplug + contacts / Write 3 parts**; secondary **Cancel** (nothing is written).                                           |
| 4   | Writing         | The full planned list (`RadioIoStageList`), abortable.                                                                                                                                                                                                          |
| 5   | Restart & check | "Waiting for the radio to restart (about 20 s)", then optional **Check write** and, when keps could not share the codeplug's session, **Write keps**.                                                                                                           |
| 6   | Done            | What was written, warnings, whether the check ran. **Write another radio** (back to step 2, same ticks, fresh port prompt) and **Close**.                                                                                                                       |

The component is presentational. [`useRadioWriteFlow`](./useRadioWriteFlow.tsx) owns the state machine and the service calls and hands this component a `view` and `actions`; `BuildRadioIoPanel` wires them.

## Props

| Prop      | Type                 | Description                                                                                                                                                                      |
| --------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config`  | `WriteStepperConfig` | Static facts: radio label, which part rows exist (`support`), summaries, the MM9PDY step-key switch (`stepKeys`), restart wait, whether a check exists, an optional success note |
| `view`    | `WriteFlowView`      | Current step, ticks, progress, rows, identity, review data, restart countdown, check status, summary                                                                             |
| `actions` | `WriteFlowActions`   | Callbacks for every button                                                                                                                                                       |

## Usage

```tsx
const flow = useRadioWriteFlow({ build, egress, descriptor, activeProjectId /* … */ });
<RadioWriteStepper config={config} view={flow.view} actions={flow.actions} />;
// flow.open() opens the dialog at step 1 with the defaults (codeplug ticked).
```

## Behaviour

- **Parts map to today's services.** Codeplug (with or without contacts) and contacts alone go through one `prepareRadioWriteImage` + `uploadPreparedRadioWrite` session: codeplug ticked means mode `codeplug` with the chosen contact source; contacts alone means `digitalIdList`. Keps use the keps adapter. No frame differs from the old buttons.
- **Held session, pause before transmit.** The session stays open from the read to the write. `uploadPreparedRadioWrite` calls `beforeTransmit` after the read and before the first frame; Review is that pause. Cancel rejects it: no `W` frame is sent and the session is closed the way a read-only session is (Studio still sends `END`, so the radio is usable again by itself).
- **Hold time.** `RadioDescriptor.programHoldSafeMs` (AT-D890UV `Infinity`; others unset, treated as 30 s). If Review has been open longer when Write is pressed, the stepper reconnects and re-reads (step 2, "Reconnecting: the radio may have left programming mode") and then writes. If the read fails before any frame, the error offers **Reconnect and read again**.
- **Keps.** On the AT-D890UV keps are written in the codeplug's session after `upload()` and before `END`, with no restart step. On OpenGD77 `upload()` ends with SAVE_REBOOT, so keps wait for step 5 and use a new session (new port prompt, as Check write does).
- **Step-key switch.** Still present under the Codeplug part on MM9PDY targets (removed for the AT-D890UV in a later PR; the DM-32 MM9PDY target keeps it).
- Leaving the page drops the session. The dialog cannot be dismissed while a transfer runs.

## Related

- [`WritePartRow`](./WritePartRow.md), [`reviewSections`](./reviewSections.md)
- [`RadioIoStageList`](../RadioIoStageList.md)
- [`BuildRadioIoPanel`](../BuildRadioIoPanel.md)
- [radio-read-write hub](../../../../../docs/features/radio-read-write/README.md)
