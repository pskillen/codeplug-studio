# RT90 (RadioFoundry) — programming cable

Egress `radio-io-rt90-radiofoundry` on `retevis-rt90-radiofoundry`. Write hidden on production until bench-written.

## RT90 and MD-9600

RadioFoundry uses the MD-9600 board image on the RT90. An RT90 may report `board=MD-9600`. Studio accepts the mobile board names on either build. The codeplug is the same.

## Transport

USB CDC-ACM **1FC9:0094**, 115200, base **0**, image end **0xE00000**. VERSION names match the MD-9600 board list.

## Bench-written by Studio

Not yet.

## Related

- [cable write](../../radiofoundry/cable-write.md) · [MD-9600 (RadioFoundry) protocol](../../tyt/md-9600-radiofoundry/protocol.md)
