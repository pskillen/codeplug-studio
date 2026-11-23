# DM-1701 (RadioFoundry) — programming cable

Cable write for a Baofeng DM-1701 running RadioFoundry. Egress profile `radio-io-dm1701-radiofoundry` on target `baofeng-dm1701-radiofoundry`. Desktop uses Web Serial; Android uses the same baud on USB serial.

|           |                                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Transport | USB CDC-ACM **1FC9:0094** (same USB IDs as OpenGD77). The port list does not say which firmware runs; Studio learns from INFO/VERSION. |
| Mode      | USB **serial** mode required; USB network mode `0x0096` has no serial port.                                                      |
| Baud      | 115200 8N1.                                                                                                                    |
| Addresses | Image offsets from physical base **0**; image end **0xE00000**.                                                                  |
| Identity  | INFO, then VERSION. Accepted `board=` values: `DM-1701`, `dm1701` (see [firmware](../../radiofoundry/firmware.md)).              |

## Digital contacts

ID directory: area 1 at image `0x50000`, area 2 from `0xD8000` through `0xE00000` (520646 records total). See [cable write](../../radiofoundry/cable-write.md#digital-contacts).

## Bench-written by Studio

Not yet.

## Related

- [cable write](../../radiofoundry/cable-write.md) · [RadioFoundry firmware](../../radiofoundry/firmware.md) · [limits.md](limits.md)