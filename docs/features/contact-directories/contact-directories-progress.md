# Contact directories — progress

**Tracking:** [#374](https://github.com/pskillen/codeplug-studio/issues/374) · branch `374/pskil/dmr-contact-directory-import`

## Status

| Slice                          | Status   | Notes                |
| ------------------------------ | -------- | -------------------- |
| DigitalContact model (#377)    | Complete | `2d67104`            |
| CRUD UI (#378)                 | Complete | `b2cb5d0`            |
| radioid.net integration (#379) | Complete | `11167dd`            |
| Add from UI (#379)             | Complete | `910ad7b`            |
| Anytone export (#376)          | Complete | `716cced`            |
| Documentation                  | Complete | hub + radioid tier-3 |

## Shipped in this branch

- Extended `DigitalContact` with callsign, city, state, country, remarks + native YAML round-trip
- Digital contact editor and list columns for enriched metadata
- RadioID.net client, Pages Function proxy, Vite dev proxy
- Library Contacts **Add from…** → radioid search/import UI
- Anytone `DMRDigitalContactList.CSV` metadata projection
- Tier-1 [contact-directories README](README.md), tier-3 [radioid reference](../../reference/radioid/README.md)

## Manual verify

1. Library → Contacts → **Add from…** → RadioID.net
2. Search `callsign=W1AW` (or filter by country)
3. Add contact; confirm editor shows callsign + address fields
4. Anytone build export: `DMRDigitalContactList.CSV` has populated metadata columns
