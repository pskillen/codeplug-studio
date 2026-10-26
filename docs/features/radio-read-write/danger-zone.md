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

| Piece                                                              | Status  | Notes                                                 |
| ------------------------------------------------------------------ | ------- | ----------------------------------------------------- |
| Range-change engine (core rules, frame, sender, session, verifier) | Shipped | The "Engine" section below. No UI calls it yet        |
| Danger zone area (page, registry, entry points, nav)               | Shipped | PR 3 of #1369. Lists the tool; no **Start…** yet      |
| Change frequency range wizard                                      | Planned | PR 4 of #1369, including the user-started final Check |

## The area

- **Route:** `/builds/:id/export/danger-zone` (`BuildDangerZonePage`). It sits under a build because the build's Web Serial egress is the only door to a radio today. It is **not** a strip tab, a Write stepper step or a Backup page action: `activeBuildSection` maps it (and anything below it) to Export, so the Export tab stays lit.
- **Page:** title **Danger zone**, a fixed red strap ("These change the radio itself. A Write can't undo them."), then one [`DangerZoneToolCard`](../../../src/app/components/dangerZone/DangerZoneToolCard.md) per offered tool: what it does, what it costs, how long, and **Start…** when the tool has a `route`. Nothing on the page touches the radio. Danger colour is used once per screen (the strap). Below the cards is a footer slot for the wizard PR ("Finish a range change from a backup file", "Last change: …").
- **Entry points:**
  1. The **last card** of the AT-D890UV Export panel (`DangerZoneCard`, after **What Write updates**): collapsed red-edged "Danger zone · Changes the radio itself"; open: "Rare jobs that change the radio, not your codeplug. Each one backs up first." and **Open danger zone**.
  2. The Radio settings page's read-only **Frequency range** row: "<range> · **Change…**" (shown only after a Read, only when the area is offered). The "Why can't I change these?" text says the range can be changed from Danger zone, or "Studio can only show it" when the area is not offered.
- **Not offered** (a radio with no tool, a build with no Web Serial egress, or the Capacitor app where Web Serial isn't available): both entry points are hidden and the route redirects to `/builds/:id/export`.
- **Build switch:** `pathForSwitchedBuild` keeps `export/danger-zone` only when the target build also shows it (`showsDangerZoneNav`), else lands on Export.

## Registry and gate

`src/app/services/dangerZone/`:

| File           | Role                                                                                                                                                                                                                                                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registry.ts`  | `DANGER_ZONE_TOOLS`: `{ id, title, summary, cost, minutes, radios, route? }`. `radios` lists `RadioBuild.radioTargetId` values (the D890 stock and MM9PDY targets are separate ids)                                                                                                                                                                             |
| `gate.ts`      | `listOfferedDangerZoneTools(radioTargetId)`: the tools for this radio target; empty in the Capacitor app. No prod gate or feature flag (owner decision: testing happens on pre-prod)                                                                                                                                                                            |
| `decisions.ts` | `DANGER_ZONE_DECISIONS`: the area's name and strap. Owner decisions live here; interlocks never read this file. It also records the wizard's decisions (confirm checkbox, all ranges, code 14 needs `890#`, tickbox backup check, restore-anyway second confirm, codes 6/9/12/15 behind a scary warning, final Check never automatic) for the wizard PR to read |

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

All pending. Nothing here has run on a radio; the emulator has no USB, so the `W` path is proved only on hardware.

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

## Related

- [README](README.md), [backup-restore.md](backup-restore.md), [adding-a-radio-adapter.md](adding-a-radio-adapter.md)
- Cards: [RadioIoPanelCards](../../../src/app/components/builds/RadioIoPanelCards/RadioIoPanelCards.md)
