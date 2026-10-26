# AT-D890UV band code (frequency range)

The official CPS lets the operator pick a **frequency range** (Europe, US, commercial, amateur, …). This page records where that choice lives on the radio and how Studio changes it ([#1369](https://github.com/pskillen/codeplug-studio/issues/1369)). **Studio shows the range read-only (Backup page, LocalInfo decode), uses the firmware table for the receive-only check, and has a range-change engine (a single 16-byte `W`, below) that no screen calls yet. The engine is not radio-tested: checks RT-1 and RT-2 are pending, as are the hardware tests in "Open questions".**

Evidence comes from the MM9PDY firmware reverse-engineering notes (`anytone-d890-firmware`: `docs/reference/cps/protocol.md`, `docs/reference/firmware/calibration-and-identity.md`, `pc-link-protocol.md`, findings F51 / F73), and from a real read of one radio.

## Where the value lives

| Fact                     | Detail                                                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Radio-side copy**      | LocalInfo `+0x03` (`0x04F80003`), RAM `0x20015277`. One byte.                                                                                                                                                                  |
| **Reported to the CPS**  | Ident reply byte 8 (the "band code"). Studio parses it as `AtD890Ident.bandCode` ([connection.ts](../../../../../src/integrations/radio-io/radios/at-d890uv/connection.ts)); the Backup page shows the LocalInfo byte instead. |
| **CPS-side copy**        | Saved with the codeplug file. On **Write** the CPS refuses the radio, and closes the port without `END`, if the radio's band code differs from the file's.                                                                     |
| **Who writes LocalInfo** | The official CPS **never** writes it. It is not a codeplug value. This is why the CPS cannot change the range for an existing radio: the codeplug file is bound to the radio's code.                                           |
| **Sample radio**         | LocalInfo `+0x00…+0x0F` = `00 00 00 03 01 01 09 00 00 01 01 20 20 20 20 FF`, so band code `3`.                                                                                                                                 |

So the working assumption that the setting is "a value within the codeplug" is **not** supported by the evidence. It is a LocalInfo byte, outside the codeplug write set. Changing it is a LocalInfo write, not part of a normal channel/zone Write session. Still to confirm on hardware (see below).

Studio's earlier field hints named `+0x03` "frequency mode" (from anytone-cps `ExpertOptions`; now shown as "Frequency range") and `+0x06` "band select"; the firmware notes call `+0x03` the variant / band code. These are the same byte seen from two projects. The role of `+0x06` and the 4-byte "band password" at `+0x0B` is unknown.

## Band code table (CPS display decoder; superseded for codes 15, 16 and 18)

From the CPS decoder (`0x7b6050`). TX narrower than RX means the radio receives the wider range but only transmits in the narrow one.

| Code | Ranges (MHz)                                             |
| ---- | -------------------------------------------------------- |
| 0, 1 | UHF 400–480, VHF 136–174                                 |
| 2    | UHF 430–440, VHF 144–146                                 |
| 3    | UHF RX 400–480 / TX 430–440, VHF RX 136–174 / TX 144–146 |
| 4    | UHF 434–438, VHF 144–146                                 |
| 5    | UHF 434–447, VHF 144–146                                 |
| 6    | UHF 446–447, VHF 136–174                                 |
| 7    | UHF RX 400–480 / TX 420–450, VHF RX 136–174 / TX 144–148 |
| 8    | UHF 400–470, VHF 136–174                                 |
| 9    | UHF 430–432, VHF 144–146                                 |
| 10   | UHF RX 400–480 / TX 430–450, VHF RX 136–174 / TX 144–148 |
| 11   | UHF 400–520, VHF 136–174                                 |
| 12   | UHF 400–490, VHF 136–174                                 |
| 13   | UHF RX 400–480 / TX 403–470, VHF 136–174                 |
| 14   | UHF 400–520 and 220–225, VHF 136–174                     |
| 15   | UHF 420–450, VHF 144–148                                 |
| 16   | UHF 430–440, VHF 144–147                                 |
| 17   | UHF RX 430–440 / TX off, VHF 136–174                     |
| 18   | UHF 450–520 and 220–225, VHF 144–174                     |

The names Europe / US / commercial / amateur are CPS UI captions. Their mapping to codes is in the firmware table below (captions as the CPS picker shows them).

## Firmware range table (what the radio enforces)

Code: [`frequencyRange.ts`](../../../../../src/core/radios/anytone/at-d890uv/frequencyRange.ts) (`AT_D890_FREQUENCY_RANGES`). This is the stock V1.05 firmware table, read from the radio's own tables (see the firmware repo's `calibration-and-identity.md` and `pc-link-protocol.md`; findings tracked on [#1369](https://github.com/pskillen/codeplug-studio/issues/1369)). **It supersedes the CPS display table above wherever they differ.** MHz, inclusive; "off" means transmit is inhibited.

| Code | CPS caption                | RX UHF / VHF      | TX UHF / VHF      | 220 MHz           |
| ---- | -------------------------- | ----------------- | ----------------- | ----------------- |
| 0    | Commercial Europe          | 400–480 / 136–174 | 400–480 / 136–174 | none              |
| 1    | Commercial US              | 400–480 / 136–174 | 400–480 / 136–174 | none              |
| 2    | Mode 000002                | 430–440 / 144–146 | 430–440 / 144–146 | none              |
| 3    | Amateur Europe             | 400–480 / 136–174 | 430–440 / 144–146 | none              |
| 4    | Band 4                     | 434–438 / 144–146 | 434–438 / 144–146 | none              |
| 5    | Band 5                     | 434–447 / 144–146 | 434–447 / 144–146 | none              |
| 6    | (not listed)               | 446–447 / 136–174 | 446–447 / 136–174 | none              |
| 7    | Amateur US                 | 400–480 / 136–174 | 420–450 / 144–148 | none              |
| 8    | Commercial                 | 400–470 / 136–174 | 400–470 / 136–174 | none              |
| 9    | (not listed)               | 430–432 / 144–146 | 430–432 / 144–146 | none              |
| 10   | Amateur Australia / Canada | 400–480 / 136–174 | 430–450 / 144–148 | none              |
| 11   | Mode 0011                  | 400–520 / 136–174 | 400–520 / 136–174 | none              |
| 12   | (not listed)               | 400–490 / 136–174 | 400–490 / 136–174 | none              |
| 13   | Commercial                 | 400–480 / 136–174 | 403–470 / 136–174 | none              |
| 14   | Maintenance (needs `890#`) | 400–520 / 136–174 | 400–520 / 136–174 | 220–225 RX and TX |
| 15   | (not listed)               | 420–520 / 144–148 | 420–520 / 144–148 | none              |
| 16   | Amateur Thailand           | 430–440 / 144–147 | off / 144–147     | none              |
| 17   | Commercial Thailand        | 430–440 / 136–174 | off / 136–174     | none              |
| 18   | Mode 000018                | 400–480 / 136–174 | 420–450 / 144–148 | TX 222–225 only   |

- **TX is enforced at PTT.** The radio receives on its hardware bands whatever the code says, and refuses to transmit outside the code's TX table. A channel outside the TX table is therefore receive-only on that radio.
- **CPS display differs from the firmware** for codes 15, 16 and 18 (see the CPS table above). Studio uses the firmware table.
- The loader maps codes above 18 to 0, and code 14 to 0 unless LocalInfo `+0x0B..+0x0E` is `890#`. Studio's Backup row shows a locked 14 as "treated as 0". Anything that enforces the table (PR 4c's Review) must use the **sanitised** code (the ident reply byte 8, from RAM `0x20015277`), never the raw LocalInfo byte.
- **Code 18 at 220 MHz is TX only (222–225).** The firmware's RX clamp, VFO range init and out-of-band check open 200–300 MHz only for code 14, so RX at 220 MHz on code 18 is not claimed. Unconfirmed on a radio; the earlier 220–225 RX figure came from the table row alone.
- **Changing the range resets the radio** at the next boot: channels, zones, scan lists and the whole settings unit are cleared and the tune bank is rewritten (see "Changing the range" below).
- **Calibration bank pair** `0x04F00000` / `0x04F40000` holds the tune data that is rewritten on a range change; Studio's vital-data backup reads and saves it (see [backup-restore.md](backup-restore.md#vital-data-backup)).

### How Studio uses it

- Read-only display: the Backup page's LocalInfo decode shows "Frequency range: <caption> (code N) · TX …"; the ident reply carries the same byte (`AtD890Ident.bandCode`).
- Studio writes LocalInfo **only through the Danger zone's range change** (`integrations/radio-io/radios/at-d890uv/rangeChange/`). No codeplug Write, Restore or Backup path reaches it.
- **Every channel the hardware can receive is written.** Once the Review step (PR 4c) lands, the Write's Review will warn, from the connected radio's code, about channels whose TX frequency is outside that radio's TX table (`listAtD890ReceiveOnlyChannels`): they are written and are receive-only on that radio. Nothing is stored per build. Build-level eligibility ([capabilities.md](capabilities.md)) is unchanged.

## Changing the range

Facts from a reading of stock V1.05 firmware. **Not radio-tested: RT-1 and RT-2 are pending** (see [danger-zone.md](../../../../features/radio-read-write/danger-zone.md)).

### How the firmware takes the change

- On entering PC mode the firmware pre-loads the live LocalInfo `+0x00..+0xFF` into a RAM image.
- A PC-link `W` into the unit at `0x04F80000` is special-cased. The **first** `W` erases the **non-live** half of the A/B pair and programs nothing. Each 16-byte frame is overlaid on the RAM image at `addr & 0xFFF`; offsets `>= 0x100` are discarded.
- At `END` the firmware programs the `0x100` RAM image into the erased half, marks it live and the old half stale, then **reboots**.
- So **one 16-byte `W` at `0x04F80000`** changes the range. Everything else in LocalInfo (serial, model, unlock, dealer fields) survives from the RAM pre-load, because the frame is overlaid rather than replacing the unit.
- **Abort:** if the link is lost after the `W` and before `END`, only the non-live half has been erased; the old LocalInfo is used at power-up and nothing changes. Studio therefore sends `END` only after a clean ACK and never on a failure path.
- The RAM overlay is idempotent, so a lost ACK is handled by resending the identical frame (at most twice).

### Never

- **Never address `0x04FC0000`** (the other half of the pair). It misses the special case, and the generic path would erase an unrelated unit.
- **Never use PC-link `H`.** It is a per-frame A/B LocalInfo writer with a RAM-overrun bug.
- **Never touch the sector markers.**
- Never write LocalInfo through the generic write helpers. LocalInfo is not on `AT_D890_WRITABLE_EXTENTS`, and the generic helpers hard-deny `0x04F00000..0x04FFFFFF` whatever guard they are given (vital-unit deny, a separate PR of #1369).

### Sibling bytes in the 16-byte block

The frame carries `+0x00..+0x0F` of the live LocalInfo with only `+0x03` changed. The other bytes matter:

| Offset            | Meaning                     | Why the frame builder cares                                                                                                     |
| ----------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `+0x00`           | Stun flag                   | Non-zero stuns the radio. `END` with a flag set rewrites LocalInfo from stale RAM, which would undo the frame. Refused.         |
| `+0x01`           | Kill flag                   | As `+0x00`. Refused.                                                                                                            |
| `+0x02`           | Test-mode bit               | Carried unchanged.                                                                                                              |
| `+0x04` / `+0x05` | Market / language-lock pair | The `W` handler forces `+0x05`. If `+0x04 != +0x05` at boot the radio runs **full factory defaults**. Refused when they differ. |
| `+0x06..+0x0A`    | Unknown                     | Carried unchanged.                                                                                                              |
| `+0x0B..+0x0E`    | `890#` unlock               | The loader maps code 14 to 0 without `890#` (and codes above 18 to 0). Code 14 is a target only when `890#` is present.         |
| `+0x10..+0x15`    | Model string `D890UV`       | Outside the frame, but checked in the live read: a different string refuses the change.                                         |
| `+0x30`           | Serial                      | Outside the frame; survives from the RAM pre-load.                                                                              |

### What happens at the next boot

The firmware sees LocalInfo `+0x03` differ from the tune bank's copy at tune `+0x28` and:

- wipes channels, zone members, scan lists, zone names and the whole settings unit (87 erase units in the emulator);
- writes the new range's defaults;
- A/B-rewrites the tune bank (`0x04F00000` to `0x04F40000`), byte-identical apart from `+0x28`.

The official **CPS** never writes LocalInfo, cannot change a radio's range, and refuses an old codeplug file after a change ("Band Error!").

### Frame rules (enforced in code)

`buildAtD890RangeChangeFrame(liveLocalInfo, target)` refuses when: the LocalInfo is shorter than `0x100`; `+0x00` or `+0x01` is non-zero; `+0x04 != +0x05`; `+0x10..+0x15` is not `D890UV`; the target is not an integer in the allowed set; the target is 14 and `+0x0B..+0x0E` is not `890#`; or the target equals the raw `+0x03`. It returns a copy of `+0x00..+0x0F` with only `+0x03` set and asserts the diff against its input is exactly one byte.

**Allowed targets:** every code 0 to 18. Code 14 only when `+0x0B..+0x0E` reads `890#` (otherwise refused with reason `maintenance-locked`). Codes 6, 9, 12 and 15 are valid to the firmware but offered by neither the CPS nor the radio's factory menu: they are allowed, flagged `unlisted` so a screen can warn loudly, and a radio already on one is not refused. Targets whose receive range is narrower than 136-174 / 400-480 MHz: 2, 4, 5, 8, 16, 17 (listed) and 6, 9, 15 (unlisted). Codes 16 and 17 inhibit UHF transmit.

### Session shape

Run in PROGRAM by `changeAtD890FrequencyRange`: read LocalInfo `0x100`; refuse on a stun/kill flag; require the bytes to equal the verified backup; build the frame; let the caller write its journal; send the one `W`; send `END`. After the reboot, `verifyAtD890RangeChange` (a separate step the user starts; nothing runs it automatically) reads LocalInfo (and the tune bank when the backup has it) and reports any difference other than LocalInfo `+0x03` and tune `+0x28`.

### Code and tests

- Core: [`frequencyRange.ts`](../../../../../src/core/radios/anytone/at-d890uv/frequencyRange.ts) (targets, summaries).
- Frame, sender, session, verify: `src/integrations/radio-io/radios/at-d890uv/rangeChange/`. `rangeChangeSend.ts` is the only code that can write LocalInfo; `rangeChangeBoundary.test.ts` keeps everything else from importing it.
- **Not radio-tested.** The emulator has no USB, so the `W` path is proved on a radio (RT-1, RT-2).

### Not engine work

The wizard, the backup tickbox, the resumable journal and the final Check button belong to later PRs of [#1369](https://github.com/pskillen/codeplug-studio/issues/1369). **Eligibility follows the code:** the D890 channel-eligibility bands ([capabilities.md](capabilities.md)) are currently fixed at 136-174 / 400-480 MHz and should come from the table above once the code is known.

## Open questions (hardware tests)

| #   | Question                                                                                                                      | How to answer                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Does the firmware enforce TX limits from this byte at runtime (RAM `0x20015277`), or is it only the ident / CPS check?        | Firmware decompile search for readers of `0x20015277`; then a bench test on a dummy load.                                                                                                                    |
| 2   | Is the whole change really one LocalInfo byte, or does the radio also expect other fields (`+0x06`, band password) to change? | Capture the CPS "dealer" / expert range setting if one exists; diff LocalInfo between two radios of different codes.                                                                                         |
| 3   | Does the radio wipe or flag existing channels outside the new range?                                                          | Test on a spare radio after a Backup: change the code, read channels back.                                                                                                                                   |
| 4   | Does it need a power cycle or `END` reboot to take effect?                                                                    | Same test.                                                                                                                                                                                                   |
| 5   | Is it a single write session?                                                                                                 | LocalInfo is its own erase unit, so it is a separate write from the codeplug regions. The code probably needs to change **before** the codeplug Write, since Studio does not enforce the CPS match. Confirm. |

## Related

- [memory-layout.md](memory-layout.md) — LocalInfo ExpertOptions.
- [protocol.md](protocol.md) — ident, and the LocalInfo `W` special path.
- [backup-restore.md](backup-restore.md) — LocalInfo is inspect-only today.
