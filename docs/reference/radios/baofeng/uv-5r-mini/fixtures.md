# UV-5R Mini — fixture capture notes

How to obtain binary dumps for **directional** codec tests without committing personal codeplugs.

**Hub:** [README.md](README.md) · **Protocol:** [protocol.md](protocol.md)

## Privacy rules

- **Never** commit personal codeplugs, live radio dumps, or operator callsign images into this repo.
- Do not place real dumps under `sample-exports/` (personal CPS files are already out of git scope).
- Prefer **synthetic** fixtures: `0xFF`-filled image with a few hand-authored valid channels at known offsets.
- If a real dump is needed for local debugging, keep it **outside** the repo and sanitize before any share.

## Capture options (future / local)

| Method                  | When                                                                                                                                  | Notes                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| NeonPlug browser read   | Tooling available today                                                                                                               | Full clone → packed `0x8240`; keep local              |
| CHIRP download          | Desktop tool                                                                                                                          | Same `MEM_*` regions; GPL tool — facts only into docs |
| Studio Web Serial read  | After [#615](https://github.com/pskillen/codeplug-studio/issues/615) + [#617](https://github.com/pskillen/codeplug-studio/issues/617) | Read registered spans; save hex locally               |
| CHIRP CSV / `.neonplug` | Naming checks only                                                                                                                    | Prove names/semantics — **not** binary offsets        |

## Synthetic fixture recipe

1. Allocate `Uint8Array(0x8240)` filled with `0xFF`.
2. Place one known-good channel at index 0 using [channel-record.md](channel-record.md) (fixed RX/TX BCD, tones none, High power, FM, name `TEST`).
3. Optionally set a fake FW string at `0x1EF0` (ASCII, padded).
4. Keep callsigns / IDs fake.
5. When adapters land, store under `src/integrations/radio-io/**/__fixtures__/` — never under docs with real operator data.

## What this ticket verified without a dump

Acceptance for [#627](https://github.com/pskillen/codeplug-studio/issues/627) cross-checks offsets against NeonPlug + CHIRP layout constants. A live dump is valuable for adapter [#617](https://github.com/pskillen/codeplug-studio/issues/617) but is not required to land these reference pages.

## Related

- [protocol.md](protocol.md) · [memory-layout.md](memory-layout.md)
- Attribution: `/attributions` `chirp` + `neonplug`
- Shared testing policy: [docs/build/testing/fixtures.md](../../../../build/testing/fixtures.md)
