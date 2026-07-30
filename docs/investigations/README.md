# Investigations

Closed investigation records. Each is a bug or behaviour that took sustained, expensive work to understand —
kept because the *reasoning* has ongoing value: what was ruled out, what the evidence was, and what the
process failures were.

**These are archives, not living documents.** An investigation lands here when it closes. Live investigations
run in a scratch directory (gitignored) and only their durable conclusions are promoted — settled technical
facts to the reference docs, the record of how they were established to here.

| # | Investigation | Closed | Outcome |
| - | ------------- | ------ | ------- |
| [i001](i001-d890-write-commit-failure/README.md) | AT-D890UV Web Serial writes never commit | 2026-07-30 | Studio was transmitting the radio's own flash sector markers |

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
