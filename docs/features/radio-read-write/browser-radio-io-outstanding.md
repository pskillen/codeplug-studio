# Browser radio I/O — outstanding

Items discovered or deferred while planning Milestone 2. File-format CSV work stays on format hubs — not listed here.

## Open

- [ ] UV-5R Mini clone adapter — [#617](https://github.com/pskillen/codeplug-studio/issues/617) (depends on [#627](https://github.com/pskillen/codeplug-studio/issues/627) docs + kit)
- [ ] Connect/read/write UI + in-flow attribution — [#618](https://github.com/pskillen/codeplug-studio/issues/618)
- [ ] Gate direct-write on firmware catalog — [#619](https://github.com/pskillen/codeplug-studio/issues/619) (depends on [#613](https://github.com/pskillen/codeplug-studio/issues/613))
- [ ] In-flow attribution chrome when direct-write ships — tracked on [#618](https://github.com/pskillen/codeplug-studio/issues/618) / stubs [#597](https://github.com/pskillen/codeplug-studio/issues/597)
- [ ] Baofeng DM-1701 / RT-84 OpenGD77 adapter — [#624](https://github.com/pskillen/codeplug-studio/issues/624) (depends on [#623](https://github.com/pskillen/codeplug-studio/issues/623) docs + [#631](https://github.com/pskillen/codeplug-studio/issues/631) serial kit)
- [ ] TYT MD-9600 / RT-90 OpenGD77 adapter — [#625](https://github.com/pskillen/codeplug-studio/issues/625) (depends on [#623](https://github.com/pskillen/codeplug-studio/issues/623) docs + [#631](https://github.com/pskillen/codeplug-studio/issues/631) serial kit)
- [ ] UV-21 / RT95 direct-write only after protocol kit — track under [#591](https://github.com/pskillen/codeplug-studio/issues/591) / [#592](https://github.com/pskillen/codeplug-studio/issues/592)

## Done (spike / docs / kit)

- [x] Architecture spike: reusable WebSerial protocol kit — [#603](https://github.com/pskillen/codeplug-studio/issues/603) (docs: [protocol-kit-architecture.md](protocol-kit-architecture.md))
- [x] OpenGD77 binary memory reference — [#623](https://github.com/pskillen/codeplug-studio/issues/623) (docs: [radios/opengd77](../../reference/radios/opengd77/README.md))
- [x] UV-5R Mini binary memory reference — [#627](https://github.com/pskillen/codeplug-studio/issues/627) (docs: [radios/baofeng/uv-5r-mini](../../reference/radios/baofeng/uv-5r-mini/README.md))
- [x] WebSerial `BytePipe` transport — [#615](https://github.com/pskillen/codeplug-studio/issues/615) (`src/integrations/radio-io/transport/`)
- [x] Protocol kit core (session, MemoryMap, R/W codec) — [#616](https://github.com/pskillen/codeplug-studio/issues/616) (`src/integrations/radio-io/kit/`)
- [x] V-probe kit codec — [#630](https://github.com/pskillen/codeplug-studio/issues/630) (`kit/codecs/vProbe.ts`)
- [x] OpenGD77/OpenUV380 serial kit codec — [#631](https://github.com/pskillen/codeplug-studio/issues/631) (`kit/codecs/opengd77Serial.ts`)

## Explicitly out of MVP

- Yaesu / other NeonPlug radios beyond the first path
- Replacing NeonPlug as a product
- Free-text `cpsVersion` / `firmwareVersion` fields on builds (rejected; use [#613](https://github.com/pskillen/codeplug-studio/issues/613))

## Related

- [browser-radio-io-progress.md](browser-radio-io-progress.md)
- [radio-read-write hub](README.md)
