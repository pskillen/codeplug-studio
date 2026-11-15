# RT95 debug memory capture

The debug read uses the existing guarded PROGRAM/QX session. It reads the two chip guard probes at `0x3B00` and `0x7B00` before attempting the MMD1 region. A refusal leaves the clone and calibration capture intact and records the reason and raw probes. On success it reads `0x4000–0x5FFF` as 512 aligned blocks into the inspect-only `rt95-mmd1` region. It sends no EEPROM write frames. Coverage remains partial and is not a physical backup.

MMD1, zone names, membership and ZST1 state are decoded with the existing radio codecs. Each member bitmap index maps to a one-based clone slot. Captured zones do not depend on clone availability. State validity is separate from zone validity. The viewer identifies P-key DIR as a stored value that compatible firmware uses as ZON; it cannot detect running firmware or a release. A compatibility claim requires a valid table and verified raw guard evidence.

Main-body EEPROM is reached through the head. The head can return checksum-valid zeros without a body reply, so captured bytes are not proof of a physical body response. Clone fields have unknown provenance and PC ident comes from the head. Hardware verification remains outstanding; fixtures are synthetic.

See [MMD1 layout](mm9pdy-data.md), [calibration](calibration.md) and [radio debug](../../../../features/radio-debug/README.md).
