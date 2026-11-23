# MD-9600 (RadioFoundry) — programming cable

Cable write for TYT MD-9600 running RadioFoundry. Egress `radio-io-md9600-radiofoundry` on `tyt-md9600-radiofoundry`. Write is **hidden on production** until bench-written.

|           |                                                                                         |
| --------- | --------------------------------------------------------------------------------------- |
| Transport | USB CDC-ACM **1FC9:0094**; USB serial mode.                                             |
| Baud      | 115200 8N1.                                                                           |
| Base      | **0**; ID directory `0x50000` and `0xD8000`–`0xE00000`.                                 |
| Identity  | VERSION: `MD-9600`, `MD9600`, `RT90`, `md9600` (see [firmware](../../radiofoundry/firmware.md)). |

## Related

- [cable write](../../radiofoundry/cable-write.md) · [limits.md](limits.md) · [capabilities.md](capabilities.md)