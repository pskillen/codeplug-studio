# Read into library

Read radio channels and zones into the project library and a build.

**Status:** MVP shipped; preview, better matching, dedupe and selective import still planned · **Tracking:** [#1891](https://github.com/pskillen/codeplug-studio/issues/1891)

## Purpose

Read a connected radio's channels, and zones where available, into the project library and a build for that radio.

## Using it

New operators can start from the home page with **Start from my radio**: it creates a project, reads the radio into it and suggests what to do next. See [Start from my radio](../onboarding/README.md#start-from-my-radio).

Within an existing project, open a build's **Backup / Restore** tab and choose **Read into library**. Select the connected radio's serial port when prompted. When the read finishes, close the progress modal to see the model, firmware, counts of created, updated and unchanged rows, and a link to the affected build. The summary also lists fields that were dropped, any warnings, and how many channels or zones were left out of the build while remaining in your library.

Nothing is sent to the radio. The raw image is held in memory. Use **Backup radio** to save a zip. Imported rows are ordinary project data. To undo library changes, edit or delete the affected channels and zones in the library.

## Which radios

The action requires a radio adapter with Read into library support. Today it is available for the Baofeng UV-5R Mini on stock and MM9PDY firmware. Zone import is available on MM9PDY when the radio provides a readable zone table.

## Field mapping

| Library field     | Set from the read                                      | Set on create      | Changed on update                           |
| ----------------- | ------------------------------------------------------ | ------------------ | ------------------------------------------- |
| RX/TX frequency   | Frequency in Hz, without conversion                    | Yes                | No; used for matching                       |
| Analog RX/TX tone | CTCSS Hz or DCS code and normal/inverted polarity      | Yes                | Yes                                         |
| Analog bandwidth  | 12.5 or 25 kHz                                         | Yes                | Yes                                         |
| Mode              | Mode reported by the radio                             | Yes                | Added if missing; existing modes remain     |
| Scan inclusion    | Always scan or skip when the radio reports a scan flag | Yes, when reported | Yes, when reported                          |
| Forbid transmit   | Forbid for receive-only, otherwise allow               | Yes                | Yes                                         |
| Power             | Radio power value                                      | Yes                | No, because the radio power ladder is lossy |
| Name              | Radio name, without splitting callsign and name        | Yes                | No; used for matching                       |

A write chooses the first FM or AM profile. If a channel already has AM and a read adds FM, its written tones may therefore come from the AM profile.

## Left alone on update

Name, callsign, comment, location, APRS, abbreviation, scan list, TX permit, squelch and profiles of other modes are left alone.

## Not carried

Radio fields the library has no field for are dropped; each radio's reference page lists what that radio drops. Digital fields, radio-native indexes, descriptions and other unmodelled radio settings are not carried by this analog mapper.

## Matching and updating channels

A read matches a library channel when its name, RX frequency and TX frequency all match exactly. Names are case-sensitive and may match the library name, the build's name override, or any name export would produce for that channel on this radio. These candidates are generated when needed and never stored. Tones, mode and other fields do not affect matching. Each library row can match only one radio channel in a read.

A match updates the modelled fields listed above, except power. The radio's mode is added if missing, and existing modes are never removed. A new channel takes the radio's power. Re-reading the same radio changes nothing. Better matching, including callsign/name splitting, tolerance, preview, deduplication and selective import, is later work.

## Zones

Zones are library entities, matched by name or by a build override or the export-shortened name for the radio. This prevents long names from being duplicated on re-read, including when MM9PDY limits zone names to 12 characters. Unmatched zones are created.

A matched zone's channel members are replaced in radio order. Per-member scan settings for retained channels and nested zones are preserved. Members pointing to empty slots are skipped and reported. Radio zone order and per-zone scan sets are applied to the build, not the library zone.

## The build

A read updates one build for the radio: the build from which the read started when it targets the same radio, otherwise the first build for that target. If none exists, it creates a build.

For flat-memory radios, the read replaces the build's channel slot pins with the radio's slot numbers. For zone radios, it replaces the zone order and member order and, where available, each zone's scan choices. Channel numbers follow zone order when writing. An empty zone read means zone information is unavailable, so it does not reorder or prune zones.

Library channels and zones absent from the radio are left out of the build but remain in the library. Operators can include them again by hand; the next read leaves them out again. A channel or zone present on the radio is included even if it was previously excluded from the build.

## How a read is applied

The read saves channels first, then zones using the saved channel identities, then the build using the resulting library and radio order. These saves are sequential, not one transaction. If a step fails, the message says what was saved. Re-reading does not duplicate unchanged library rows.

[Channel matching](#matching-and-updating-channels) and [zone matching](#zones) both include export-shortened names. As described in [The build](#the-build), channels and zones absent from the radio are left out of the build while remaining in the library; an unavailable zone table leaves zones alone.

The summary reports channels and zones created, updated or unchanged, entities left out of the build, warnings, and fields not carried over from the radio.

## Known gaps

- Preview, match review, deduplication and selective import are planned for the [post-MVP milestone](https://github.com/pskillen/codeplug-studio/issues/495).
- Channel matching requires both frequencies and an exact match to a name candidate, which can be a library name, build override or export-shortened name. The read does not split callsigns from names or use fuzzy matching.
- The UV-5R Mini read drops DTMF signal code, PTT ID mode, voice scramble, RX DTMF, busy channel lockout, frequency hopping and unnamed record bits.
- The UV-5R Mini read infers AM from the air-band receive frequency.
