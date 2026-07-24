# OpenGD77 DM-1701 Web Serial — progress

**Tracking:** [#624](https://github.com/pskillen/codeplug-studio/issues/624) · epic [#634](https://github.com/pskillen/codeplug-studio/issues/634)  
**Branch:** `624/pskil/opengd77-dm1701-write`

## Status

| Slice | State |
| --- | --- |
| 1 Memory + channel codec | Done |
| 2 Organisation codecs + hydration | Done |
| 3 Serial protocol | Pending |
| 4 Descriptor / registry / profile | Pending |
| 5 Write projection | Pending |
| 6 Radio image UI | Pending |
| 7 Documentation | Pending |

## Shipped this branch

- OpenUV380 constants, memory helpers, channel codec + tests
- Zone / contact / RX group codecs, writeRole, hydration merge + tests

## Related

- [opengd77-dm1701-outstanding.md](opengd77-dm1701-outstanding.md)
- Tier-3: [docs/reference/radios/opengd77/](../../reference/radios/opengd77/)
- Kit codec: `src/integrations/radio-io/kit/codecs/opengd77Serial.ts` (#631)
