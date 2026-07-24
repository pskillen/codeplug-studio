# Browser radio I/O — outstanding

Items discovered or deferred while planning Milestone 2. File-format CSV work stays on format hubs — not listed here.

## Open

- [ ] Gate direct-write on firmware catalog — [#619](https://github.com/pskillen/codeplug-studio/issues/619) (depends on [#613](https://github.com/pskillen/codeplug-studio/issues/613))
- [x] Baofeng DM-1701 / RT-84 OpenGD77 adapter — [#624](https://github.com/pskillen/codeplug-studio/issues/624) (depends on [#623](https://github.com/pskillen/codeplug-studio/issues/623) docs + [#631](https://github.com/pskillen/codeplug-studio/issues/631) serial kit)
- [ ] TYT MD-9600 / RT-90 OpenGD77 adapter — [#625](https://github.com/pskillen/codeplug-studio/issues/625) (depends on [#623](https://github.com/pskillen/codeplug-studio/issues/623) docs + [#631](https://github.com/pskillen/codeplug-studio/issues/631) serial kit)
- [x] DM-32UV Web Serial adapter — [#638](https://github.com/pskillen/codeplug-studio/issues/638) (depends on [#637](https://github.com/pskillen/codeplug-studio/issues/637) docs + [#630](https://github.com/pskillen/codeplug-studio/issues/630) V-probe; parent epic [#636](https://github.com/pskillen/codeplug-studio/issues/636))
- [x] DM-32UV full modelled Write encode — [#667](https://github.com/pskillen/codeplug-studio/issues/667) (zones, scan, TGs, RX, digital contacts, APRS; analog contacts remain a known gap — file egress)
- [ ] PROGRAM→QX kit codec (`programQx.ts`) — [#641](https://github.com/pskillen/codeplug-studio/issues/641) (sibling surface; not Mini `BlockCodec`)
- [ ] RT95 VOX Web Serial adapter — [#643](https://github.com/pskillen/codeplug-studio/issues/643) (depends on [#642](https://github.com/pskillen/codeplug-studio/issues/642) docs + [#641](https://github.com/pskillen/codeplug-studio/issues/641) codec; parent epic [#640](https://github.com/pskillen/codeplug-studio/issues/640))
- [ ] Anytone DMR R/W kit codec — [#646](https://github.com/pskillen/codeplug-studio/issues/646) (sibling surface; 921600 + u32 BE; not RT95 `programQx` / Mini `BlockCodec`; parent epic [#645](https://github.com/pskillen/codeplug-studio/issues/645))
- [ ] AT-D890UV Web Serial adapter — [#649](https://github.com/pskillen/codeplug-studio/issues/649) (depends on [#647](https://github.com/pskillen/codeplug-studio/issues/647) docs + [#646](https://github.com/pskillen/codeplug-studio/issues/646) codec; parent epic [#645](https://github.com/pskillen/codeplug-studio/issues/645))

## Done (spike / docs / kit / first adapter / UI)

- [x] Architecture spike: reusable WebSerial protocol kit — [#603](https://github.com/pskillen/codeplug-studio/issues/603) (docs: [protocol-kit-architecture.md](protocol-kit-architecture.md))
- [x] OpenGD77 binary memory reference — [#623](https://github.com/pskillen/codeplug-studio/issues/623) (docs: [radios/opengd77](../../reference/radios/opengd77/README.md))
- [x] UV-5R Mini binary memory reference — [#627](https://github.com/pskillen/codeplug-studio/issues/627) (docs: [radios/baofeng/uv-5r-mini](../../reference/radios/baofeng/uv-5r-mini/README.md))
- [x] DM-32UV binary protocol / memory reference — [#637](https://github.com/pskillen/codeplug-studio/issues/637) (docs: [radios/baofeng/dm-32uv](../../reference/radios/baofeng/dm-32uv/README.md))
- [x] RT95 VOX binary protocol / memory reference — [#642](https://github.com/pskillen/codeplug-studio/issues/642) (docs: [radios/retevis/rt95](../../reference/radios/retevis/rt95/README.md))
- [x] AT-D890UV binary protocol / memory reference — [#647](https://github.com/pskillen/codeplug-studio/issues/647) (docs: [radios/anytone/at-d890uv](../../reference/radios/anytone/at-d890uv/README.md))
- [x] WebSerial `BytePipe` transport — [#615](https://github.com/pskillen/codeplug-studio/issues/615) (`src/integrations/radio-io/transport/`)
- [x] Protocol kit core (session, MemoryMap, R/W codec) — [#616](https://github.com/pskillen/codeplug-studio/issues/616) (`src/integrations/radio-io/kit/`)
- [x] V-probe kit codec — [#630](https://github.com/pskillen/codeplug-studio/issues/630) (`kit/codecs/vProbe.ts`)
- [x] OpenGD77/OpenUV380 serial kit codec — [#631](https://github.com/pskillen/codeplug-studio/issues/631) (`kit/codecs/opengd77Serial.ts`)
- [x] UV-5R Mini clone adapter + registry — [#617](https://github.com/pskillen/codeplug-studio/issues/617) (`radios/uv5r-mini/`, `registry.ts`, `radio-clone` hydration)
- [x] Connect/read/write UI + in-flow attribution — [#618](https://github.com/pskillen/codeplug-studio/issues/618) (`BuildRadioIoPanel` on Export)

## Explicitly out of MVP

- Yaesu / other NeonPlug radios beyond the first path
- Replacing NeonPlug as a product
- Free-text `cpsVersion` / `firmwareVersion` fields on builds (rejected; use [#613](https://github.com/pskillen/codeplug-studio/issues/613))

## Related

- [browser-radio-io-progress.md](browser-radio-io-progress.md)
- [radio-read-write hub](README.md)
