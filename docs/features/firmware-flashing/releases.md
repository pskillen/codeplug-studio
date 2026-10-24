# Firmware releases

Where the flasher's releases come from, and what Studio checks before it uses one. Product rules:
[DESIGN.md — Firmware flashing](../../../DESIGN.md#firmware-flashing).

## Source

The firmware project publishes every release, RC or final, to the public repository
[pskillen/mm9pdy-firmware](https://github.com/pskillen/mm9pdy-firmware) from its own release workflow. Studio bundles
none. At run time the flasher fetches:

1. `releases.json`, the release index, from
   `https://raw.githubusercontent.com/pskillen/mm9pdy-firmware/main/releases.json` (override with
   `VITE_FIRMWARE_RELEASE_INDEX_URL`, for example to test against a fork or a local server);
2. the patch the operator picks, at the index row's `patchPath`, resolved against the index URL.

Both are plain GETs with no credentials and `cache: no-cache`. Nothing is sent about the operator or the radio, and
nothing is stored. The index is fetched once per page load; a failure is not kept, so **Try again** fetches again.
When the index can't be fetched, stock and a patch file from disk still work (a dropped file then can't be matched to
a published release, so it is treated as unreviewed).

A new firmware release reaches Studio users as soon as it is published there. No Studio release is needed.

## Index format (format 1)

```json
{
  "format": 1,
  "releases": [
    {
      "radioId": "baofeng-dm32uv",
      "version": "1.1.0",
      "channel": "final",
      "patchName": "baofeng-dm32-firmware",
      "patchFile": "dm32-fw-1.1.0.patch.json",
      "patchPath": "releases/baofeng-dm32uv/dm32-fw-1.1.0.patch.json",
      "patchSha256": "<64 hex>",
      "stockVersion": "v1.01.048",
      "publishedOn": "2026-10-22",
      "summary": "One or two sentences for the release list.",
      "verifyHint": "How the operator confirms it is running.",
      "resultSha256": { "bin": "<64 hex>" },
      "notesPath": "releases/baofeng-dm32uv/dm32-fw-1.1.0.md",
      "notes": "Release notes in the subset ReleaseNotes renders."
    }
  ]
}
```

The public repository generates it from each release's patch and sidecar notes (`tools/release_index.py` there).
`resultSha256` is keyed by the radio's stock member roles.

## What Studio checks

| When              | Check                                                                                                                                                                                                                                                                                          | Code                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Parsing the index | Known format; every field present and well formed; channel matches the version; patch path inside `releases/<radioId>/`; project is the radio's; no duplicates. A row for a radio Studio doesn't know, or for another stock version, is skipped, so the index can run ahead of a Studio deploy | `parsePublishedReleaseIndex` (`src/core/firmware/releases/publishedIndex.ts`) |
| Loading a release | Downloaded bytes match `patchSha256`; the patch parses; its project and version match the row; it is built on the radio's pinned stock (every member's hash and size); its result hashes equal the row's                                                                                       | `createPublishedFirmwareReleaseSource`, `checkPublishedPatch`                 |
| Preparing         | The patch applies to the user's verified stock and the result matches; the updater's hard interlocks                                                                                                                                                                                           | `prepareFirmwareImage`, the radio's `FirmwareUpdater`                         |

## Tests

- `publishedIndex.test.ts`, `sources.test.ts` and `publicReleaseIndex.test.ts` cover parsing, the checks and the
  fetcher with synthetic releases.
- **Local only:** `publicRepoCheck.test.ts` checks every release in a clone of the public repository, and
  `localStockCheck.test.ts` also applies each one to your stock firmware and compares the result hashes.

  ```bash
  CODEPLUG_FIRMWARE_PUBLIC_REPO=~/git/mm9pdy-firmware CODEPLUG_FIRMWARE_STOCK_DIR=~/firmware-stock npx vitest run src/core/firmware/releases
  ```

  Keep the stock folder outside the repository.

## Adding a radio

A new radio's firmware project needs a row in `FIRMWARE_PROJECTS` (`src/core/firmware/releases/projects.ts`), its
patch format under `src/core/firmware/patch/formats/`, and the radio's stock descriptor. Its releases then appear as
soon as the public repository lists them.
