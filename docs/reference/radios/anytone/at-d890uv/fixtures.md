# AT-D890UV — fixture capture notes

How to obtain binary dumps for **directional** codec tests without committing personal codeplugs.

**Hub:** [README.md](README.md) · **Protocol:** [protocol.md](protocol.md)

## Privacy rules

- **Never** commit personal codeplugs, live radio dumps, or operator callsign / DMR-ID images into this repo.
- Do not place real dumps under `sample-exports/` (personal CPS files are already out of git scope).
- Prefer **synthetic** fixtures: sparse region blobs with a few hand-authored valid channels / zones at known addresses.
- If a real dump is needed for local debugging, keep it **outside** the repo and sanitize before any share.

## Capture options (future / local)

| Method                   | When                                                                                                                                    | Notes                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| anytone-cps download     | Desktop tool today                                                                                                                      | Sparse `D890_MAP` regions; GPL — facts only into docs          |
| Studio Web Serial read   | After [#646](https://github.com/pskillen/codeplug-studio/issues/646) + [#649](https://github.com/pskillen/codeplug-studio/issues/649) | 921600 PROGRAM→QX + u32 R/W; save hex locally                  |
| Anytone CPS CSV          | Naming / semantics only                                                                                                                 | Prove names — **not** binary offsets                           |
| qdmr Anytone path        | Handshake cross-check                                                                                                                   | No D890 region map — do not treat as layout ground truth       |

## Synthetic fixture recipe

1. Do **not** allocate a multi‑MB contiguous image — build a **map of address → `Uint8Array` chunks** (or a sparse fixture file format the adapter tests already use).
2. ChannelSet @ `0x3482a00`: `0x200` zeros; set bit 0 for channel index 0.
3. Channel 0 body: write a known-good `0x80` record split across `0x1000000` and `0x1000040` per [channel-record.md](channel-record.md) (fixed RX BCD, duplex none, High/Turbo power, name `TEST`, tones off).
4. Optionally: ZoneSet bit 0; zone 0 name at `0x3600000`; one member `0x0000` then `0xFFFF` fillers in `0x2000000`.
5. Keep DMR IDs / callsigns fake.
6. When adapters land, store under `src/integrations/radio-io/**/__fixtures__/` — never under docs with real operator data.

## What this ticket verified without a dump

Acceptance for [#647](https://github.com/pskillen/codeplug-studio/issues/647) cross-checks region bases, strides, and protocol constants against anytone-cps `D890_MAP` / `SerialDevice`. A live dump is valuable for adapter [#649](https://github.com/pskillen/codeplug-studio/issues/649) but is not required to land these reference pages.

## Related

- [protocol.md](protocol.md) · [memory-layout.md](memory-layout.md) · [channel-record.md](channel-record.md)
- Shared testing policy: [docs/build/testing/fixtures.md](../../../../build/testing/fixtures.md)
