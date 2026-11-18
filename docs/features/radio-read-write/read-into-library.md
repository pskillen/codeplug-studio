# Read into library

Read radio channels and zones into the project library and a build.

**Status:** In progress · **Tracking:** [#1891](https://github.com/pskillen/codeplug-studio/issues/1891)

## Purpose

Read a connected radio's channels, and zones where available, into the project library and a build for that radio. Library data is normal project data; the raw radio image is still never stored. This changes the earlier rule that Read does not touch the library.

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
