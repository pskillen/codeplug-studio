# RT95 radio settings

**Tracking:** [#1476](https://github.com/pskillen/codeplug-studio/issues/1476)

Operators read and set general settings, PF keys, starting display text, and DTMF-related fields on the **Retevis RT95 VOX** Web Serial target (stock `radio-io-rt95` and MM9PDY `radio-io-rt95-mm9pdy`). Wire offsets, enums, and the unsupported-field table live in the [RT95 settings reference](../../reference/radios/retevis/rt95/settings.md) — not here.

## Model

- **Overrides are session state.** Typed `{ fieldId, value }` pairs in memory for the build session. They are not stored in the project, IndexedDB, or YAML, and are not written unless a Write passes them to the radio layer.
- **Patch on the fresh read.** Each override becomes a masked byte patch. On a codeplug Write, patches merge onto the pre-pause full clone inside `upload()` (with a second fresh read per touched block and an abort if the radio changed outside the mask). A **settings-only** Write reads the clone once for Review, then `uploadSettingsPatches()` reads and writes **only** touched 16-byte blocks — never the full `0x32A0` image and never MMD1.
- **Allow-list.** Registered fields only; the registry is checked at resolve time and again in the protocol before any `W`.
- **User input wins.** An explicit override beats the value read from the radio; **Keep** on the page means no patch. An explicit PF-key override beats the MM9PDY zone-key projection when both target the same byte (zone key is still not applied on the RT95 write branch — known gap).
- **No serial.** The RT95 ident has model, version, and band-limit code only. Review matches “same radio” as the settings read by **band-limit code**, not serial. There is no “apply to every radio until reload” toggle (unlike the AT-D890UV).

## Tiers

- **Basic** — function setup, VOX (not mic level), starting display, PF keys, and DTMF strings/timing fields documented as supported in the reference registry.
- **Advanced** (page switch, off by default) — power-on password (paired enable + six digits), power-on reset enable, TRF enable, channel locked, remote stun/kill. Review flags advanced rows. Backup reminder copy warns before password or remote codes.

Unsupported CPS/CHIRP fields (Display Mode B, MR/VFO state, mic level, band byte, and others) are listed with reasons in [settings.md — unsupported](../../reference/radios/retevis/rt95/settings.md).

## Radio settings page and Export card

Route `/builds/:id/export/radio-settings` for RT95 Web Serial egresses. Same interaction pattern as the AT-D890UV page: **Read a radio**, **Keep / Set** per field, **Copy all** / **Clear all**, advanced switch with discard confirm, **Write settings…** opening the Write stepper with Radio settings only. Session store: `rt95RadioSettingsSession`.

## Write stepper

- **Radio settings part** appears when the profile supports radio settings and this session has overrides (or the user ticks it after **Set up…**).
- **Review** — **Radio settings** section lists each change as _now → after_ (advanced fields labelled). **Apply / Keep its settings** when the band limit of the connected radio differs from the settings read (or nothing was read). **Backup** section is a nudge only (no in-Review zip on RT95 yet). MM9PDY **Zones and descriptions** stays a separate section when mod data is written.
- **Codeplug + settings** passes `rt95SettingsOverrides` into `uploadPreparedRadioWrite`; the pause can answer Keep and drop patches before upload.
- **Settings only** uses `writeRt95SettingsOnly` and a dedicated stage plan (**Read settings** + **Upload** on touched blocks only).

## Implementation status

| Area                        | Status    | Notes                                                      |
| --------------------------- | --------- | ---------------------------------------------------------- |
| Field registry + patch core | Shipped   | Stage 1                                                    |
| Radio settings page + card  | Shipped   | Stage 2                                                    |
| Write stepper + Review      | Shipped   | Stage 3                                                    |
| Settings-only upload path   | Shipped   | `uploadSettingsPatches`                                    |
| Codeplug + settings patches | Shipped   | Inside full `upload()`                                     |
| MM9PDY zone key on Write    | Not wired | Pre-existing; `applyRt95ZoneKey` not called on RT95 branch |
| In-Review backup save       | Not wired | Text nudge only; use Backup / Restore                      |
| Hardware verify             | Pending   | Same as other RT95 Write paths                             |

## Related

- [Radio read/write hub](README.md)
- [RT95 settings reference (tier 3)](../../reference/radios/retevis/rt95/settings.md)
- [RT95 MM9PDY data](../../reference/radios/retevis/rt95/mm9pdy-data.md)
