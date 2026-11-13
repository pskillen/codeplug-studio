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

### UV-5R Mini rows: one per flash layout

A UV-5R Mini release ships two files, one per flash layout (`L1`, `L2`: the factory firmware's packing, not the
board). In the index that is **one row per layout**: both rows share `radioId` (`baofeng-uv5rmini`) and `version`, and
each has an optional `layout` field, `"L1"` or `"L2"`:

```json
{
  "radioId": "baofeng-uv5rmini",
  "version": "1.0.0",
  "layout": "L2",
  "patchPath": "releases/baofeng-uv5rmini/…-L2-1.0.0.patch.json",
  "…": "…"
}
```

- **Without `layout`**, a Mini row takes its layout from the patch's build name (`mm9pdy-L1-…`, `mm9pdy-L2-…`) once
  the patch is downloaded. A row whose `layout` disagrees with its build name, or that has neither, is refused.
- **Only `L1` and `L2`** are release layouts. NRF and NRFB radios get separate builds and a radio's code base never
  changes, so a row is identified by its whole stock base, not by `layout` alone: today `nrfb-v0.04` (`L1`) and
  `nrf-v0.27` (`L2`). A release may ship only some bases (1.0.0: `nrf-v0.27` only). `V4` (`mm9pdy-V4-…`) is retired: a
  `V4` row makes the index invalid, and a `V4` file from disk is refused.
- **`base`** (optional, Mini only), e.g. `"base": "nrf-v0.27"`: the row's stock base. It must be a base Studio knows
  and the base of the row's `stockVersion`; a downloaded patch whose `base` disagrees with it, or with its stock's base,
  is refused. One row per layout and stock version.
- **Other radios' rows carry no `layout` or `base`**; either on one is a malformed row.
- Studio lists a Mini release once per version and loads every row of that version. Prepare picks the file on the
  radio's base and layout (from its radio report, or its Firmware, suffix and Hardware answers) and never the nearest
  build; a radio with no file in the release is told there is no MM9PDY build for it yet. The retry after a refusal
  goes only to a file of the same suffix.
- The patch-file dropzone takes one file, or the release's two files at once (layouts from their build names). Two
  files must be one release: the same version, both published or both not, one per layout.

The public repository's index format doc and `tools/release_index.py` don't have the `layout` and `base` fields yet.

### RT95 main board rows

The RT95 main board is its own firmware radio, so its releases live under their own path and project: `radioId`
`retevis-rt95-main`, `patchName` `retevis-rt95-main-firmware`, `patchPath` `releases/retevis-rt95-main/rt95-main-fw-<label>.patch.json`,
`stockVersion` `MAIN V1.61 (20231202)`. The same patch can be loaded from disk as a user patch (CI artifact
`rt95-main-fw-<label>`). Format and limits: [RT95 firmware.md](../../reference/radios/retevis/rt95/firmware.md#main-board-patch-format).
The main board stays hidden on prod.

## What Studio checks

| When              | Check                                                                                                                                                                                                                                                                                                                                                                       | Code                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Parsing the index | Known format; every field present and well formed; channel matches the version; patch path inside `releases/<radioId>/`; project is the radio's; `layout` only on a radio with release layouts, and one of them; no duplicates (per layout). A row for a radio Studio doesn't know, or for another stock version, is skipped, so the index can run ahead of a Studio deploy | `parsePublishedReleaseIndex` (`src/core/firmware/releases/publishedIndex.ts`)           |
| Loading a release | Downloaded bytes match `patchSha256`; the patch parses; its project and version match the row; it is built on the radio's pinned stock (every member's hash and size); its result hashes equal the row's. With layouts: the row's layout agrees with the build name's, one file per layout                                                                                  | `createPublishedFirmwareReleaseSource`, `checkPublishedPatch`, `resolvePublishedLayout` |
| Preparing         | With layouts: the release has a file for the radio's layout (`pickPatchForLayout`). The patch applies to the user's verified stock and the result matches; the updater's hard interlocks                                                                                                                                                                                    | `prepareFirmwareImage`, the radio's `FirmwareUpdater`                                   |

## Tests

- `publishedIndex.test.ts`, `sources.test.ts`, `layouts.test.ts` and `publicReleaseIndex.test.ts` cover parsing, the
  checks, releases by layout and the fetcher with synthetic releases.
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
