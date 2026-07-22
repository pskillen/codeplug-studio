# Browser radio I/O — progress

**Epic:** [#594](https://github.com/pskillen/codeplug-studio/issues/594) (under [#298](https://github.com/pskillen/codeplug-studio/issues/298) → [#495](https://github.com/pskillen/codeplug-studio/issues/495))  
**Constitution:** DESIGN.md allows intentional browser WebSerial radio I/O with attribution (see [#595](https://github.com/pskillen/codeplug-studio/issues/595)).  
**Hub:** [radio-read-write/README.md](README.md)

## Status

| Milestone                                 | Status                  | Notes                                                                                                                                                         |
| ----------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Milestone 1 — CHIRP CSV fidelity          | Complete (feature)      | UV-5R / UV-21 / RT95 profiles under [#504](https://github.com/pskillen/codeplug-studio/issues/504)                                                            |
| Milestone 2 — WebSerial direct read/write | Architecture documented | [#603](https://github.com/pskillen/codeplug-studio/issues/603) — [protocol-kit-architecture.md](protocol-kit-architecture.md); product code via child tickets |

## Shipped (foundation)

| Item                                       | Ticket / PR                                                    | Notes                                                                                            |
| ------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| DESIGN.md non-goal → intentional WebSerial | [#595](https://github.com/pskillen/codeplug-studio/issues/595) | Attribution requirement                                                                          |
| Attributions stubs (CHIRP + NeonPlug)      | [#597](https://github.com/pskillen/codeplug-studio/issues/597) | `AttributionsPage` / attributions lib                                                            |
| Progress docs under `radio-read-write/`    | [#603](https://github.com/pskillen/codeplug-studio/issues/603) | Moved from `import-export/`                                                                      |
| Protocol kit architecture deep-dive        | [#603](https://github.com/pskillen/codeplug-studio/issues/603) | [protocol-kit-architecture.md](protocol-kit-architecture.md)                                     |
| UV-5R Mini radio home                      | [#603](https://github.com/pskillen/codeplug-studio/issues/603) | [docs/reference/radios/baofeng/uv-5r-mini/](../../reference/radios/baofeng/uv-5r-mini/README.md) |
| OpenGD77 / OpenUV380 binary memory docs    | [#623](https://github.com/pskillen/codeplug-studio/issues/623) | [docs/reference/radios/opengd77/](../../reference/radios/opengd77/README.md); `qdmr` attribution |
| UV-5R Mini PROGRAM+R/W binary memory docs  | [#627](https://github.com/pskillen/codeplug-studio/issues/627) | [docs/reference/radios/baofeng/uv-5r-mini/](../../reference/radios/baofeng/uv-5r-mini/README.md); blocks [#617](https://github.com/pskillen/codeplug-studio/issues/617) |

## Next

1. Implement [#615](https://github.com/pskillen/codeplug-studio/issues/615) → [#616](https://github.com/pskillen/codeplug-studio/issues/616) → [#617](https://github.com/pskillen/codeplug-studio/issues/617) → [#618](https://github.com/pskillen/codeplug-studio/issues/618).
2. Wire firmware gating [#619](https://github.com/pskillen/codeplug-studio/issues/619) when catalog [#613](https://github.com/pskillen/codeplug-studio/issues/613) is ready.
3. OpenGD77 adapters after kit + memory docs: [#624](https://github.com/pskillen/codeplug-studio/issues/624) (DM-1701) · [#625](https://github.com/pskillen/codeplug-studio/issues/625) (MD-9600).
4. Later radios (UV-21 / RT95 direct-write) after Mini path — [#591](https://github.com/pskillen/codeplug-studio/issues/591) / [#592](https://github.com/pskillen/codeplug-studio/issues/592).

## Related

- [browser-radio-io-outstanding.md](browser-radio-io-outstanding.md)
- [CHIRP feature hub](../import-export/chirp/README.md)
- NeonPlug reference: `NeonPlug/src/radios/`
- CHIRP drivers: workspace `chirp/chirp/drivers/`
