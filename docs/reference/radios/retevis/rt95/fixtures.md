# RT95 VOX — fixture capture notes

How to obtain binary dumps for **directional** codec tests without committing personal codeplugs.

**Hub:** [README.md](README.md) · **Protocol:** [protocol.md](protocol.md)

## Privacy rules

- **Never** commit personal codeplugs, live radio dumps, or operator callsign images into this repo.
- Do not place real dumps under `sample-exports/` (personal CPS files are already out of git scope).
- Prefer **synthetic** fixtures: `0xFF`- or zero-filled image with a few hand-authored valid channels at known offsets.
- If a real dump is needed for local debugging, keep it **outside** the repo and sanitize before any share.

## Capture options (future / local)

| Method                 | When                                                                                                                                  | Notes                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| CHIRP download         | Desktop tool today                                                                                                                    | Contiguous `0x32A0` image; GPL tool — facts only into docs |
| Studio Web Serial read | After [#641](https://github.com/pskillen/codeplug-studio/issues/641) + [#643](https://github.com/pskillen/codeplug-studio/issues/643) | Echo-strip PROGRAM→QX; save hex locally                    |
| CHIRP CSV              | Naming / watt checks only                                                                                                             | Prove names/semantics — **not** binary offsets             |
| NeonPlug               | N/A                                                                                                                                   | **No** RT95 / 778 path                                     |

## Synthetic fixture recipe

1. Allocate `Uint8Array(0x32A0)` (prefer `0x00` or `0xFF` fill — match whatever empty occupancy expects when implementing).
2. Place one known-good channel at memory **1** (offset `0x0000`) using [channel-record.md](channel-record.md): fixed RX BCD, duplex none, High power, 25 kHz, name `TEST01`, tones off.
3. Set occupied bit 0 in the bitfield at `0x1940`.
4. Optionally set `bandlimit` at `0x326D` to `0x01` (wide amateur table).
5. Keep callsigns / IDs fake.
6. When adapters land, store under `src/integrations/radio-io/**/__fixtures__/` — never under docs with real operator data.

## What this ticket verified without a dump

Acceptance for [#642](https://github.com/pskillen/codeplug-studio/issues/642) cross-checks offsets and protocol constants against CHIRP `anytone778uv.py`. A live dump is valuable for adapter [#643](https://github.com/pskillen/codeplug-studio/issues/643) but is not required to land these reference pages.

## Related

- [protocol.md](protocol.md) · [memory-layout.md](memory-layout.md)
- Attribution: `/attributions` `chirp`
- Shared testing policy: [docs/build/testing/fixtures.md](../../../../build/testing/fixtures.md)
