# ukrepeater.net / RSGB ETCC API reference

Authoritative reference for the **RSGB ETCC beta API** (`https://api-beta.rsgb.online`) used by the ukrepeater.net repeater directory in Codeplug Studio.

This is a **remote directory API**, not a CPS wire format. HTTP clients and normalisation live in [`src/integrations/repeaters/`](../../../src/integrations/repeaters/). Feature behaviour: [repeater directories](../../features/repeater-directories/README.md).

## API

| Property       | Value                                                            |
| -------------- | ---------------------------------------------------------------- |
| Base URL       | `https://api-beta.rsgb.online`                                   |
| Response shape | `{ "data": [ …listing… ] }`                                      |
| CORS           | `Access-Control-Allow-Origin: *` — callable from the browser SPA |
| Stability      | **Beta** — degrade gracefully on failure; attribute source in UI |

### Endpoints (shipped)

| Endpoint            | Example                            | Returns                        |
| ------------------- | ---------------------------------- | ------------------------------ |
| `/callsign/{call}`  | `/callsign/gb7dc`                  | Listings for repeater callsign |
| `/locator/{4-or-6}` | `/locator/io92`, `/locator/io92pp` | Listings in locator square     |

Additional ETCC endpoints exist on the API but are not wired in the Studio UI yet:

| Endpoint         | Example                  | Returns                          |
| ---------------- | ------------------------ | -------------------------------- |
| `/band/{band}`   | `/band/2m`, `/band/70cm` | Listings on band (large payload) |
| `/keeper/{call}` | `/keeper/g7npw`          | Listings for keeper callsign     |
| `/all/systems`   | —                        | All public listings              |

There is **no town/QTH endpoint**. Town search geocodes to a 4-character locator, then calls `/locator/`.

## Listing record (sample)

```json
{
  "id": 4763,
  "type": "DM",
  "status": "OPERATIONAL",
  "keeperCallsign": "G7NPW",
  "town": "DERBY",
  "modeCodes": ["A", "D", "M:1", "F", "P", "N"],
  "tx": 439350000,
  "rx": 430350000,
  "repeater": "GB7DC",
  "ctcss": 71.9,
  "txbw": 12.5,
  "band": "70CM",
  "locator": "IO92",
  "dbwErp": 14,
  "extraDetails": { "ngr": "SK3837", "antennaHeight": 0, "polarisation": "" }
}
```

## Frequency inversion (critical)

Repeater-side frequencies are **inverted** vs the radio channel:

| ETCC field             | `RepeaterListing` / library `Channel` |
| ---------------------- | ------------------------------------- |
| `tx` (repeater output) | `rxFrequencyHz` / `rxFrequency`       |
| `rx` (repeater input)  | `txFrequencyHz` / `txFrequency`       |

Values are integer **Hz**.

## Mode flags (`modeCodes`)

Each listing carries one or more mode flags. A repeater may advertise several modes (e.g. analogue FM plus Fusion).

| Flag  | Meaning                         | Maps to library mode    |
| ----- | ------------------------------- | ----------------------- |
| `A`   | Analogue                        | `fm`                    |
| `D`   | D-STAR                          | `dstar`                 |
| `E`   | Tetra                           | `tetra`                 |
| `M`   | DMR                             | `dmr`                   |
| `M:n` | DMR with colour code _n_ (0–15) | `dmr`, `colourCode = n` |
| `F`   | Fusion / YSF                    | `ysf`                   |
| `P`   | P25                             | `p25`                   |
| `7`   | M17                             | `m17`                   |
| `N`   | NXDN                            | `nxdn`                  |

Parser: [`src/integrations/repeaters/ukrepeater/modeCodes.ts`](../../../src/integrations/repeaters/ukrepeater/modeCodes.ts).

### Import vs display

- **Display:** all recognised flags become mode pills on directory search results.
- **Add to library:** `repeaterListingToChannel` creates one `modeProfiles` entry per advertised mode — full **FM** and **DMR** profiles where those modes are present; other digital modes use a mode-only stub until dedicated profile types exist.

DMR timeslot is not in ETCC listings — operator configures in CRUD.

## Field mapping (ETCC → `RepeaterListing`)

| ETCC field  | `RepeaterListing` field              | Notes                              |
| ----------- | ------------------------------------ | ---------------------------------- |
| `tx`        | `rxFrequencyHz`                      | Hz; see inversion above            |
| `rx`        | `txFrequencyHz`                      | Hz                                 |
| `ctcss`     | `toneHz`                             | `0` or absent → no tone            |
| `modeCodes` | `modes`, `primaryMode`, `colourCode` | See mode flags                     |
| `locator`   | `location`                           | Via `locatorToCoords` in core      |
| `repeater`  | `callsign`                           |                                    |
| `town`      | `name`                               |                                    |
| `band`      | `band`                               | Wire band code (e.g. `2M`, `70CM`) |
| `status`    | `status`                             |                                    |
| `id`        | `remoteId`                           |                                    |

## Lossy / not modelled

| ETCC data                             | Treatment                                            |
| ------------------------------------- | ---------------------------------------------------- |
| Talk groups, contacts, RX group lists | Operator configures in library CRUD                  |
| DMR timeslot                          | Operator configures in CRUD                          |
| Non-FM/DMR digital modes on import    | Mode-only profile stub (no mode-specific fields yet) |
| `type`, keeper, ERP, antenna metadata | Not stored on import today                           |

## Disclaimer

Frequency and site data from ukrepeater.net is for amateur programming convenience. Not authoritative for emergency operations.

## Related

- [repeater directories feature](../../features/repeater-directories/README.md)
- [ETCC API docs](https://api-beta.rsgb.online/)
