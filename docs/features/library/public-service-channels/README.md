# Public service channels

Receive-only memories for publicly documented, unencrypted statutory-service allocations near the amateur bands. Operators add them from **Library → Channels → Add from… → Public services** without typing frequencies by hand.

The first datasets are the **United Kingdom** (national fireground, HM Coastguard, RNLI) and **Ireland** (Coast Guard and selected port working channels). Coverage grows by contributed, cited research rather than engineering work — see [contributing-data.md](contributing-data.md).

**Tracking:** [#1283](https://github.com/pskillen/codeplug-studio/issues/1283)

## Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| Add-from picker | Shipped | `/library/channels/add-public-services`; country from browser locale; groups pre-ticked |
| Transmit at creation | Shipped | `forbidTransmit: 'forbid'` is not a parameter; no UI toggle |
| Dual-mode channels | Shipped | One library channel with FM + DMR profiles; primary mode from the dataset |
| Dedup | Shipped | Name identity (case/whitespace insensitive). Frequency collisions are an advisory, not a skip |
| GB + IE datasets | Shipped | Bundled, code-split per country |
| Contributor CSV pipeline | Shipped | `scripts/public-services/` validator + converter |
| Site-specific filtering | Deferred | Flat groups — an Irish operator gets all Coast Guard working channels |
| Export/write-time TX guard | Deferred | A later bulk edit or editor change can re-enable transmit |
| General tags / provenance | Deferred | Identity is the generated channel name |

## Documentation map

| Doc | Contents |
| --- | --- |
| [dataset-schema.md](dataset-schema.md) | Interchange CSV columns, duplex and dual-mode conventions |
| [contributing-data.md](contributing-data.md) | Research brief for adding a country |
| Sidecar | [`PublicServicePicker.md`](../../../src/app/components/publicServices/PublicServicePicker.md) |

## Operator flow

1. **Add from… → Public services.**
2. Country is pre-selected from `navigator.language` when a dataset exists (`en-GB` → United Kingdom). `en-US` leaves the picker open — it never silently chooses GB.
3. Groups default to ticked. Untick families you do not want (distress vs fireground vs ports).
4. Preview shows dual-mode pills, skips for matching names, and advisories when another library channel already occupies the RX frequency.
5. **Add N channels.** Optional: one library zone per selected group.

Every generated channel is receive-only. The page banner states that reception rules vary by country and that the operator is responsible for compliance.

## Transmit guarantee — and its limit

Generation always sets `forbidTransmit: 'forbid'`. There is no option on `generateChannelsFromGroups` and no toggle on the picker. A whole-corpus test asserts the property for every group of every registered country.

This is a **creation** guarantee, not a lock:

- the channel editor exposes `forbidTransmit`
- bulk edit can patch it back to `'allow'` or `'default'`
- any later mutation between generation and `putChannel` could change it

For the two UK fireground repeater channels, `txFrequency` is the **repeater input**. An operator who re-enables transmit would key a fire-service repeater, not a simplex channel. That is the accepted cost of modelling duplex faithfully.

## Dataset policy

| Include | Exclude |
| --- | --- |
| Allocations in a public, citable source | Leaked documents or uncited hearsay |
| Unencrypted analogue FM and unencrypted DMR | Encrypted systems (UK Airwave/ESN, Irish TETRA/NDRS) |
| Stable national or regional designations | Trunked talkgroup detail, ad-hoc assignments |

Encrypted services are recorded as `knownGaps` on the country (shown in the picker) rather than omitted silently.

## Defaults on generated channels

| Field | Value |
| --- | --- |
| `forbidTransmit` | `'forbid'` |
| `txPermit` | `'default'` |
| `power` | `null` |
| `scanInclusion` | `'default'` |
| `contactRef` | `null` (promiscuous DMR monitoring) |
| `comment` | Service organisation + channel designation — **not** source URLs |
| `name` | Dataset short name, authored to ≤ 16 ASCII characters |

Citations stay on the dataset entry and in `scripts/public-services/research/<iso2>/sources.md`.

## Code splitting

Each country module under `src/core/domain/publicServices/data/` is reached only through `src/app/lib/publicServiceCountries.ts` (dynamic `import()`). The core barrel must not re-export `data/*`. A source-text test enforces that static-import rule; it cannot prove the chunk is absent from the entry bundle.

**Manual check after `npm run build`:** inspect `dist/assets/` and confirm `gb` / `ie` land in their own chunks, not the main entry.

## Known limitations

- Groups are flat. Site-specific Coast Guard working channels are not filtered by operator location.
- Re-import is a no-op only while generated names are unchanged.
- Names are authored to the 16-character ceiling of the main target radio family. Shorter CHIRP profiles still truncate at export, as they do for any channel.
- Dataset corrections ship with app releases.

## Code anchors

| Layer | Path |
| --- | --- |
| Types, generate, dedup | `src/core/domain/publicServices/` |
| Country data | `src/core/domain/publicServices/data/` |
| Import plan | `src/core/services/publicServiceImport.ts` |
| Lazy registry | `src/app/lib/publicServiceCountries.ts` |
| Persist | `src/app/lib/publicServiceImport.ts` |
| UI | `src/app/components/publicServices/PublicServicePicker.tsx` |
| Tooling | `scripts/public-services/` |
