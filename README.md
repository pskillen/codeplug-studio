# Codeplug Studio

**Codeplug Studio** is a browser-based designer for amateur radio codeplug layouts.

Design your channel library once, then build format-specific codeplugs for the radios and CPS tools you use — OpenGD77, CHIRP, DM32, and more. Import vendor CPS exports, curate channels and talk groups, export when you are ready. Your vendor CPS still handles flashing; Codeplug Studio handles design.

> **Status:** Early setup — application code and documentation are being brought over from the pre-release prototype.

## Principles

- **Import-first** — CPS import is thorough and well-tested.
- **Export as projection** — export generates CPS-ready files from your library and builds; perfect round-trip is not a goal.
- **Library, then builds** — one master inventory of channels, talk groups, and contacts; per-format builds assemble what each radio needs.
- **Vendor-neutral core** — radio-specific limits and column mapping live at the import/export boundary only.

## Repository

This repo supersedes the earlier [codeplug-tool](https://github.com/pskillen/codeplug-tool) prototype (archived). Same author, new product thesis and architecture.

## License

TBD.
