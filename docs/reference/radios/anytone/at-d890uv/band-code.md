# AT-D890UV band code (frequency range)

The official CPS lets the operator pick a **frequency range** (Europe, US, commercial, amateur, …). This page records what is known about where that choice lives on the radio and what Studio would need to change it ([#1369](https://github.com/pskillen/codeplug-studio/issues/1369)). **Studio shows the range read-only (Backup page, LocalInfo decode) and uses the firmware table for the receive-only check; changing it is not implemented, and the hardware tests in "Open questions" have not been run.**

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
- **Changing the range resets the radio** at the next boot: channels, zones, scan lists and the whole settings unit are cleared and the tune bank is rewritten. Changing it stays on [#1369](https://github.com/pskillen/codeplug-studio/issues/1369) and is not implemented in Studio.
- **Single-frame `W` write** of the range byte: facts recorded from the firmware's code only, **not radio-tested**.
- **Calibration bank pair** `0x04F00000` / `0x04F40000` holds the tune data that is rewritten on a range change; Studio's vital-data backup reads and saves it (see [backup-restore.md](backup-restore.md#vital-data-backup)).

### How Studio uses it

- Read-only display: the Backup page's LocalInfo decode shows "Frequency range: <caption> (code N) · TX …"; the ident reply carries the same byte (`AtD890Ident.bandCode`).
- Studio **never writes LocalInfo**.
- **Every channel the hardware can receive is written.** Once the Review step (PR 4c) lands, the Write's Review will warn, from the connected radio's code, about channels whose TX frequency is outside that radio's TX table (`listAtD890ReceiveOnlyChannels`): they are written and are receive-only on that radio. Nothing is stored per build. Build-level eligibility ([capabilities.md](capabilities.md)) is unchanged.

## What changing it would take

1. **Write LocalInfo.** The firmware's own writer erases the whole 256 KiB unit and rewrites it, keeping an A/B pair (`0x04F80000` / `0x04FC0000`) with live/stale markers. The same unit holds the **serial number** (`+0x30`) and stun/kill flags, which Studio's restore checks treat as identity. A partial or interrupted write could lose the serial, so the plan must be read-modify-write of the live unit with a verified read-back, the existing erase-unit machinery ([flash-sectors.md](flash-sectors.md), `sparseEraseRmw.ts`), and a mandatory Backup first. Never touch the sector markers.
2. **Extend the write allow-list.** LocalInfo is deliberately outside it ([#753](https://github.com/pskillen/codeplug-studio/issues/753)); `writableExtents.ts` / `writeRole.ts` must gain a narrow, single-byte (`+0x03`) extent, only reachable through an explicit opt-in action, never through a build Write.
3. **Product shape.** An opt-in control on the radio-io page: show the current code and its ranges (Read already fetches LocalInfo), pick a target code, show a warning (may exceed the radio's type approval; operator is responsible for lawful use; the official CPS will refuse to write until its codeplug is re-created with the new range), then write and verify.
4. **Eligibility follows the code.** The D890 channel-eligibility bands ([capabilities.md](capabilities.md)) are currently fixed at 136–174 / 400–480 MHz RX-TX. With a known code they should come from the table above.

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
- [protocol.md](protocol.md) — ident.
- [backup-restore.md](backup-restore.md) — LocalInfo is inspect-only today.
