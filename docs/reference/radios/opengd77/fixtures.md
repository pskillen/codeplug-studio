# OpenGD77 — fixture capture notes

How to obtain binary dumps for **directional** codec tests without committing personal codeplugs.

**Hub:** [README.md](README.md) · **Protocol:** [protocol.md](protocol.md)

## Privacy rules

- **Never** commit personal codeplugs, live radio dumps, or operator callsign/DMR-ID images into this repo.
- Do not place real dumps under `sample-exports/` (personal CPS files are already out of git scope).
- Prefer **synthetic** fixtures: zeroed or patterned buffers with a few hand-authored valid records at known offsets.
- If a real dump is needed for local debugging, keep it **outside** the repo (or local-only ignored paths) and sanitize before any share.

## Capture options (future / local)

| Method                 | When                                                                                    | Notes                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| qdmr read              | Tooling available today                                                                 | Use qdmr against hardware; export or save image for offline inspection — **facts only** into docs; fixtures stay local |
| Studio Web Serial read | After [#615](https://github.com/pskillen/codeplug-studio/issues/615) + OpenGD77 adapter | Read registered spans from [memory-layout.md](memory-layout.md); save hex locally                                      |
| CPS CSV round-trip     | Naming checks only                                                                      | CSV proves names/semantics, **not** binary offsets — see export-formats hub                                            |

## Synthetic fixture recipe

1. Allocate buffers matching OpenUV380 registered spans (see [memory-layout.md](memory-layout.md)).
2. Fill with `0xff` or `0x00` as appropriate for “empty” OpenGD77 records (channel names use `0xff` pad).
3. Place one known-good channel at bank0 index 0 using [channel-record.md](channel-record.md) offsets (fixed frequencies, mode, tones `0xffff`).
4. Optionally place one contact and one zone; keep DMR IDs / callsigns **fake** (`9999999`, `TEST`).
5. Store under a test-only path such as `src/integrations/radio-io/**/__fixtures__/` when adapters land — never under docs with real operator data.

## What this ticket verified without a dump

Acceptance for [#623](https://github.com/pskillen/codeplug-studio/issues/623) cross-checks offsets against qdmr `Offset` / `Limit` / `size()` constants. A live dump is valuable for adapter tickets ([#624](https://github.com/pskillen/codeplug-studio/issues/624), [#625](https://github.com/pskillen/codeplug-studio/issues/625)) but is not required to land these reference pages.

## Related

- [protocol.md](protocol.md) · [memory-layout.md](memory-layout.md)
- Attribution: `/attributions` `qdmr`
