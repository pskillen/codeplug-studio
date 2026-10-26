# AT-D890UV radio settings

**Tracking:** [#1393](https://github.com/pskillen/codeplug-studio/issues/1393) · fixes [#1394](https://github.com/pskillen/codeplug-studio/issues/1394)  
**Progress:** [at-d890uv-radio-settings-progress.md](at-d890uv-radio-settings-progress.md) · [outstanding](at-d890uv-radio-settings-outstanding.md)

Operators will be able to read and set the radio's general settings (key tone, backlight, power-on text, side-key functions, …) from Studio on both D890 targets. This page covers the **patch core** that all of it rests on and the **v1 field set** with its session store. It ships no UI: nothing in the app sets an override yet.

## Model

- **Overrides are session state.** A setting is a typed override (`fieldId`, value) held in memory for the session. It is never stored in the project, IndexedDB or YAML, and never written unless the app passes it to a Write.
- **A Write applies no overrides by default.** With none, every transmitted byte is identical to a Write before this feature (pinned by a golden-frame test).
- **Patch on the fresh read.** Each override becomes a field patch (address, new bytes, bit mask) applied to the fresh read of erase unit `0x3500000` inside the Write's read-modify-write. Nothing replays a stored image. Which bytes may be patched is a code **allow-list** of registered fields; wire addresses are in the [tier-3 memory layout](../../reference/radios/anytone/at-d890uv/memory-layout.md). The allow-list is enforced again in the protocol (`upload()` and `uploadSettingsPatches`) before any frame, so a hand-built patch outside it is refused. A settings-only Write does not populate the in-session download cache; a later codeplug Write still downloads first.
- **MM9PDY step keys use the same mechanism.** The build's TG step-key switch (persisted, unchanged for users) now stands for two ordinary overrides, `keyShortP1` = 14 and `keyShortP2` = 13.
- **Two patches for one field throw before any frame.** There is no precedence rule.

## Fields (v1)

Every v1 field has a typed value list in `src/core/radios/anytone/at-d890uv/radioSettings.ts`, an allow-listed spec (address, mask, encode and decode) and a decode from a settings read. Groups, in display order:

- **Call display:** call display mode, call sign colour, last caller, talker-alias priority and TX format, current contact and channel number on standby, channel type, time slot and colour code on the channel line.
- **Start-up:** power-on screen (default picture or text), the two text lines, start-up tone, start-up volume (fixed level or last knob position).
- **Volume and audio:** volume bar, maximum volume and headphone volume, audio profile (including the hidden Indoor and Outdoor), noise reduction, DRC, microphone gains.
- **Tones:** key tone, talk permit, call reset, idle tones, SMS and call alerts.
- **Display:** channel name or frequency, backlight level and timeout, menu exit time, colours, standby background, night mode, clock, date format, time zone.
- **Keys:** short and long press for PF1, PF2, PF3, P1 and P2 (65 functions, MM9PDY names on the MM9PDY target), long-press time.
- **Power and timers:** auto power-off and its type, TX timeout and pre-alert, power save.
- **DMR:** hang times, analogue call hold, preamble, voice header repeats, SMS format, own-ID missed-call filter.

Studio offers the range the **firmware** honours, not always the CPS's: for example call display mode has two values (the radio resets "Name based" at power-on), the audio profile has four, and the call sign colour has a hidden black. A value the radio holds that Studio does not offer (a custom start-up picture, for instance) is read and shown but cannot be set. Wire detail, clamps and the fields not offered: [optional-settings.md](../../reference/radios/anytone/at-d890uv/optional-settings.md).

## Session store

`atD890RadioSettingsSession` holds, per build and in memory only: the overrides, the last settings Read of a radio (identity, band code, language lock and every decoded field) and the fleet-write tick. A Read fills the "radio" column and **sets no override**; copying every readable value into overrides is an explicit action. Nothing touches the build, `exportSettings`, IndexedDB, localStorage or YAML, and a page refresh empties it.

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
- Any UI, the advanced fields (language, password, professional mode, repeater mode, remote features, encryption type, limits), the start-up channel, the key-lock scope (bits not settled), the MM9PDY store at `+0x200`, LocalInfo writes, frequency range: later PRs.
- Fields the CPS offers but the firmware never reads, and the Bluetooth test mode: never offered.

## Radio checks (owner)

| Row | Check                                                                                                                             | State   |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------- |
| RS1 | MM9PDY target, TG step keys on: Write, power-cycle, Verify write passes (was FAIL); P1 = TG Next, P2 = TG Previous                | Pending |
| RS2 | Stock target, no settings: Write, Verify passes; five radio menu values unchanged (key tone, backlight, menu exit, language, TOT) | Pending |

| RS8 | DMR call with a talker alias: call display mode 0 vs 1 shows what the page says. Then set "Name Based" with the official CPS, power-cycle, read back in Studio: the value is 0 | Pending |
| RS8b | Last caller 1 (ID), 2 (callsign), 3 (both) on a received call: the line matches the labels | Pending |
| RS8c | Channel line extras on a DMR channel: time slot and colour code bits show the right item | Pending |
| RS8d | Power-on text with 14 characters on both lines: small font, no spill into the other line or the password block | Pending |
| RS8e | TX preamble 5 against 40 on air or with a monitor: 300 ms against 2400 ms (Studio does not offer 0..4, which the radio treats as 5) | Pending |
| RS8f | Backlight timeout entries 13 and 14: time them; Studio labels them 3 min and 4.5 min from the radio's timeout table | Pending |

Emulator evidence for the transmitted bytes is recorded in the PR; it is not a substitute for these rows.
