# i008 — Intra-record RMW on modelled entity records

**Opened:** 2026-08-28
**Closed:** 2026-08-28
**Outcome:** Serial Write copied a previous occupant’s AT-D890UV channel `0x80` into a newly projected memory. Whole-record encode plus write-defaults shipped in [#1273](https://github.com/pskillen/codeplug-studio/issues/1273). Region / erase-unit RMW is a different layer and stayed.

**Technical conclusion lives in** [channel-record.md](../../reference/radios/anytone/at-d890uv/channel-record.md) (write-defaults) **and** [adding-a-radio-adapter.md](../../features/radio-read-write/adding-a-radio-adapter.md) (erase-unit RMW ≠ record-body copy).

Promoted from live notes in `tmp/investigations/i008-unnecessary-rmw/` (gitignored; opener misspelled the slug). Number **i008** is used; do not reuse.

|                   |                                                                                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Symptom**       | After serial Write, an m×n-expanded GB7GL talk-group memory inherited hotspot settings (first RX-group, then talkaround / SMS / AES / offset / contact).                                                                                   |
| **Root cause**    | `encodeAtD890ChannelRecord(ch, prior)` copied the occupant `0x80` then overlaid modelled fields. `encodeChannelsIntoAtD890Image` snapshotted `readExistingChannelRecord` before zero-filling the bank. Slot index is not entity identity.  |
| **Introduced by** | Channel encoder fidelity that treated unmodelled-in-record bytes as “this channel’s settings” ([#770](https://github.com/pskillen/codeplug-studio/issues/770)).                                                                            |
| **Masked by**     | [#1271](https://github.com/pskillen/codeplug-studio/issues/1271) / [PR #1272](https://github.com/pskillen/codeplug-studio/pull/1272) patched timeslot, DMR MODE, and `0x1c`. Those fields stopped leaking; the prior-copy engine remained. |
| **Fixed by**      | `encodeAtD890ChannelRecord(ch)` — fresh `0x80` + projection + documented defaults. Contact-none `0xffff`. Occupant-at-slot-N tests.                                                                                                        |

---

## Two RMW layers (do not collapse)

1. **Region / erase-unit / clone-image RMW** — required when Studio does not model the whole radio. D890 `0x40000` sparse erase-unit RMW ([#768](https://github.com/pskillen/codeplug-studio/issues/768)); OpenGD77 overlay onto an in-session FLASH prior; UV full-image upload so VFO/settings survive. [#1132](https://github.com/pskillen/codeplug-studio/issues/1132): encode prior is the in-session Read, never a virgin `0xff` map.
2. **Intra-record RMW** — copy the previous occupant of **this slot index**, then overlay modelled fields. When m×n remaps memories, leftover bytes are another channel’s. That was D890 channels only (E1 inventory).

## What we ruled out

See [02-dead-ends.md](02-dead-ends.md). Headline: “we RMW because we do not model the whole radio” does not justify copying channel bodies. anytone-cps is not SoT for `0x21` bit packing. Field-at-a-time always-write does not kill the class of bug.

## Inventory (E1)

On serial Write, **only AT-D890UV channels** copied an occupant entity-record body. D890 zones, scan lists, talk groups, RX groups, radio IDs, AM, digital contacts, and satellite records were already whole-record. DM-32, OpenGD77 (1701 + MD-9600), UV-5R Mini, UV-21, and RT95 Write-path channels were already whole-record. RT95’s `prior?` helper is vestigial on Write (span wiped `0xff` first).

Findings: [01-findings.md](01-findings.md) (W1–W20). Contact-none locked **`0xffff`** (W20).

## Related

- [#1271](https://github.com/pskillen/codeplug-studio/issues/1271) — field patches (close with PR #1272). Do not expand as the same bug.
- [#1273](https://github.com/pskillen/codeplug-studio/issues/1273) — whole-record encode.
- [i002](../i002-d890-program-error-after-write/README.md) — virgin `0xff` **image** prior (region grain). Not this class.
