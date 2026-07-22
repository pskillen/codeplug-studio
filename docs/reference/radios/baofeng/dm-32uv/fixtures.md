# DM-32UV — fixture capture notes

How to obtain binary dumps for **directional** codec tests without committing personal codeplugs.

**Hub:** [README.md](README.md) · **Protocol:** [protocol.md](protocol.md)

## Privacy rules

- **Never** commit personal codeplugs, live radio dumps, or operator callsign / DMR-ID images into this repo.
- Do not place real dumps under `sample-exports/` (personal CPS files are already out of git scope).
- Prefer **synthetic** fixtures: 4KB blocks filled with `0x00`/`0xFF` plus a few hand-authored valid records at known offsets.
- If a real dump is needed for local debugging, keep it **outside** the repo and sanitize before any share.

## Capture options (future / local)

| Method                 | When                                                                 | Notes |
| ---------------------- | -------------------------------------------------------------------- | ----- |
| NeonPlug browser read  | Tooling available today                                              | Full discovery + bulk blocks; keep local |
| Studio Web Serial read | After adapter [#638](https://github.com/pskillen/codeplug-studio/issues/638) | Save hex locally; do not commit |
| DM32 CPS CSV / `.neonplug` | Naming / semantics checks only                                   | **Not** binary offsets |

## Synthetic fixture recipe

1. Allocate one or more `Uint8Array(4096)` blocks; set `data[0xFFF]` to the metadata under test (`0x12`, `0x04`, `0x5c`, …).
2. For a channel block: put count `1` at `0x00` (u16 LE) on the first block; place one known-good 48-byte channel at `0x10` per [channel-record.md](channel-record.md) (fake name `TEST`, fixed RX/TX BCD, High power).
3. Optionally add a stub TX-contact `0x42` block with a 2-byte entry mapping channel 1 → TG index `1`, and a minimal `0x44` TG entry.
4. Keep callsigns / DMR IDs fake (`1234567`, `N0CALL`).
5. When adapters land, store under `src/integrations/radio-io/**/__fixtures__/` — never under docs with real operator data.

## What this ticket verified without a dump

Acceptance for [#637](https://github.com/pskillen/codeplug-studio/issues/637) cross-checks protocol and layout facts against NeonPlug `constants.ts` / `connection.ts` / `memory.ts` / `structures.ts`. A live dump is valuable for adapter [#638](https://github.com/pskillen/codeplug-studio/issues/638) but is not required to land these reference pages.

## Related

- [protocol.md](protocol.md) · [memory-layout.md](memory-layout.md) · [channel-record.md](channel-record.md)
- Attribution: `/attributions` `neonplug`
- Shared testing policy: [docs/build/testing/fixtures.md](../../../../build/testing/fixtures.md)
