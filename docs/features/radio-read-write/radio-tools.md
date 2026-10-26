# Radio tools

Rare jobs that change the radio itself rather than its codeplug. The first is the AT-D890UV **frequency range**
change ([#1369](https://github.com/pskillen/codeplug-studio/issues/1369)): the one byte (LocalInfo `+0x03`) that
decides which frequencies the radio will transmit on. The official CPS cannot change it, and a change wipes the
radio's channels and settings at the next boot, so the tool is built around a checked backup and a recovery path.

Radio tools live under a build's **Export**, because the Web Serial egress is the door to a radio. They are not Write,
Restore or Backup, and none of those can reach them.

## Rules

The constitution is [DESIGN.md — Radio tools](../../../DESIGN.md#radio-tools). In short:

1. A tool runs only from its own wizard.
2. Backup first, checked: refuse to touch the radio until the backup is saved and re-opened.
3. One guarded send path per tool, as narrow as the change; hard interlocks are code with a refusal test each.
4. "Nothing has changed" at every exit before the first write; a resumable recovery after it.
5. A per-tool prod gate, cleared in its own commit once the owner has run the tool on a radio.

Agent rules: [.claude/rules/radio-tools.md](../../../.claude/rules/radio-tools.md).

## Implementation status

| Piece                                                              | Status  | Notes                                                             |
| ------------------------------------------------------------------ | ------- | ----------------------------------------------------------------- |
| Range-change engine (core rules, frame, sender, session, verifier) | Shipped | This page's "Engine" section. Nothing in the UI calls it yet      |
| Radio tools area                                                   | Planned | PR 3 of #1369                                                     |
| Change frequency range wizard                                      | Planned | PR 4 of #1369                                                     |
| Prod gate cleared                                                  | Planned | PR 5 of #1369, after the owner has passed RT-1 to RT-9 on a radio |

## Engine

Hardware facts and the frame rules: [band-code.md — Changing the range](../../reference/radios/anytone/at-d890uv/band-code.md#changing-the-range).

| Piece                          | Where                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Targets, summaries             | `src/core/radios/anytone/at-d890uv/frequencyRange.ts`: `AT_D890_RANGE_CHANGE_TARGET_CODES`, `atD890RangeChangeTargets`, `atD890ReceiveNarrower`, `atD890TxChangeSummary` |
| Frame builder and refusals     | `src/integrations/radio-io/radios/at-d890uv/rangeChange/rangeChangeFrame.ts`: `buildAtD890RangeChangeFrame`, `AtD890RangeChangeRefusedError`                             |
| The only LocalInfo sender      | `rangeChange/rangeChangeSend.ts`: one frame, one address, one call; resends the identical frame on a lost ACK; not exported from the barrel                              |
| Session (called in PROGRAM)    | `rangeChange/rangeChangeSession.ts`: `changeAtD890FrequencyRange`; errors carry `endSafe`                                                                                |
| Post-change verify (read only) | `rangeChange/rangeChangeVerify.ts`: `verifyAtD890RangeChange`                                                                                                            |
| Import boundary                | `rangeChange/rangeChangeBoundary.test.ts`                                                                                                                                |

**`endSafe`.** `true` means nothing was written and no stun/kill flag is known, so the caller may send `END` and say
"Nothing has changed": LocalInfo differs from the backup, a frame refusal, or the caller's journal write failing. `false`
means the caller must close the port **without** `END`: a stun/kill flag (`AtD890StunKillError`), an unreadable
LocalInfo, and any failure once the frame was sent. `END` is the firmware's commit, so the session sends it only after
a clean ACK.

## Radio checks

All pending. Nothing here has run on a radio; the emulator has no USB, so the `W` path is proved only on hardware.

| Row  | Check                                                                                                                         | Status  |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | ------- |
| RT-1 | Abort: frame sent, port closed without `END`, power-cycle. Ident shows the old code; LocalInfo and tune byte-identical        | Pending |
| RT-2 | Change 3 to 7: reboot; ident 7; LocalInfo differs only at `+0x03`; tune differs only at `+0x28`; how long the boot wipe takes | Pending |
| RT-3 | Reconnect after the change: does the browser ask for the port again?                                                          | Pending |
| RT-4 | Restore in one session after the change: normal boot, settings and codeplug as before, no Program Error                       | Pending |
| RT-5 | TX on a dummy load: 445.000 MHz refused on code 3 and allowed on 7; 146.5 MHz likewise                                        | Pending |
| RT-6 | CPS: the old file is refused ("Band Error!"); a Read then a Write works                                                       | Pending |
| RT-7 | Revert 7 to 3 through the same flow; RT-2's checks again                                                                      | Pending |
| RT-8 | Program Error: can the radio enter PC mode in that loop?                                                                      | Pending |
| RT-9 | Resume: reload between `END` and Restore; resume from the saved zip                                                           | Pending |
