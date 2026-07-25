# OpenGD77 MD-9600 / RT-90 Web Serial — progress

**Tracking:** [#625](https://github.com/pskillen/codeplug-studio/issues/625) · epic [#634](https://github.com/pskillen/codeplug-studio/issues/634)  
**Branch:** `625/pskil/opengd77-md9600`

## Status

| Slice                                     | State |
| ----------------------------------------- | ----- |
| 0 Branch + progress stubs                 | Done  |
| 1 Power ladder parameterisation           | Done  |
| 2 Descriptor / registry / Write gate copy | Done  |
| 3 Core profile / traits / catalog egress  | Done  |
| 4 Write projection                        | Done  |
| 5 Documentation                           | Done  |
| 6 Pre-PR verify + PR                      | Done  |

## Shipped this branch

- `OPENGD77_MD9600_POWER_STEPS` + parameterized channel codec / `OpenGd77Protocol`
- `md9600/descriptor.ts`, registry, `createOpenGd77Md9600Protocol` (`radioType 0x05`)
- `prodWriteDisabled` + profile copy in `radioWriteEnvGate.ts`
- `radio-io-opengd77-md9600` profile, traits, catalog Web Serial egress on `tyt-md9600`
- Write projection branch for OpenGD77 MD-9600 (lean 1:1)
- Hub / power / feature README updates

## Manual verify (pending hardware)

- [ ] Read from MD-9600 / RT-90 over Web Serial
- [ ] Write small change → Read-back (pre-prod only until gate cleared)
- [ ] Confirm power steps on radio match ladder
- [ ] Confirm unmodelled regions retained after Write
- [ ] Clear `prodWriteDisabled` + gate copy after successful verify

## Related

- [opengd77-md9600-outstanding.md](opengd77-md9600-outstanding.md)
- Shared family: [opengd77-dm1701-progress.md](opengd77-dm1701-progress.md) (#624)
- Tier-3: [docs/reference/radios/tyt/md-9600/](../../reference/radios/tyt/md-9600/)
