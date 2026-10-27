# Danger zone

Rare jobs that change the radio itself rather than its codeplug. The first is the AT-D890UV **frequency range**
change ([#1369](https://github.com/pskillen/codeplug-studio/issues/1369)): the one byte (LocalInfo `+0x03`) that
decides which frequencies the radio will transmit on. The official CPS cannot change it, and a change wipes the
radio's channels and settings at the next boot, so the tool is built around a saved backup and a recovery path.

The Danger zone lives under a build's **Export**, because the Web Serial egress is the door to a radio. Its tools are
not Write, Restore or Backup, and none of those can reach them.

## Rules

The constitution is [DESIGN.md — Danger zone](../../../DESIGN.md#danger-zone). In short:

1. A tool runs only from its own wizard.
2. Backup first, checked: refuse to touch the radio until the user has ticked "I've saved both files".
3. One guarded send path per tool, as narrow as the change; hard interlocks are code with a refusal test each.
4. "Nothing has changed" at every exit before the first write; a resumable recovery after it.
5. No feature flag: the owner tests each tool on a radio, on pre-prod builds, before a release carries it.

Agent rules: [.claude/rules/danger-zone.md](../../../.claude/rules/danger-zone.md).

## Implementation status

| Piece                                                              | Status             | Notes                                                                                 |
| ------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------- |
| Range-change engine (core rules, frame, sender, session, verifier) | Shipped            | The "Engine" section below                                                            |
| Danger zone area (page, registry, entry points, nav)               | Shipped            | PR 3 of #1369. **Start…** opens the wizard                                            |
| Change frequency range wizard                                      | Shipped (pre-prod) | PR 4 of #1369, "The wizard" below. Not yet checked on a radio (RT-1 to RT-15 pending) |

## The area

- **Route:** `/builds/:id/export/danger-zone` (`BuildDangerZonePage`). It sits under a build because the build's Web Serial egress is the only door to a radio today. It is **not** a strip tab, a Write stepper step or a Backup page action: `activeBuildSection` maps it (and anything below it) to Export, so the Export tab stays lit.
- **Page:** title **Danger zone**, a fixed red strap ("These change the radio itself. A Write can't undo them."), then one [`DangerZoneToolCard`](../../../src/app/components/dangerZone/DangerZoneToolCard.md) per offered tool: what it does, what it costs, how long, and **Start…** when the tool has a `route`. Nothing on the page touches the radio. Danger colour is used once per screen (the strap). Above the cards is the unfinished-change banner; below them **Finish a range change from a backup file** and, when this browser has a finished change on record, "Last change: …1234, Amateur Europe → Amateur US, 26 Oct 14:20 · **Change back…**" (last 4 of the serial only).
- **Entry points:**
  1. The **last card** of the AT-D890UV Export panel (`DangerZoneCard`, after **What Write updates**): collapsed red-edged "Danger zone · Changes the radio itself"; open: "Rare jobs that change the radio, not your codeplug. Each one backs up first." and **Open danger zone**.
  2. The Radio settings page's read-only **Frequency range** row: "<range> · **Change…**" (shown only after a Read, only when the area is offered). The "Why can't I change these?" text says the range can be changed from Danger zone, or "Studio can only show it" when the area is not offered.
- **Not offered** (a radio with no tool, a build with no Web Serial egress, or the Capacitor app where Web Serial isn't available): both entry points are hidden and the route redirects to `/builds/:id/export`.
- **Build switch:** `pathForSwitchedBuild` keeps `export/danger-zone` only when the target build also shows it (`showsDangerZoneNav`), else lands on Export.

## The wizard

`/builds/:id/export/danger-zone/frequency-range` (and `…/resume`, below). A page wizard: **1 Read → 2 New range → 3 Back up → 4 Confirm → 5 Change → 6 Restart → 7 Restore → 8 Check → Done**, with the v2 `Stepper` (a compact "3 of 8 · Back up" line and a thin bar under 40 rem). Code: `src/app/routes/builds/danger-zone/rangeChange/` (`useRangeChangeFlow` owns the state and sessions; `steps/` are presentational; every string is in `rangeChangeCopy.ts`); services in `src/app/services/dangerZone/`.

**Three sessions.** Each is its own connection:

| Session | Steps   | What it does                                                                                                                                                                                                       |
| ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A       | 1 to 5  | Held. Identify, the full backup (the Backup page's `download()` and pack) and the vital backup (read twice). Then read, guard, **one** `W`, `END`. Nothing is written before step 5; no `R` is sent after the `W`. |
| B       | 6 and 7 | After the restart: identify, verify (range, LocalInfo, tune), then Restore of **every** restorable region of the zip, codeplug and settings together in one session, then `END`.                                   |
| C       | 8       | Read only: read back the restored regions and compare them with the zip.                                                                                                                                           |

Why Restore runs after the reboot and writes everything at once: restoring the settings onto the still-default codeplug makes the radio start at "Program Error / Please Initialize The Radio!" (the restored zone A/B numbers point at empty zones).

**Steps.** 1: connect and read; shows the sanitised range (ident byte 8), and "Stored as 14; the radio treats it as 0." when the stored byte differs. 2: every range 0 to 18, the current one keeps its tick (disabled) while another is picked; code 14 disabled unless the radio already has `890#`, with the reason; 6, 9, 12 and 15 selectable behind a big warning (also when the radio is already on one); an amber line when the target narrows receive; the regulatory line always; **Next: back up** needs a different range. 3: backup and vital backup, both files saved together and listed under _Backups saved this session_ ("before range change"), then the tick "I've saved both files". 4: what will happen, the receive-only count (from the backup's channels) or "Transmit opens on …", a checkbox and the one red **Change frequency range** button. 5: the change. 6: restart countdown (`restartCountdownSeconds`), **Reconnect**, the checklist and its findings. The copy does not promise a normal screen: the radio applies the change and restarts, its screen may stay on "PC Read", and the user continues when **Reconnect** lights up or the countdown ends (seen on hardware, RT-2). Step 8's intro says the same. 7: Restore; **Restore again** re-runs all of it. 8: **Check** (never automatic) or **Skip check**; real differences offer **Restore again**. Bytes that change in normal use (current zone and channel, the per-zone current-channel tables, VFO A/B; list in [memory-layout.md](../../reference/radios/anytone/at-d890uv/memory-layout.md#usage-volatile-bytes), code in `usageVolatileBytes.ts`) are not failures: a Check with only those passes, and Done says "Changed since the restore, which is normal if you've used the radio: …". A block that differs in a volatile byte and a real byte still fails. Done: what was put back, calibration ("checked unchanged" only when it was compared with the vital file, otherwise "Studio did not compare it"), the CPS note, **Back to Export** and **Change back to <old>…**.

**Failures.** Every exit before the frame says "Nothing has changed.". A re-read that differs from the backup sends `END` and says nothing changed. A stun or kill flag, an unreadable LocalInfo and any failure after the frame never send `END` (`atD890RangeChangeMayEndAfter`). A failure while reading or backing up in session A that is not a refusal on bytes already read (an unreadable LocalInfo above all) leaves the stun/kill state unknown: Studio abandons the session without `END` and says to switch the radio off and on (`rangeChangeMayEndAfterRead`). A frame that is not ACKed is "The radio didn't take the change" (journal cleared). Step 6 findings: no port, a different radio, still on the old range (nothing was wiped; journal cleared), an unexpected range, and an identity difference, which also offers **Restore my channels anyway…** behind a second confirm (Restore never writes LocalInfo or calibration).

**Leaving.** The page keeps the screen awake and asks before leaving while a transfer runs or the radio is wiped ("Your radio is wiped until Restore finishes. Leave anyway?"). Once step 5 starts, the change owns its session and its one `END`: leaving the page sends no `END` of its own, and the journal's `sending` record covers recovery.

**Reconnect.** Step 6 enables **Reconnect** when the countdown ends or as soon as the browser raises a Web Serial `connect` event for the radio's port, whichever comes first. **Change back to <old>…** on Done restarts the flow with the old range preselected (a fresh backup and confirm).

### Journal, resume and the Backup page guard

One record per radio serial in `localStorage` (`codeplug-studio.danger-zone.range-change-journal.v1`, port `src/integrations/persistence/rangeChangeJournal.ts`; every access in try/catch, storage unavailable means no banner). Fields: serial, model, from and to code, stage (`sending` before the frame, then `changed`, `restored`, `done`), the backup's file name, SHA-256 and time, the vital file's name and hash, start and update times, Studio version. **Never backup bytes**; the user's saved zip is the durable copy. The serial is operator data in browser storage only. The newest 5 `done` records are kept for "Last change".

A stale record can be forgotten with **Dismiss this record** on the banner, behind a confirm that says plainly what is lost (the banner and Resume go away; the radio is not touched; backup files stay). A red banner (one line and a button) shows for any record at `sending`, `changed` or `restored` on the Danger zone page, above the AT-D890 Export panel's header card, and on Backup / Restore ([RangeChangeBanner](../../../src/app/components/dangerZone/RangeChangeBanner.md)). **Resume** opens `…/frequency-range/resume` (the serial rides in router state, not the URL): pick the saved backup (its SHA-256 and serial are checked against the record, from the banner and from the backup-file path alike: with a record on file, a different backup of the same radio is refused), then by stage: `sending` with the old range and identical LocalInfo is "Nothing changed after all" (journal cleared); `changed` goes through the step 6 checks, then Restore; `restored` goes straight to Check.

**Without a journal**, **Finish a range change from a backup file** (`…/resume?file=1`) checks the zip's serial against the connected radio. The same range is "This radio's range already matches the backup. Use Backup / Restore for a normal restore."; otherwise the step 6 checklist (the calibration is compared only if the vital file is picked as well) and Restore.

**Backup page guard.** A D890 Restore from Backup / Restore onto a radio whose sanitised range differs from the zip's forces every restorable region and says "This radio's range has changed since the backup, so Studio restores everything together. Restoring settings alone would stop the radio starting." A same-range Restore is unchanged.

### Decisions

All in `src/app/services/dangerZone/decisions.ts` (owner decisions of 2026-10-26): area name and strap; confirm is a checkbox plus a button; all ranges shown; code 14 disabled without `890#`; tickbox backup check; restore anyway behind a second confirm; codes 6, 9, 12, 15 allowed behind a scary warning; no feature flag; the final Check never automatic; `restartCountdownSeconds` (60, RT-2 sets it) and `programErrorAdvice` (`stay-connected`, RT-8 decides). They are recorded as constants: the alternatives the first plan listed were not built because the owner chose.

## Registry and gate

`src/app/services/dangerZone/`:

| File           | Role                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `registry.ts`  | `DANGER_ZONE_TOOLS`: `{ id, title, summary, cost, minutes, radios, route? }`. `radios` lists `RadioBuild.radioTargetId` values (the D890 stock and MM9PDY targets are separate ids)  |
| `gate.ts`      | `listOfferedDangerZoneTools(radioTargetId)`: the tools for this radio target; empty in the Capacitor app. No prod gate or feature flag (owner decision: testing happens on pre-prod) |
| `decisions.ts` | `DANGER_ZONE_DECISIONS`: the area's name and strap and the wizard's decisions (see "Decisions" above). Interlocks never read this file                                               |

Like the firmware flasher, there is no Capacitor exemption: the area is hidden in the native app until Web Serial works there.

## How a tool joins

1. Add a registry entry (copy deck: what it does, what it costs, minutes, radios).
2. Build its wizard as a page under `export/danger-zone/<tool>` with its own guarded send path; set `route` so the card shows **Start…**.
3. Say "nothing has changed" at every exit before the first write; offer a resumable recovery after it.

## Engine

Hardware facts and the frame rules: [band-code.md — Changing the range](../../reference/radios/anytone/at-d890uv/band-code.md#changing-the-range).

| Piece                          | Where                                                                                                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Targets, summaries             | `src/core/radios/anytone/at-d890uv/frequencyRange.ts`: `AT_D890_RANGE_CHANGE_TARGET_CODES`, `atD890RangeChangeTargets`, `atD890ReceiveNarrower`, `atD890TxChangeSummary`                                                               |
| Frame builder and refusals     | `src/integrations/radio-io/radios/at-d890uv/rangeChange/rangeChangeFrame.ts`: `buildAtD890RangeChangeFrame`, `AtD890RangeChangeRefusedError`                                                                                           |
| The only LocalInfo sender      | `rangeChange/rangeChangeSend.ts`: one frame, one address, one call; resends the identical frame on a lost ACK; not exported from the barrel                                                                                            |
| Session (called in PROGRAM)    | `rangeChange/rangeChangeSession.ts`: `changeAtD890FrequencyRange`; errors carry `frameSent` and `mayEnd`; `atD890RangeChangeMayEndAfter(err)` is the one answer to "may I send `END`?"                                                 |
| Post-change verify (read only) | `rangeChange/rangeChangeVerify.ts`: `verifyAtD890RangeChange`. A separate step the user starts; nothing runs it automatically. Reports `serialMatches`; tune `+0x700..+0x711` may show in `tuneDiffs` on some radios (RT-2 records it) |
| Import boundary                | `rangeChange/rangeChangeBoundary.test.ts`                                                                                                                                                                                              |

**Targets.** Every code 0 to 18. Code 14 is refused (reason `maintenance-locked`) unless LocalInfo `+0x0B..+0x0E`
reads `890#`; `atD890RangeChangeTargets` marks it `available: false` so a screen can disable it with a reason. Codes 6,
9, 12 and 15 are firmware-valid but not offered by the CPS or the factory menu: they are targets, flagged `unlisted`
so a screen can warn loudly. A radio already on an unlisted code is not refused.

**`frameSent` and `mayEnd`.** Two facts, kept apart. `frameSent` says a `W` may have reached the radio. `mayEnd` says the
caller may send `END` and say "Nothing has changed": LocalInfo differs from the backup, a frame refusal, the sender
refusing the payload, or the caller's journal write failing. A stun/kill flag (`AtD890StunKillError`) and an unreadable
LocalInfo have `frameSent` false and `mayEnd` false: nothing changed, but `END` must not be sent. Callers do not read the
fields off an unknown error: `atD890RangeChangeMayEndAfter(err)` is true only for the known-safe refusals and false for
everything else, including `AtD890StunKillError` and errors it has never seen. `END` is the firmware's commit, so the
session sends it only after a clean ACK.

**The sender checks its own payload.** It refuses, before any write, a payload that is not 16 bytes, has `+0x00` or
`+0x01` non-zero, `+0x04 != +0x05`, a code above 18, code 14 without `890#` at `+0x0B..+0x0E`, or differs from the live
`+0x00..+0x0F` other than at `+0x03`; and a live LocalInfo whose model is not `D890UV` or whose model or serial differs
from the backup. It therefore requires the live and backed-up LocalInfo from its caller.

## Radio checks

All pending. The wizard is shipped on pre-prod builds and is **not yet checked on a radio**. Nothing here has run on a radio; the emulator has no USB, so the `W` path is proved only on hardware.

| Row   | Check                                                                                                                                       | Status  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| RT-1  | Abort: frame sent, port closed without `END`, power-cycle. Ident shows the old code; LocalInfo and tune byte-identical                      | Pending |
| RT-2  | Change 3 to 7: reboot; ident 7; LocalInfo differs only at `+0x03`; tune differs only at `+0x28`; how long the boot wipe takes               | Pending |
| RT-3  | Reconnect after the change: does the browser ask for the port again?                                                                        | Pending |
| RT-4  | Restore in one session after the change: normal boot, settings and codeplug as before, no Program Error                                     | Pending |
| RT-5  | TX on a dummy load: 445.000 MHz refused on code 3 and allowed on 7; 146.5 MHz likewise                                                      | Pending |
| RT-6  | CPS: the old file is refused ("Band Error!"); a Read then a Write works                                                                     | Pending |
| RT-7  | Revert 7 to 3 through the same flow; RT-2's checks again                                                                                    | Pending |
| RT-8  | Program Error: can the radio enter PC mode in that loop?                                                                                    | Pending |
| RT-9  | Resume: reload between `END` and Restore; resume from the saved zip                                                                         | Pending |
| RT-10 | Code 18 at 220 MHz: change to 18, tune a 222.5 MHz signal. Does receive work, and is it flagged out of band? (Studio's row says RX 220–225) | Pending |
| RT-11 | Pull the cable mid-`W` (step 5) and mid-Restore: journal state, banner, Resume works, and the radio is in the state the copy says           | Pending |
| RT-12 | Check after a normal restart: no false differences (VFO, current channel). Run it twice, once after touching the radio                      | Pending |
| RT-13 | Leave the page during step 5 and during step 7 (guard modal): radio and journal state; no second `END`                                      | Pending |
| RT-14 | Backup page Restore of a pre-change zip onto a changed radio: every region forced, boots normally                                           | Pending |
| RT-15 | A radio on an unlisted code (6, 9, 12, 15), if one exists: Read, change away, and back                                                      | Pending |

Extensions to earlier rows:

- **RT-2:** also diff LocalInfo and the tune bank against the vital zip: only `+0x03` and `+0x28` may differ. Note whether tune `+0x700..+0x711` is non-FF on the radio and whether it survives the change (if the firmware's rewrite omits those bytes the verify says "something else changed" and **Restore my channels anyway…** gets the user through).
- **RT-3:** does the browser raise the Web Serial `connect` event for the radio after the restart (it enables Reconnect early)? Does it ask for the port again at Reconnect and at **Restore again** (each is a new session)?
- **RT-9:** also resume via `?file=1` with a journal on file, and confirm a different backup of the same radio is refused.

## Related

- [README](README.md), [backup-restore.md](backup-restore.md), [adding-a-radio-adapter.md](adding-a-radio-adapter.md)
- [RangeChangeBanner](../../../src/app/components/dangerZone/RangeChangeBanner.md), [RestartCountdown](../../../src/app/components/radio-io/RestartCountdown.md)
- Cards: [RadioIoPanelCards](../../../src/app/components/builds/RadioIoPanelCards/RadioIoPanelCards.md)
