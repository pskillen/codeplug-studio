# Investigations

Numbered `iNNN` records. Closed ones are archives: the _reasoning_ (what was ruled out, what the evidence
was, process failures). Open ones use the same folder layout so findings can be updated without a scratch
copy going stale.

Settled technical facts belong in `docs/reference/`; the investigation **cites** them. If a fact exists only
here, it is in the wrong place once the work closes.

## Open

| #                                                 | Investigation                                                    | Tickets                                                                                                                            | Status                                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [i003](i003-directory-lookup-banks/README.md)     | Directory rows vs lookup banks (OpenGD77 1701 / DM-32 / AT-D890) | [#1211](https://github.com/pskillen/codeplug-studio/issues/1211), [#1220](https://github.com/pskillen/codeplug-studio/issues/1220) | OpenGD77 1701 **Write ACK’d**, LCD lookup pending (Talker Alias); DM-32 still live |
| [i004](i004-dm32-serial-scan-aprs/README.md)      | DM-32UV serial Write: zone scan carriers + APRS upload ID        | [#1223](https://github.com/pskillen/codeplug-studio/issues/1223), [#1225](https://github.com/pskillen/codeplug-studio/issues/1225) | **Parked** — APRS LE verified; scan UI misbind open (wire FK correct per verify)   |
| [i005](i005-opengd77-channel-locations/README.md) | OpenGD77 Web Serial Write: channel GPS / Use Location on wire    | [#1233](https://github.com/pskillen/codeplug-studio/issues/1233)                                                                   | **Open** — write path in progress; hardware confirm (`E1`) after merge             |

## Closed

| #                                                     | Investigation                              | Closed     | Outcome                                                                 |
| ----------------------------------------------------- | ------------------------------------------ | ---------- | ----------------------------------------------------------------------- |
| [i001](i001-d890-write-commit-failure/README.md)      | AT-D890UV Web Serial writes never commit   | 2026-07-30 | Studio was transmitting the radio's own flash sector markers            |
| [i002](i002-d890-program-error-after-write/README.md) | AT-D890UV Program Error after Studio write | 2026-08-13 | Phase 2 encoded onto a virgin `0xff` map instead of the in-session Read |

## Conventions

- `iNNN-short-slug/` — allocated in order, never renumbered or reused.
- Each holds a `README.md` (the story and the outcome) plus whatever evidence is worth keeping.
- Technical facts about a radio, protocol, or format belong in `docs/reference/`, and the investigation
  **cites** them rather than restating them. If a fact is only recorded here, it is in the wrong place.
- Write the process failures honestly. They are the most reusable part.

## When to open one

Not for ordinary bugs. Open an investigation record when the work spans multiple sessions, depends on
expensive or slow evidence (hardware runs, production repros, captures), and accumulates conclusions that
need to survive being overturned.
