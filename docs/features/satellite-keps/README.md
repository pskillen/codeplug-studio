# Satellite keps

Tier-1 hub for **satellite Keplerian elements (keps / TLEs)** in Codeplug Studio — fetch from amateur upstreams, curate a vendor-neutral library, and write packed orbitals to supported radios over Web Serial. Updating keps is a frequent, lightweight maintenance task, decoupled from infrequent full codeplug writes.

**Tracking:** Epic [#848](https://github.com/pskillen/codeplug-studio/issues/848) (child of Milestone 2 [#495](https://github.com/pskillen/codeplug-studio/issues/495))

---

## Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| TLE parse + orbital model | Not started | Child of [#848](https://github.com/pskillen/codeplug-studio/issues/848) |
| CelesTrak / AMSAT fetch (Pages proxy) | Not started | Space-Track deferred |
| Curated library persistence | Not started | Enabled flags + last-updated |
| Satellite Keps library UI | Not started | Design: [feature-design.md](feature-design.md) §§7–9 |
| Uplink / downlink metadata | Not started | Needed for radio encode |
| Anytone D890 wire docs + write | Not started | RE then radio-io |
| OpenGD77 orbital wire docs + write | Not started | Shared DM-1701 / MD-9600 |
| Write Keps workflows A + B | Not started | Library modal + build contextual; serial lock |

---

## Documentation map

| Doc | Role |
| --- | --- |
| [feature-design.md](feature-design.md) | Problem space, TLE sources, Keplerian definitions, UX workflows |
| `docs/reference/radios/anytone/at-d890uv/satellite-keps.md` | Planned — D890 memory / write protocol |
| `docs/reference/radios/opengd77/satellite-orbitals.md` | Planned — shared OpenGD77 satellite bank |

---

## Concepts

- **Vendor-neutral library** — TLE-derived orbitals (+ optional TX/RX metadata) live in core/library; radio packing and capacity limits apply only at the Web Serial write boundary.
- **Decoupled UX** — Library **Satellite Keps** tab for refresh/curation; write from the library (select radio) or from a build page (context radio already known).
- **Capacity at write** — Do not bake radio max satellite counts into library CRUD; halt write with a clear error when selected count exceeds the target radio profile.

---

## Target radios (MVP)

| Radio | Notes |
| --- | --- |
| Anytone AT-D890UV | First end-to-end write path |
| OpenGD77 (Baofeng DM-1701, TYT MD-9600) | Shared satellite orbital wire format |

---

## Upstream sources

| Source | Role | Endpoint (reference) |
| --- | --- | --- |
| CelesTrak | Primary | `https://celestrak.org/NORAD/elements/gp.php?GROUP=amateur&FORMAT=tle` |
| AMSAT | Secondary | `https://www.amsat.org/tle/current/nasabare.txt` |
| Space-Track.org | Out of MVP | Authenticated API |

Browser fetches go through a same-origin Pages Function proxy (same pattern as RadioID / RepeaterBook).

---

## Out of scope (epic MVP)

- Space-Track authenticated API
- Reading keps back from the radio
- In-app AOS/LOS or Doppler prediction UI
- Satellite settings menus beyond the keps payload
- Radios not listed above
