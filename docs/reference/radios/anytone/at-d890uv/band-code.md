# AT-D890UV band code (frequency range)

The official CPS lets the operator pick a **frequency range** (Europe, US, commercial, amateur, …). This page records what is known about where that choice lives on the radio and what Studio would need to change it ([#1369](https://github.com/pskillen/codeplug-studio/issues/1369)). **Investigation only: nothing here is implemented, and the hardware tests in "Open questions" have not been run.**

Evidence comes from the MM9PDY firmware reverse-engineering notes (`anytone-d890-firmware`: `docs/reference/cps/protocol.md`, `docs/reference/firmware/calibration-and-identity.md`, `pc-link-protocol.md`, findings F51 / F73), and from a real read of one radio.

## Where the value lives

| Fact                     | Detail                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Radio-side copy**      | LocalInfo `+0x03` (`0x04F80003`), RAM `0x20015277`. One byte.                                                                                                                                    |
| **Reported to the CPS**  | Ident reply byte 8 (the "band code"). Studio parses it as `AtD890Ident.bandCode` ([connection.ts](../../../../../src/integrations/radio-io/radios/at-d890uv/connection.ts)) but does not use it. |
| **CPS-side copy**        | Saved with the codeplug file. On **Write** the CPS refuses the radio, and closes the port without `END`, if the radio's band code differs from the file's.                                       |
| **Who writes LocalInfo** | The official CPS **never** writes it. It is not a codeplug value. This is why the CPS cannot change the range for an existing radio: the codeplug file is bound to the radio's code.             |
| **Sample radio**         | LocalInfo `+0x00…+0x0F` = `00 00 00 03 01 01 09 00 00 01 01 20 20 20 20 FF`, so band code `3`.                                                                                                   |

So the working assumption that the setting is "a value within the codeplug" is **not** supported by the evidence. It is a LocalInfo byte, outside the codeplug write set. Changing it is a LocalInfo write, not part of a normal channel/zone Write session. Still to confirm on hardware (see below).

Studio's existing field hints name `+0x03` "frequency mode" (from anytone-cps `ExpertOptions`) and `+0x06` "band select"; the firmware notes call `+0x03` the variant / band code. These are the same byte seen from two projects. The role of `+0x06` and the 4-byte "band password" at `+0x0B` is unknown.

## Band code table

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

The names Europe / US / commercial / amateur are CPS UI captions. Their mapping to codes is not in the notes and needs a CPS capture.

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
