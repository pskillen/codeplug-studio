# AT-D890UV radio settings

**Tracking:** [#1393](https://github.com/pskillen/codeplug-studio/issues/1393) · fixes [#1394](https://github.com/pskillen/codeplug-studio/issues/1394)  
**Progress:** [at-d890uv-radio-settings-progress.md](at-d890uv-radio-settings-progress.md) · [outstanding](at-d890uv-radio-settings-outstanding.md)

Operators will be able to read and set the radio's general settings (key tone, backlight, power-on text, side-key functions, …) from Studio on both D890 targets. This page covers the **patch core** that all of it rests on. It ships no UI: nothing in the app sets an override yet.

## Model

- **Overrides are session state.** A setting is a typed override (`fieldId`, value) held in memory for the session. It is never stored in the project, IndexedDB or YAML, and never written unless the app passes it to a Write.
- **A Write applies no overrides by default.** With none, every transmitted byte is identical to a Write before this feature (pinned by a golden-frame test).
- **Patch on the fresh read.** Each override becomes a field patch (address, new bytes, bit mask) applied to the fresh read of erase unit `0x3500000` inside the Write's read-modify-write. Nothing replays a stored image. Which bytes may be patched is a code **allow-list** of registered fields; wire addresses are in the [tier-3 memory layout](../../reference/radios/anytone/at-d890uv/memory-layout.md). The allow-list is enforced again in the protocol (`upload()` and `uploadSettingsPatches`) before any frame, so a hand-built patch outside it is refused. A settings-only Write does not populate the in-session download cache; a later codeplug Write still downloads first.
- **MM9PDY step keys use the same mechanism.** The build's TG step-key switch (persisted, unchanged for users) now stands for two ordinary overrides, `keyShortP1` = 14 and `keyShortP2` = 13.
- **Two patches for one field throw before any frame.** There is no precedence rule.

## Behaviour

| Piece                 | What it does                                                                                                                                                                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preserved check       | A staged block outside the modelled set may differ from the fresh read only in patched bits; anything else aborts the Write before the first frame                                                                                                                            |
| Verify                | The cross-session "Preserved settings" compare expects each kept span to read `before ⊕ patches`. A step-key Write no longer reports a false FAIL ([#1394](https://github.com/pskillen/codeplug-studio/issues/1394)). Payloads stored before patches existed verify as before |
| Settings-only upload  | Writes only erase unit `0x3500000` with the patches applied, through the same RMW core (plausibility checks, marker filter, transmit fence, no `END` on failure). Needs no Download                                                                                           |
| Settings read         | Four reads (LocalInfo, settings main, power-on block, master ID) plus the ident band code; for the confirm step and the settings page                                                                                                                                         |
| Pause before transmit | After the in-session read and before the first `W` frame, a Write with overrides calls the app back with the radio's serial and settings and gets `apply`, `keep` or `cancel`. No callback means `keep`; `cancel` stops before any frame                                      |

## Decisions

- Overrides are **sparse typed field patches** applied to the fresh read, not a settings image.
- **Whole-region replay stays Restore-only.** The settings-only upload reuses the Write RMW core and never Restore's region replay.
- **Session-only** state; the default Write is unchanged.
- The persisted step-key switch is kept for now. It is to be replaced by a nudge that sets ordinary session overrides, so the code treats its two patches like any other.

## Not done / rejected

- Stored settings images, and per-radio settings profiles keyed by serial: they would copy one radio's settings onto another.
- Any field beyond the two short-press keys, any UI, the MM9PDY store at `+0x200`, LocalInfo writes, frequency range: later PRs.

## Radio checks (owner)

| Row | Check                                                                                                                             | State   |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------- |
| RS1 | MM9PDY target, TG step keys on: Write, power-cycle, Verify write passes (was FAIL); P1 = TG Next, P2 = TG Previous                | Pending |
| RS2 | Stock target, no settings: Write, Verify passes; five radio menu values unchanged (key tone, backlight, menu exit, language, TOT) | Pending |

Emulator evidence for the transmitted bytes is recorded in the PR; it is not a substitute for these rows.
