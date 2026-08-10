# Satellite keps

Tier-1 hub for **satellite Keplerian elements (keps / TLEs)** in Codeplug Studio — fetch from amateur upstreams, curate a vendor-neutral library, and write packed orbitals to supported radios over Web Serial. Updating keps is a frequent, lightweight maintenance task, decoupled from infrequent full codeplug writes.

**Tracking:** Epic [#848](https://github.com/pskillen/codeplug-studio/issues/848) (child of Milestone 2 [#495](https://github.com/pskillen/codeplug-studio/issues/495))

---

## Implementation status

| Area                                  | Status      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TLE parse + orbital model             | Shipped     | [#850](https://github.com/pskillen/codeplug-studio/issues/850)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| CelesTrak / AMSAT fetch (Pages proxy) | Shipped     | [#851](https://github.com/pskillen/codeplug-studio/issues/851) — Space-Track deferred                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Curated library persistence           | Shipped     | [#852](https://github.com/pskillen/codeplug-studio/issues/852)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Satellite Keps library UI             | Shipped     | [#853](https://github.com/pskillen/codeplug-studio/issues/853) — [feature-design.md](feature-design.md) §§7–9                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Uplink / downlink metadata            | Shipped     | [#854](https://github.com/pskillen/codeplug-studio/issues/854) — model + Satellite Keps editor; [#1020](https://github.com/pskillen/codeplug-studio/issues/1020) added range validation. Superseded by multiple-transmitters-per-spacecraft (epic [#1037](https://github.com/pskillen/codeplug-studio/issues/1037)): `Satellite.transmitters[]` replaces the single uplink/downlink/tone scalar fields, the editor is a repeatable add/edit/delete transmitter list, and "Refresh from SatNOGS" merges into that list by SatNOGS UUID instead of one-shot overwriting the scalar fields ([#1040](https://github.com/pskillen/codeplug-studio/issues/1040)). The bulk "Update from CelesTrak/AMSAT" refresh on the Satellite Keps list now merges and persists SatNOGS transmitter data the same way, per satellite ([#1043](https://github.com/pskillen/codeplug-studio/issues/1043)) — it previously only wrote to a session-only cache. Radio write-packing still not started |
| Anytone D890 wire docs + write        | Not started | [#855](https://github.com/pskillen/codeplug-studio/issues/855) → [#856](https://github.com/pskillen/codeplug-studio/issues/856)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| OpenGD77 orbital wire docs + write    | Not started | [#857](https://github.com/pskillen/codeplug-studio/issues/857) → [#858](https://github.com/pskillen/codeplug-studio/issues/858)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Write Keps workflows A + B            | Not started | [#859](https://github.com/pskillen/codeplug-studio/issues/859)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

---

## Documentation map

| Doc                                                         | Role                                                                                                           |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [feature-design.md](feature-design.md)                      | Problem space, TLE sources, Keplerian definitions, UX workflows                                                |
| [Satellite tracking](../satellite-tracking/)                | Post-MVP pass prediction + Tracking Dashboard ([#860](https://github.com/pskillen/codeplug-studio/issues/860)) |
| `docs/reference/radios/anytone/at-d890uv/satellite-keps.md` | Planned — D890 memory / write protocol                                                                         |
| `docs/reference/radios/opengd77/satellite-orbitals.md`      | Planned — shared OpenGD77 satellite bank                                                                       |

---

## Concepts

- **Vendor-neutral library** — TLE-derived orbitals (+ optional TX/RX metadata) live in core/library; radio packing and capacity limits apply only at the Web Serial write boundary.
- **Decoupled UX** — Library **Satellite Keps** tab for refresh/curation; write from the library (select radio) or from a build page (context radio already known).
- **Capacity at write** — Do not bake radio max satellite counts into library CRUD; halt write with a clear error when selected count exceeds the target radio profile.

---

## Target radios (MVP)

| Radio                                   | Notes                                |
| --------------------------------------- | ------------------------------------ |
| Anytone AT-D890UV                       | First end-to-end write path          |
| OpenGD77 (Baofeng DM-1701, TYT MD-9600) | Shared satellite orbital wire format |

---

## Upstream sources

| Source          | Role       | Endpoint (reference)                                                   |
| --------------- | ---------- | ---------------------------------------------------------------------- |
| CelesTrak       | Primary    | `https://celestrak.org/NORAD/elements/gp.php?GROUP=amateur&FORMAT=tle` |
| AMSAT           | Secondary  | `https://www.amsat.org/tle/current/nasabare.txt`                       |
| Space-Track.org | Out of MVP | Authenticated API                                                      |

Browser fetches go through a same-origin Pages Function proxy (same pattern as RadioID / RepeaterBook).

---

## Out of scope (epic MVP)

- Space-Track authenticated API
- Reading keps back from the radio
- In-app AOS/LOS or Doppler prediction UI — see [Satellite tracking](../satellite-tracking/) ([#860](https://github.com/pskillen/codeplug-studio/issues/860))
- Satellite settings menus beyond the keps payload
- Radios not listed above
