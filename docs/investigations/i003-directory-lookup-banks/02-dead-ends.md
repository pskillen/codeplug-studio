# Dead ends — do not re-chase

**Append-only.** Killed hypotheses only. If hardware later resurrects one, delete it here and put a new findings row with the new evidence — do not annotate in place.

When in doubt, leave it in `05-open-items.md`.

---

## Killed on the 2026-08-15 source-read

| Hypothesis                                                                                                                                | Killed by                                                  | Why it's dead                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backup / Restore “1024 DMR contacts” is the User Database occupancy / cap                                                                 | `S/2026-08-15-code`; G3; G5                                | Inspect decodes only the contact bank. User Database FLASH is not in `OPENUV380_FLASH_SPANS`.                                                                  |
| OpenGD77 1701 directory belongs at stock TYT `0x140000` (10 000 contacts)                                                                 | `S/2026-08-15-qdmr`; OpenGD77 vs stock split in radio docs | That geometry is **stock** DM-1701 firmware. OpenGD77 uses OpenUV380 codeplug + call-sign DB.                                                                  |
| qdmr UV380 callsign DB starts at `0x30000` (as the `.hh` file comment says)                                                               | `S/2026-08-15-qdmr` `Offset` + `encode()`                  | Comment is GD-77 copy-paste. Encode uses `0x50000` / `0xd8000`. Still not a live 1701 proof.                                                                   |
| OpenGD77 `SeparateDigitalIdList` means a second _contact_ bank like DM-32 `0x67`                                                          | G1–G4                                                      | The second firmware store is the User Database. Directory was stuffed into the _first_ bank (pre-#1211).                                                       |
| Directory belongs in the OpenGD77 1024 contact bank / `Contacts.csv`                                                                      | `S/2026-08-15-impl`; G10                                   | Encode targets User Database; CPS warns and does not stuff `Contacts.csv`. LCD lookup still unproven (H1).                                                     |
| Studio cannot transfer User Database without stretching `IMAGE_END` / walking qdmr `size1`                                                | `S/2026-08-15-impl`; G9                                    | Occupied-sector sidecar write + inspect-only occupied backup. Programming image end unchanged.                                                                 |
| Dual-bank code must always skip directory rows that match a library `digitalId`                                                           | `S/2026-08-15-impl`; C4                                    | OpenGD77 keeps overlap. D890 skip remains (shared bank). DM-32 skip remains until #1220.                                                                       |
| Directory belongs in DM-32 operator radio IDs (`0x67` / `DMR-ID.csv`); `buildDm32RadioIdBank` should merge directory with channel `dmrId` | `S/2026-08-15-impl`; D7; D9; #1220                         | Pre-#1220 encode. `0x67` is TX identity; directory Write is `0x0F`.                                                                                            |
| Dual-bank streaming on DM-32 should **stop** skipping overlapping `digitalId`s once directory leaves `0x67` (I003-C4)                     | P2; D8; C5                                                 | Shared `0x0F` is a single bank — skip on Both. C4 applied to the wrong-bank dump.                                                                              |
| AT-D890 has a hidden User Database besides `DigitalContact*` that directory should use                                                    | `S/2026-08-15-d890`; A1–A3                                 | `DigitalContact*` **is** the 500k metadata bank. RadioId\* is operator TX identity (correctly not used for directory). Talk groups are a different list (10k). |
| Dual-bank radios should skip directory rows that match a library `digitalId`                                                              | P2                                                         | Operator: keep the ID in **both** stores when banks are separate. Skip is only for a **shared** bank.                                                          |

### Deliberately NOT in this file

- **“MD-9600 silent-repeater LCD miss means User Database encode is wrong.”** Not tested. `O/2026-08-18-lcd-silent` does not include a confirmed UDB `'X'` on that radio. Stay in H8/H9.
