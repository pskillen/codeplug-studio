# UV-21Pro V2 — fixture capture notes

How to obtain binary dumps for **directional** codec tests without committing personal codeplugs.

**Hub:** [README.md](README.md) · **Protocol:** [protocol.md](protocol.md)

## Privacy rules

- **Never** commit personal codeplugs, live radio dumps, or operator callsign images into this repo.
- Prefer **synthetic** fixtures: `0xFF`-filled image with a few hand-authored valid channels at known offsets.
- If a real dump is needed for local debugging, keep it **outside** the repo and sanitize before any share.

## Capture options (future / local)

| Method                 | When   | Notes                                                 |
| ---------------------- | ------ | ----------------------------------------------------- |
| CHIRP download         | Desktop tool | Full clone → packed `0x8380`; GPL tool — facts only into docs |
| Studio Web Serial read | After adapter [#639](https://github.com/pskillen/codeplug-studio/issues/639) | Read registered spans; save hex locally               |
| CHIRP CSV              | Naming checks only | Prove names/semantics — **not** binary offsets        |

There is no NeonPlug file path for UV-21Pro V2.

## Synthetic fixture recipe

1. Allocate `Uint8Array(0x8380)` filled with `0xFF`.
2. Place one known-good channel at index 0 using [channel-record.md](channel-record.md) (fixed RX/TX BCD, tones none, High power, FM, name `TEST`).
3. Optionally set a fake FW string at `0x1EF0` (ASCII, padded).
4. Keep callsigns / IDs fake.
5. Store under `src/integrations/radio-io/**/__fixtures__/` — never under docs with real operator data.

## What docs verify without a dump

Layout constants cross-check against CHIRP `UV17Pro` / `UV21ProV2`. A live dump is valuable for hardware verify but is not required to land reference pages or mocked adapter tests.

## Related

- [protocol.md](protocol.md) · [memory-layout.md](memory-layout.md)
- Attribution: `/attributions` `chirp`
- Sibling: [UV-5R Mini fixtures](../uv-5r-mini/fixtures.md)
