# Contact directories — progress

**Tracking:** [#374](https://github.com/pskillen/codeplug-studio/issues/374) · branch `374/pskil/dmr-contact-directory-import` · PR [#380](https://github.com/pskillen/codeplug-studio/pull/380)

## Status

All epic slices shipped on this branch.

## Shipped in this branch

- Extended `DigitalContact` metadata + native YAML round-trip ([#377](https://github.com/pskillen/codeplug-studio/issues/377))
- Digital contact CRUD UI ([#378](https://github.com/pskillen/codeplug-studio/issues/378))
- RadioID.net integration, CORS proxy, search/import UI ([#379](https://github.com/pskillen/codeplug-studio/issues/379))
- Country autocomplete, bulk **Add all**, update/compare dialogs, preview modal
- Contacts section nav on digital/analog editor routes
- Anytone `DMRDigitalContactList.CSV` metadata export ([#376](https://github.com/pskillen/codeplug-studio/issues/376))
- Dev proxy trailing-slash fix for RadioID.net 308 redirect

## Manual verify

1. Library → Contacts → **Add from…** → RadioID.net — search by country; confirm single same-origin API request (no CORS redirect)
2. **Add all on this page** / **Add selected** above results table
3. Click callsign/ID on existing contact → preview modal; **Update from RadioID.net** applies diff
4. Digital contact editor → **Update from RadioID.net**
5. `/library/digital-contacts/new` — secondary nav shows Contacts actions (not Channels)
6. Anytone export — `DMRDigitalContactList.CSV` metadata columns populated
