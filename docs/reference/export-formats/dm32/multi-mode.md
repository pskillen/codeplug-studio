# DM32 — Multi-mode channels

DM32 encodes FM+DMR dual-mode repeaters as **one CSV row** with `Channel Type` `Fixed Analog` or `Fixed Digital`.

## Import

One row → `Channel` with `multiMode: true` and two `modeProfiles` (FM + DMR) sharing frequencies and common flags; DMR-specific fields on the DMR profile.

## Export

Use `expandModes: false` so the channel expander emits **one row** (or FM + DMR template rows only when talk-group fan-out applies). The serialiser writes `Fixed Analog` / `Fixed Digital` from `modeProfiles` — no OpenGD77 `-F`/`-D` suffixes.

Opposite of OpenGD77, which splits dual-mode into separate wire rows on export.
