# UV-5R Mini — memory layout / protocol stub

Tier-3 notes for **PROGRAM + R/W** clone I/O (Web Serial / future BLE). Full frame tables land with the first radio-io adapter ticket; this page captures ground-truth constants for planning.

**Product hub:** [radio-read-write](../../../../features/radio-read-write/README.md) · [protocol-kit architecture](../../../../features/radio-read-write/protocol-kit-architecture.md)

**File adapters (CSV / `.neonplug`):** [export-formats/chirp](../../../export-formats/chirp/README.md) · [export-formats/neonplug](../../../export-formats/neonplug/README.md)

## Protocol family

| Item | Value |
| --- | --- |
| Family | **PROGRAM + R/W** (not classic UV-5R **S/X**) |
| Ident | `PROGRAMCOLORPROU` (`MSTRING_UV17PROGPS`) |
| Baud | **38400** (NeonPlug) |
| Image size | `MEM_TOTAL = 0x8240` (multi-region `MEM_STARTS` / `MEM_SIZES`) |
| Block ops | Read `0x52` (`R`), Write `W`; ACK `0x06` |
| Crypt | Optional payload **XOR** crypt |
| BLE | Optional later — same framing; larger upload block (`BLE_UP_BLOCK_SIZE = 0x80`) |
| Channels | Up to **999** (see [limits.md](limits.md)) |

Classic **UV-5R** uses **S/X** — do not merge that path into this codec.

## Ground truth

| Source | Role |
| --- | --- |
| CHIRP `UV5RMini` in [`baofeng_uv17Pro.py`](https://github.com/kk7ds/chirp/blob/master/chirp/drivers/baofeng_uv17Pro.py) | Caps, R/W protocol, crypt, memory regions |
| NeonPlug [`src/radios/uv5rmini/`](https://github.com/infamy/NeonPlug/tree/main/src/radios/uv5rmini) | Browser framing (`baofengProtocol.ts`, `serialConnection.ts`, channel map) |

## Planned Studio module

`src/integrations/radio-io/radios/uv5r-mini/` — handshake, layout, encode (see protocol-kit architecture).

## Related

- [README.md](README.md) · [power.md](power.md)
- Adapter stubs: [chirp-uv5r](../../../export-formats/chirp/radios/chirp-uv5r.md) · [uv5rmini](../../../export-formats/neonplug/radios/uv5rmini.md)
