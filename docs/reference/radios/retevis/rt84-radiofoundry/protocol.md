# RT84 (RadioFoundry) — programming cable

Cable write for Retevis RT84 running RadioFoundry. Egress `radio-io-rt84-radiofoundry` on `retevis-rt84-radiofoundry`. Write is **hidden on production** until this radio has been bench-written (`prodWriteDisabled`).

|           |                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------- |
| Transport | USB CDC-ACM **1FC9:0094**; serial mode, not network mode `0x0096`.                                   |
| Baud      | 115200 8N1.                                                                                        |
| Base      | **0**; image end **0xE00000**.                                                                         |
| Identity  | VERSION accepts `DM-1701` and `dm1701` — see [RT84 and DM-1701](#rt84-and-dm-1701).                 |

## RT84 and DM-1701

RadioFoundry ships one board image for the DM-1701 family; an RT84 reports `board=DM-1701`. Studio cannot tell the two apart over the wire and accepts either board name on either RadioFoundry build. The codeplug file is the same. Upstream lists the RT84 panel and DFU key as unverified install facts, not codeplug fields.

## Bench-written by Studio

Not yet — cable Write stays hidden on production until then.

## Related

- [cable write](../../radiofoundry/cable-write.md) · [firmware](../../radiofoundry/firmware.md)