# RadioFoundry firmware: version and identity

What Studio reads from a radio running RadioFoundry to learn which build it is, and what it does with the answer. Applies to every RadioFoundry board.

**Code:** `src/integrations/radio-io/radios/radiofoundry/version.ts` (wire), `src/core/radios/radiofoundry/firmware.ts` (classification).
**Upstream:** `docs/spec/debuglink.md` §3.1 in RadioFoundry at `454a5b76`.

## What Studio reads

On every cable connect Studio sends INFO (the codeplug layout), then the debug-link `VERSION` command (`0x02`, empty request; the reply uses `0x82` and starts with a status byte). The reply is ASCII `key=value` lines. Unknown keys are ignored.

| Key        | Meaning                                                                      |
| ---------- | ---------------------------------------------------------------------------- |
| `proto`    | Debug-link protocol version                                                  |
| `git`      | 8 hex digits, `-dirty` appended for a build from changed files, or `unknown` |
| `git_time` | Unix seconds of the commit (a dirty build: of the build)                     |
| `release`  | Release name, only in a build of a release tag                               |
| `source`   | `official`, `service`, `pr`, `local`, `fork` or `unknown`                    |
| `repo`     | The repository the build names                                               |
| `board`    | The board's name                                                             |
| `features` | Comma list of switches the board runs                                        |
| `off`      | Comma list of switches left off; may be cut short                            |
| `preset`   | `full`, a release variant, or `custom`                                       |
| `codec`    | Codec profile in flash                                                       |

Studio keeps the result for the session.

## Board names

Connect compares `board=` with the names the chosen board lists, ignoring case and surrounding spaces. Each board's cable module lists its own names.

| Board   | `board=` values            |
| ------- | -------------------------- |
| DM-32UV | `DM-32UV`, `DM-32`, `dm32` |
| DM-1701 | `DM-1701`, `dm1701` (as the DM-1701; RT84 reports the same names) |

## When VERSION is missing or odd

Older firmware answers status 1 (unknown command), some builds answer 4 (unavailable), and a radio may not answer at all. Studio carries on and shows "version not reported". A reply with no `board=` also carries on. A `git` of `unknown` shows "commit not reported". Only a `board=` that is not one of the chosen board's names refuses the connect, because that is positive evidence of another radio.

## The checked commit

Studio was checked against RadioFoundry commit `454a5b76` (2026-11-22). A reported build is classed as:

- release: a release name, with no commit time to compare;
- pinned: the checked commit, or the same commit time;
- older or newer: by commit time against the checked commit;
- unknown: no commit reported.

## Where Studio shows it

The Write review's "This radio" section has a Firmware line such as `RadioFoundry 1a2b3c4d (2026-11-20)`. Plain-language caveats sit under it: older or newer than the checked build, built from uncommitted changes, built by a fork, and that the information is self-reported. The caveats are facts; they never pause Review.

## Trust

INFO describes the image layout, not the build. VERSION is self-reported, and a fork can report anything, so Studio shows it and checks only the board name.
