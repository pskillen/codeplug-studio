# MD-9600 — capabilities

## Feature availability

Same OpenGD77 modelling posture as the DM-1701 family for DMR / analogue / TG lists / APRS / DTMF — see [DM-1701 capabilities](../../baofeng/dm-1701/capabilities.md). Mobile form factor and higher RF power (see [power.md](power.md)).

## `+W-` (User Power) — not modelled in Studio

The radio menu also offers **`+W-`**. That selects **User Power** from **Options → Radio Options → User Power**: a raw ADC voltage that drives the power amplifier (PA), not a wattage step on the P-index ladder.

Studio does **not** model User Power / `+W-`. Library `power` and OpenGD77 export only use `Master` and `P1`…`P9`. Operators who need custom PA drive set it on the radio (or in CPS radio options), not in Studio.

## Related

- [limits.md](limits.md) · [power.md](power.md)
- OpenGD77 DTMF / APRS: [dtmf-aprs.md](../../../export-formats/opengd77/dtmf-aprs.md)
