# DigitalIdDirectoryInterchangeToolbar

Directory page toolbar for **local** shadow interchange — not Google Drive or native project YAML.

## Behaviour

- **YAML | CSV** segmented control chooses the wire format for download and zip.
- **Download directory** — serialises all shadow rows for the active project via `iterateDigitalIdDirectory`; upserts on import by `digitalId`.
- **Import directory** — hidden file picker; accepts `.yaml`, `.yml`, or `.csv` (format inferred from extension when possible).
- **Download zip with project** — `fflate` zip of project native YAML (library + builds only) plus directory file in the selected format. Never uploaded to Drive.

Large exports buffer all directory rows in memory before download.

## Code

- Serialisers: `src/integrations/persistence/digitalIdDirectoryInterchange.ts`
- App service: `src/app/services/digitalIdDirectoryInterchangeService.ts`
- Mounted on `/library/contacts/directory` (`DigitalIdDirectoryListPage`)
