# dev-tools

Standalone developer tools that live alongside the app but aren't part of
it — not built, not shipped, not imported by `src/`. Each subdirectory is
independent: its own language/deps/venv, its own README.

Unlike `scripts/` (small Node helpers wired into `npm run`) or
`cps-verify/` (a TypeScript CLI that's part of CI), tools here are for
one-off or occasional investigation work — e.g. reverse-engineering a
radio's wire protocol from a packet capture — where Python (or another
non-JS toolchain) is the better fit than the app's own stack.

## Tools

- [`wire-capture-decoder/`](wire-capture-decoder/README.md) — decodes
  USBPcap/Wireshark captures of radio CPS wire protocols (byte-level
  framing, not just USB packet summaries) into a structured report:
  frame inventory, and — most importantly — anything that doesn't match
  a known frame shape.
- [`radio-memory-dump/`](radio-memory-dump/README.md) — read-only serial
  memory dump CLI for protocol investigation: named region reads, bin +
  manifest output, hex stdout. OpenGD77 first plugin
  ([i006](../docs/investigations/i006-md9600-serial-read-ident/README.md),
  [#1244](https://github.com/pskillen/codeplug-studio/issues/1244)).

## Adding a new tool

Give it its own directory, its own README (setup + usage), and its own
`.gitignore` for build artifacts / venvs. Don't share a venv or
`node_modules` across tools — that's how "reusable" tools rot.
