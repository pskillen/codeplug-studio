# OpenGD77 — multi-talkgroup denormalisation

**Status:** **Not applicable** to OpenGD77. Tracking context: archive reference (codeplug-tool#36).

## Why N/A

OpenGD77 CPS supports **promiscuous RX natively** via `Channels.TG List` and `TG_Lists.csv`. The lean export pattern — one channel row per repeater/site with a TG list reference — is correct for 1701, MD9600, and other OpenGD77 radios.

Multi-talkgroup **expansion** (one logical channel → many wire rows) is for formats that **cannot** represent RX group lists on the wire. See the format-agnostic rules in [multi-talkgroup-expansion.md](../multi-talkgroup-expansion.md).

## OpenGD77 operators

- Model promiscuous RX with `rxGroupListId` on the channel (and per-profile when `multiMode`).
- Export produces one row + `TG List` column — no expansion pass.
- Import maps flat rows best-effort; use **Find merge candidates** if per-TG rows need collapsing into one logical channel + RGL.

## Related

- [TG lists](tg-lists.md) — promiscuous RX on OpenGD77
- [Multi-mode](multi-mode.md) — separate Analogue/Digital rows (orthogonal axis)
- [Multi-talkgroup expansion](../multi-talkgroup-expansion.md) — domain rules for other formats
