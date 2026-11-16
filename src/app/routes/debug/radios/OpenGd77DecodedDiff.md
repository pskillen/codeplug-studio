# OpenGD77 decoded comparison

## Purpose

`OpenGd77DecodedDiff` renders the decoded evidence difference between two OpenGD77 (DM-1701, MD-9600) debug reads: the FirmwareInfo identity fields and the User Database header.

## Props

`{ first, second }: DebugDecodedDiffProps`, two debug archives, supplied by the descriptor's `DecodedDiff` hook.

## Behaviour

- One line per field: `field: status · left → right`, status `Changed`, `Unchanged` or `Unavailable`.
- A missing source reads "Not captured"; an invalid FirmwareInfo or User Database header reads "Unavailable". Nothing is guessed.
- Decodes classified region bytes and the raw FirmwareInfo sidecar only, never decoded sidecar summaries.
- No responding-unit or provenance verdict: the FirmwareInfo reply has no serial.
- User Database regions are packed; regions with unknown address space are incomparable in the byte summary.

## Related

- `src/integrations/radio-io/radios/opengd77/debugCompare.ts`
- `Dm32DecodedDiff.md`
- `docs/reference/radios/opengd77/debug-capture.md`
