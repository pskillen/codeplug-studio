# IRTS Ireland repeater directory reference

Authoritative reference for the **Irish Radio Transmitters Society (IRTS)** repeater listings used by Codeplug Studio for Republic of Ireland amateur repeaters.

This is a **remote directory dataset**, not a CPS wire format. HTTP proxy, CSV parse, and normalisation live in [`src/integrations/repeaters/`](../../../src/integrations/repeaters/). Feature behaviour: [repeater directories](../../features/repeater-directories/README.md).

## Source

| Property         | Value                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| Publisher        | [IRTS](https://www.irts.ie/) — Irish Radio Transmitters Society                                                 |
| Human listing    | `https://www.irts.ie/cgi/repeater.cgi`                                                                          |
| Wire file (v1)   | `https://www.irts.ie/dnloads/repeaters_Anytone578.csv`                                                          |
| Licence          | Free download for amateur programming; attribute IRTS in UI                                                     |
| Geographic scope | **Republic of Ireland** in CSV (`EI*`, `EJ*` callsigns); NI `GB*` sites on the HTML page are **not** in the CSV |
| Freshness        | Society-maintained; HTML footer shows last update; CSV `Last-Modified` varies                                   |

Alternate exports (not used in v1 UI): Chirp CSV (`repeaters_chirp.csv`), ICOM IC-9700 band-split CSVs.

## CORS bridge (Studio)

IRTS does **not** send `Access-Control-Allow-Origin`. The browser SPA cannot fetch the CSV directly.

Studio exposes a same-origin Pages Function:

| Property    | Value                                                                                                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Studio path | `GET /api/irts/repeaters`                                                                                                                                                                                |
| Upstream    | `https://www.irts.ie/dnloads/repeaters_Anytone578.csv`                                                                                                                                                   |
| Auth        | None (public upstream; no operator API key)                                                                                                                                                              |
| Cache       | `Cache-Control: public, max-age=3600`                                                                                                                                                                    |
| Origin gate | Shared allowlist with RepeaterBook — deploy hostnames (`codeplug.mm9pdy.net`, `*.codeplug.mm9pdy.net`) and `http://localhost:5173`; see [build docs](../../build/README.md#pages-functions-cors-bridges) |
| Local dev   | Vite `server.proxy` mirrors the path                                                                                                                                                                     |

Deployed with the SPA via `wrangler.toml` + `functions/api/irts/repeaters.ts` on every environment (dev / next / staging / prod).

## Candidates evaluated (spike #273)

| Source                   | Analogue | Digital                               | SPA without proxy         | Verdict                                                           |
| ------------------------ | -------- | ------------------------------------- | ------------------------- | ----------------------------------------------------------------- |
| **IRTS Anytone CSV**     | Yes      | DMR (+ limited D-STAR via Chirp only) | No (CORS)                 | **Primary v1**                                                    |
| BrandMeister             | No       | DMR only                              | Yes                       | Supplement for BM TGs (already shipped)                           |
| RepeaterBook `exportROW` | Yes      | Yes                                   | Browser + `rbuapp_` token | Shipped — see [RepeaterBook reference](../repeaterbook/README.md) |
| RadioID.net              | No       | DMR users only                        | No (CORS)                 | **Shipped** — see [radioid reference](../radioid/README.md)       |

## Anytone CSV columns (shipped parse)

Parse by **header name** — do not hard-code column positions.

| Column               | Use                                                |
| -------------------- | -------------------------------------------------- |
| `Channel Name`       | Callsign + location label (e.g. `EI7FXD Farmer's`) |
| `Receive Frequency`  | Repeater **output** → `rxFrequencyHz`              |
| `Transmit Frequency` | Repeater **input** → `txFrequencyHz`               |
| `Channel Type`       | `A-Analog` → `fm`; `D-Digital` → `dmr`             |
| `CTCSS/DCS Encode`   | Analogue TX tone (`Off` → none)                    |
| `Color Code`         | DMR colour code (1–15)                             |

### Sample rows

```csv
Channel Name,Receive Frequency,Transmit Frequency,Channel Type,Color Code,CTCSS/DCS Encode
EI2TRR Three Roc,145.60000,145.00000,A-Analog,1,88.5
EI7FXD Farmer's,430.25000,439.25000,D-Digital,1,Off
EI7PMD Portmarno,439.46250,430.46250,D-Digital,2,Off
```

## Normalised listing (`RepeaterListing`)

| Wire / derived         | `RepeaterListing`                            |
| ---------------------- | -------------------------------------------- |
| `source`               | `'irts'`                                     |
| `callsign`             | Leading token from `Channel Name`            |
| `name`                 | Remainder of `Channel Name` (location label) |
| Receive MHz × 1e6      | `rxFrequencyHz`                              |
| Transmit MHz × 1e6     | `txFrequencyHz`                              |
| Encode tone (analogue) | `toneHz`                                     |
| `Channel Type`         | `modes[]`, `primaryMode`, `colourCode`       |
| `callsign@rxMhz`       | `remoteId`                                   |
| RX frequency           | `band` wire label via `bandFromFrequencyMhz` |
| —                      | `locator`, `location` null in v1             |
| —                      | `status` empty                               |

Frequency convention matches other repeater directories: `rxFrequencyHz` is what the **radio receives** (repeater output).

## Client API

| Function                                | Role                                          |
| --------------------------------------- | --------------------------------------------- |
| `fetchIrtsRepeaters()`                  | Load full catalogue via `/api/irts/repeaters` |
| `searchIrtsByCallsign(callsign)`        | Filter catalogue for verify                   |
| `filterIrtsListings(listings, filters)` | Client-side query / band / mode               |

Parser: [`src/integrations/repeaters/irtsClient.ts`](../../../src/integrations/repeaters/irtsClient.ts).

## Attribution

Credit **IRTS** / [irts.ie](https://www.irts.ie/cgi/repeater.cgi) wherever repeater data is shown or imported. Frequency and site data is for amateur programming convenience — not authoritative for emergency operations.
