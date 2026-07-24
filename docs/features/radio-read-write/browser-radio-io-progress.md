# Browser radio I/O — progress

**Epic:** [#594](https://github.com/pskillen/codeplug-studio/issues/594) (under [#298](https://github.com/pskillen/codeplug-studio/issues/298) → [#495](https://github.com/pskillen/codeplug-studio/issues/495))  
**Constitution:** DESIGN.md allows intentional browser WebSerial radio I/O with attribution (see [#595](https://github.com/pskillen/codeplug-studio/issues/595)).  
**Hub:** [radio-read-write/README.md](README.md)

## Status

| Milestone                                 | Status             | Notes                                                                                                                                             |
| ----------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Milestone 1 — CHIRP CSV fidelity          | Complete (feature) | UV-5R / UV-21 / RT95 profiles under [#504](https://github.com/pskillen/codeplug-studio/issues/504)                                                |
| Milestone 2 — WebSerial direct read/write | Mini path shipped  | Adapter [#617](https://github.com/pskillen/codeplug-studio/issues/617) + Export UI [#618](https://github.com/pskillen/codeplug-studio/issues/618) |

## Shipped (foundation)

| Item                                           | Ticket / PR                                                    | Notes                                                                                                                                                                                                                                        |
| ---------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DESIGN.md non-goal → intentional WebSerial     | [#595](https://github.com/pskillen/codeplug-studio/issues/595) | Attribution requirement                                                                                                                                                                                                                      |
| Attributions stubs (CHIRP + NeonPlug)          | [#597](https://github.com/pskillen/codeplug-studio/issues/597) | `AttributionsPage` / attributions lib                                                                                                                                                                                                        |
| Progress docs under `radio-read-write/`        | [#603](https://github.com/pskillen/codeplug-studio/issues/603) | Moved from `import-export/`                                                                                                                                                                                                                  |
| Protocol kit architecture deep-dive            | [#603](https://github.com/pskillen/codeplug-studio/issues/603) | [protocol-kit-architecture.md](protocol-kit-architecture.md)                                                                                                                                                                                 |
| UV-5R Mini radio home                          | [#603](https://github.com/pskillen/codeplug-studio/issues/603) | [docs/reference/radios/baofeng/uv-5r-mini/](../../reference/radios/baofeng/uv-5r-mini/README.md)                                                                                                                                             |
| UV-5R Mini clone adapter + registry            | [#617](https://github.com/pskillen/codeplug-studio/issues/617) | `radios/uv5r-mini/`; `radio-clone` hydration; checklist [adding-a-radio-adapter.md](adding-a-radio-adapter.md)                                                                                                                               |
| Connect/read/write UI + in-flow attribution    | [#618](https://github.com/pskillen/codeplug-studio/issues/618) | `BuildRadioIoPanel` on **Direct radio** (`radio-io`) Export; FormatBuild `radio-clone` hydration; no CPS file export                                                                                                                         |
| OpenGD77 / OpenUV380 binary memory docs        | [#623](https://github.com/pskillen/codeplug-studio/issues/623) | [docs/reference/radios/opengd77/](../../reference/radios/opengd77/README.md); `qdmr` attribution                                                                                                                                             |
| UV-5R Mini PROGRAM+R/W binary memory docs      | [#627](https://github.com/pskillen/codeplug-studio/issues/627) | [docs/reference/radios/baofeng/uv-5r-mini/](../../reference/radios/baofeng/uv-5r-mini/README.md); blocks [#617](https://github.com/pskillen/codeplug-studio/issues/617)                                                                      |
| WebSerial `BytePipe` transport                 | [#615](https://github.com/pskillen/codeplug-studio/issues/615) | `src/integrations/radio-io/transport/` — feature-detect, buffered `readExact` / `write`                                                                                                                                                      |
| Protocol kit (MemoryMap, session, PROGRAM+R/W) | [#616](https://github.com/pskillen/codeplug-studio/issues/616) | `src/integrations/radio-io/kit/` — no DOM; XOR/magics/layout deferred to radio adapters                                                                                                                                                      |
| V-probe kit codec                              | [#630](https://github.com/pskillen/codeplug-studio/issues/630) | `kit/codecs/vProbe.ts` — sibling surface (not `BlockCodec`)                                                                                                                                                                                  |
| OpenGD77/OpenUV380 serial kit codec            | [#631](https://github.com/pskillen/codeplug-studio/issues/631) | `kit/codecs/opengd77Serial.ts` — C/R/W/X framing; blocks [#624](https://github.com/pskillen/codeplug-studio/issues/624)/[#625](https://github.com/pskillen/codeplug-studio/issues/625)                                                       |
| DM-32UV binary protocol / memory docs          | [#637](https://github.com/pskillen/codeplug-studio/issues/637) | [docs/reference/radios/baofeng/dm-32uv/](../../reference/radios/baofeng/dm-32uv/README.md); parent [#636](https://github.com/pskillen/codeplug-studio/issues/636)                                                                            |
| DM-32UV V-frame / block clone adapter          | [#638](https://github.com/pskillen/codeplug-studio/issues/638) | `radios/dm32uv/`; sparse `radio-clone` retain; `radio-io-dm32uv` on `baofeng-dm32uv`                                                                                                                                                         |
| DM-32UV full modelled Write encode             | [#667](https://github.com/pskillen/codeplug-studio/issues/667) | `RadioWriteProjection` + zone/scan/TG/RX/digital-contact/APRS codecs; analog contacts gap in UI                                                                                                                                              |
| RT95 VOX binary protocol / memory docs         | [#642](https://github.com/pskillen/codeplug-studio/issues/642) | [docs/reference/radios/retevis/rt95/](../../reference/radios/retevis/rt95/README.md); blocks [#643](https://github.com/pskillen/codeplug-studio/issues/643); parent [#640](https://github.com/pskillen/codeplug-studio/issues/640)           |
| AT-D890UV binary protocol / memory docs        | [#647](https://github.com/pskillen/codeplug-studio/issues/647) | [docs/reference/radios/anytone/at-d890uv/](../../reference/radios/anytone/at-d890uv/README.md); blocks [#649](https://github.com/pskillen/codeplug-studio/issues/649); parent [#645](https://github.com/pskillen/codeplug-studio/issues/645) |

## Next

1. Wire firmware gating [#619](https://github.com/pskillen/codeplug-studio/issues/619) when catalog [#613](https://github.com/pskillen/codeplug-studio/issues/613) is ready (more important for DM-32UV than Mini).
2. OpenGD77 adapters (kit codec ready): [#624](https://github.com/pskillen/codeplug-studio/issues/624) (DM-1701) · [#625](https://github.com/pskillen/codeplug-studio/issues/625) (MD-9600).
3. RT95 PROGRAM→QX kit codec [#641](https://github.com/pskillen/codeplug-studio/issues/641) → adapter [#643](https://github.com/pskillen/codeplug-studio/issues/643) (epic [#640](https://github.com/pskillen/codeplug-studio/issues/640); docs [#642](https://github.com/pskillen/codeplug-studio/issues/642) shipped).
4. Anytone DMR kit codec [#646](https://github.com/pskillen/codeplug-studio/issues/646) → D890 adapter [#649](https://github.com/pskillen/codeplug-studio/issues/649) (epic [#645](https://github.com/pskillen/codeplug-studio/issues/645); docs [#647](https://github.com/pskillen/codeplug-studio/issues/647) shipped).

## Related

- [browser-radio-io-outstanding.md](browser-radio-io-outstanding.md)
- [CHIRP feature hub](../import-export/chirp/README.md)
- NeonPlug reference: `NeonPlug/src/radios/`
- CHIRP drivers: workspace `chirp/chirp/drivers/`
