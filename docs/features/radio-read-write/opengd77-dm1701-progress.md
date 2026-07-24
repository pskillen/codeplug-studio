# OpenGD77 DM-1701 Web Serial — progress

**Tracking:** [#624](https://github.com/pskillen/codeplug-studio/issues/624) · epic [#634](https://github.com/pskillen/codeplug-studio/issues/634)  
**Branch:** `624/pskil/opengd77-dm1701-write`

## Status

| Slice | State |
| --- | --- |
| 1 Memory + channel codec | Done |
| 2 Organisation codecs + hydration | Done |
| 3 Serial protocol | Done |
| 4 Descriptor / registry / profile | Done |
| 5 Write projection | Done |
| 6 Radio image UI | Pending |
| 7 Documentation | Pending |

## Shipped this branch

- OpenUV380 constants, memory helpers, channel codec + tests
- Zone / contact / RX group codecs, writeRole, hydration merge + tests
- Serial protocol download (`R` FLASH spans) + `'X'` dirty-sector upload + mocked pipe tests
- DM-1701 descriptor, registry, `radio-io-opengd77-1701` profile, catalog Web Serial egress
- `buildRadioWriteProjection` OpenGD77 branch (contacts/RX/zones + scan/forbid stamps) + prepare-write tests

## Related

- [opengd77-dm1701-outstanding.md](opengd77-dm1701-outstanding.md)
- Tier-3: [docs/reference/radios/opengd77/](../../reference/radios/opengd77/)
- Kit codec: `src/integrations/radio-io/kit/codecs/opengd77Serial.ts` (#631)
