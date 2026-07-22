# UV-5R Mini — PROGRAM + R/W protocol

Handshake and framing for Baofeng UV-5R Mini (UV-17Pro family) over Web Serial. Distinct from CHIRP CSV / `.neonplug` file interchange and from classic UV-5R **S/X**.

**Hub:** [README.md](README.md) · **Memory:** [memory-layout.md](memory-layout.md)

Cite: NeonPlug `baofengProtocol.ts`, `serialConnection.ts`, `constants.ts`; CHIRP `baofeng_uv17Pro.py` (facts only).

## Identity

| Item | Value |
| ---- | ----- |
| Ident (16 ASCII) | `PROGRAMCOLORPROU` (`MSTRING_UV17PROGPS`) |
| ACK / fingerprint | `0x06` |
| Block size | `0x40` |
| Read opcode | `0x52` (`R`) |
| Write opcode | `0x57` (`W`) |
| Crypt | XOR with symbol table; default **`encrsym = 1`** (`"CO 7"`) |

## Baud (documented disagreement)

| Source | Baud |
| ------ | ---- |
| NeonPlug `UV5RMINI_BAUD_RATE` | **38400** |
| CHIRP `UV17Pro.BAUD_RATE` (Mini does not override) | **115200** |

**Studio first Web Serial path:** prefer NeonPlug **38400** (browser lineage) and verify on hardware; document both so agents do not silently pick one.

## Handshake

1. Send ident `PROGRAMCOLORPROU`.
2. Expect ACK `0x06`.
3. Send magics (`F`, `M`, then `SEND!…` trailer).

### Magics (NeonPlug)

| Step | Payload | Expect |
| ---- | ------- | ------ |
| 1 | `0x46` (`F`) | 16 bytes |
| 2 | `0x4d` (`M`) | 15 bytes |
| 3 | `SEND!` + trailer; **last byte `0x00` = read**, **`0x01` = upload** | 1 byte |

CHIRP `_do_ident` uses the same ident + fingerprint, then magics with **last byte `0x00` for both** download and upload (no separate upload trailer).

## Frames

### Read

- Request: `0x52` + address (u16 BE) + length (`0x40`)
- Response: 4-byte header (starts `0x52`) + 64-byte payload → decrypt with `encrsym`

### Write

- Request: `0x57` + address (u16 BE) + `0x40` + **encrypted** 64-byte block
- Response: ACK `0x06`

## XOR crypt (summary)

- Table of 20 four-byte symbols; default index **1** → `0x43,0x4F,0x20,0x37` (`CO 7`)
- Per byte: XOR with symbol[`i % 4`] unless symbol byte is space (`0x20`), or data is `0` / `0xFF` / equal to symbol / equal to `symbol ^ 0xFF`
- Symmetric (same function encrypts and decrypts)

Do not paste CHIRP’s full table into Studio as GPL source — cite NeonPlug `baofengProtocol.ts` / CHIRP driver path when implementing.

## Typical session flow

1. Open serial at chosen baud (prefer 38400 for NeonPlug-compatible path).
2. Ident → ACK → read magics.
3. Read all `MEM_*` regions in `0x40` blocks → assemble packed `0x8240` image ([memory-layout.md](memory-layout.md)).
4. For channel upload: upload handshake (NeonPlug trailer `0x01`) → write channel span only (or full clone per CHIRP) → optional settings RMW ([settings.md](settings.md)).

## BLE (follow-up)

NeonPlug supports BLE (`FFE0` / `FFE1`, name filter `walkie-talkie`) with the same framing; CHIRP uses a larger BLE upload block (`0x80`) when BLE is active. **Out of scope** for this docs ticket and for closing adapter [#617](https://github.com/pskillen/codeplug-studio/issues/617) — note only.

## Related

- [fixtures.md](fixtures.md) · [memory-layout.md](memory-layout.md) · [settings.md](settings.md)
- Planned kit: transport [#615](https://github.com/pskillen/codeplug-studio/issues/615), protocol kit [#616](https://github.com/pskillen/codeplug-studio/issues/616)
