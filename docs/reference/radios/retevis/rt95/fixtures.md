# RT95 VOX — fixture capture notes

How to obtain binary dumps for **directional** codec tests without committing personal codeplugs.

**Hub:** [README.md](README.md) · **Protocol:** [protocol.md](protocol.md)

## Privacy rules

- **Never** commit personal codeplugs, live radio dumps, or operator callsign images into this repo.
- Do not place real dumps under `sample-exports/` (personal CPS files are already out of git scope).
- Prefer **synthetic** fixtures: `0xFF`- or zero-filled image with a few hand-authored valid channels at known offsets.
- If a real dump is needed for local debugging, keep it **outside** the repo and sanitize before any share.

## Capture options (future / local)

| Method                 | When                                                                                                                                      | Notes                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| CHIRP download         | Desktop tool today                                                                                                                        | Contiguous `0x32A0` image; GPL tool — facts only into docs  |
| Studio Web Serial read | Shipped ([#641](https://github.com/pskillen/codeplug-studio/issues/641) + [#643](https://github.com/pskillen/codeplug-studio/issues/643)) | Echo-strip PROGRAM→QX; save hex locally for hardware verify |
| CHIRP CSV              | Naming / watt checks only                                                                                                                 | Prove names/semantics — **not** binary offsets              |
| NeonPlug               | N/A                                                                                                                                       | **No** RT95 / 778 path                                      |

## Synthetic fixture recipe

1. Allocate `Uint8Array(0x32A0)` (prefer `0x00` or `0xFF` fill — match whatever empty occupancy expects when implementing).
2. Place one known-good channel at memory **1** (offset `0x0000`) using [channel-record.md](channel-record.md): fixed RX BCD, duplex none, High power, 25 kHz, name `TEST01`, tones off.
3. Set occupied bit 0 in the bitfield at `0x1940`.
4. Optionally set `bandlimit` at `0x326D` to `0x01` (wide amateur table).
5. Keep callsigns / IDs fake.
6. Synthetic fixture: `src/integrations/radio-io/radios/rt95/__fixtures__/syntheticImage.ts`.

## What this ticket verified without a dump

Acceptance for [#642](https://github.com/pskillen/codeplug-studio/issues/642) cross-checks offsets and protocol constants against CHIRP `anytone778uv.py`. A live dump is valuable for adapter [#643](https://github.com/pskillen/codeplug-studio/issues/643) but is not required to land these reference pages.

## CPS-derived fixtures and the golden write range

Synthetic images built in test code from the stock CPS's documented encodings (firmware repo findings
F110-F130: channel record F121-F123 and F125, settings F124, zero-fill F126). They never use an owner dump, vendor
bytes or calibration. Cite findings by id; the byte tables live in the firmware repo.

What is checked against the CPS's meaning, and what is not:

- **Channels:** the builder and parser are written independently of Studio's codec, so a test checks Studio against the
  CPS's meaning rather than against itself.
- **Settings:** fields the CPS stores as a raw combo index (beep, step, display mode, squelch, speaker volume and
  switch, scan type and recovery, auto power on, main, rx way, TOT, auto power off, TBST, screen direction, STE) and
  the 0x321B bits are asserted by CPS meaning (the byte the CPS would store). The VOX level and the key assignments are
  asserted at their CPS addresses only. The rest of the sweep, including the `CHIRP`-trust fields (DTMF block, VOX
  delay), is a Studio self round trip: it proves write then read agrees and that only the field's own bytes change, not
  that the CPS would read the same value.

| File                                                    | What it is                                                                                                                             | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Trust source                                    |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `__fixtures__/cpsDerivedImage.ts`                       | Channel builder, CPS-meaning parser, named channel fixtures, 51-tone CTCSS sweep                                                       | n/a (input)                                                                                                                                                                                                                                                                                                                                                                                                                                                    | CPS (C) per `records/channel.md`                |
| `__fixtures__/settingsFixtures.ts`                      | Every option, boolean and string of every registry field                                                                               | n/a (input)                                                                                                                                                                                                                                                                                                                                                                                                                                                    | field definitions                               |
| `__fixtures__/writeRangeKit.ts`                         | The allowed write set as named constants (CPS set, the named Studio exception, the MM9PDY range), frame parser and checker             | n/a (input)                                                                                                                                                                                                                                                                                                                                                                                                                                                    | CPS memory map F113-F117, F126                  |
| `cpsDerivedFixtures.test.ts`                            | Channel direction A (parse a CPS-shaped image), direction B (export, parse by CPS meaning), channel round trip, settings sweeps        | Width 12.5 and 25, power, duplex, tone modes, all 51 CTCSS indexes, DCS normal and inverted, scan, names in and outside the CPS charset survive by meaning; byte 8, DTMF ID, optional signalling, 5-Tone ID and custom CTCSS come out Off or 0; 20 kHz and custom CTCSS are documented loss with their warnings; every settings field round-trips and touches only its own bytes (the MON Key Function is bit 5 of 0x321B); unmodelled settings bytes are kept | CPS (C), settings trust per `settingsFields.ts` |
| `writeRange.golden.test.ts`                             | Protocol level: `Rt95Protocol` upload, settings patches and restore through the fake cable                                             | Every `W` frame is 16 bytes on a 16-byte boundary inside the allowed set; 0x4000-0x5FFF only on the MM9PDY target after the chip guard reads; nothing in 0x32A0-0x3FFF or 0x6000 and above; a 16 KiB chip sends no block                                                                                                                                                                                                                                       | CPS memory map                                  |
| `src/app/services/radioIoRt95WriteRange.golden.test.ts` | App level: the functions the UI calls, for stock Write, MM9PDY Write (with settings and the zone key), settings-only Write and Restore | The same frame rules, per app entry point: a stock Write never sends 0x4000+ blocks and never reads the chip guard; every MM9PDY Write that sends them reads the guard first; a 16 KiB chip stops the MM9PDY Write before any block                                                                                                                                                                                                                            | CPS memory map                                  |

The allowed set is one constant in `writeRangeKit.ts`, built from three ranges: the CPS write set (0x0000-0x30EF and
0x3200-0x329F), the one named exception 0x30F0-0x31FF (the CPS never writes it and MAIN never uses it, but Studio
writes it as part of its contiguous stock upload, and the owner decided to keep that), and the MM9PDY range
(0x4000-0x5FFF, MM9PDY target only). A change to what Studio may write is argued there, once. The kit repeats the
numbers instead of importing the production limits, so a widened production limit fails the test.

Not asserted, on purpose: split duplex (the meaning of duplex 3 on slots 1-200, a CPS offset or an absolute TX, is
still open), and names with non-ASCII characters (the stock-target fold is covered by its own tests). An RT95 Read does
not import channels into the library, so the channel round trip runs at the channel DTO seam (decode, then encode).

The cps-verify format for the stock CPS file belongs to #1530; it is not built here.

## Related

- [protocol.md](protocol.md) · [memory-layout.md](memory-layout.md)
- Attribution: `/attributions` `chirp`
- Shared testing policy: [docs/build/testing/fixtures.md](../../../../build/testing/fixtures.md)
