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

### UV-5R Mini rows: one per stock base and version

Each UV-5R Mini stock base (`nrf-v0.27`, `nrfb-v0.04`) is its own **variant**, with its own SemVer line set by its
own features. A release is identified by **base and version**, never version alone: the index has one row per base and
version, and the same version on two bases is two releases. One version means the same user-facing behaviour on every
variant, so a variant may be behind or ahead of another, and the wizard says so.

```json
{
  "radioId": "baofeng-uv5rmini",
  "version": "1.0.0",
  "stockVersion": "v0.27 (NRF)",
  "base": "nrf-v0.27",
  "layout": "L2",
  "patchPath": "releases/baofeng-uv5rmini/uv5rmini-fw-1.0.0-nrf-v0.27-hw1.7.patch.json",
  "toStock": {
    "path": "releases/baofeng-uv5rmini/to-stock/…-nrf-v0.27-hw1.7-1.0.0.patch.json",
    "sha256": "…"
  },
  "…": "…"
}
```

- **`version`** is the bare SemVer (`1.0.1`, `1.0.1-rc.2`), as for every radio. Within a base, releases sort by SemVer
  precedence: a final above its own RCs, RCs by number (`rc.10` above `rc.2`).
- **`base`** is the row's stock base. It must be one Studio knows and the base of the row's `stockVersion`; a row
  without one takes the base its `stockVersion` names, and a row whose base can't be told that way is malformed. Two
  rows of one version on one base make the index invalid. Studio keys the release `<base>:<version>`
  (`nrf-v0.27:1.0.0`).
- **The layout comes from verified metadata**: the row's `layout` and the layout of its base in Studio's own table
  (`nrf-v0.27` → `L2`, `nrfb-v0.04` → `L1`). A downloaded patch must name the row's base and be built on exactly that
  base's pinned stock. The build name only cross-checks: a new-style name (`v0.27-NRF-1.0.1`, `v0.04-NRFB-1.0.0-rc.1`)
  must carry the prefix of that same base and the row's version, with an RC no higher than 9; a legacy name
  (`mm9pdy-L1-…`, `mm9pdy-L2-…`) must carry that base's layout tag; `V4` and any prefix that is no known base are
  refused. Any disagreement, or a row whose layout neither it nor its base gives, is refused. A name or `NRF`
  suffix alone is never taken as evidence of which radios a file is for.
- **The shipped 1.0.0** (`mm9pdy-L2-1.0.0`, `base` `nrf-v0.27`) reads as v0.27-NRF 1.0.0 and works unchanged, with its
  to-stock patch.
- **Picking.** The wizard's **Your radio** step identifies the radio's base before Firmware, which lists only that
  base's releases (`listReleases(radioId, { base })`, or `releasesForBase` over the whole list), so a lower version
  built for the radio is offered over a higher one for another base. Prepare still picks the file on the radio's base
  and layout and never the nearest build. **Back to stock** offers only that base's to-stock patch: one per base,
  finals first (`publishedToStockChoices`).
- **Patch files from disk.** A new-style name is checked the same way (its prefix names a base that is the patch's
  `base`, and the patch is built on that base's pinned stock); a PR build with the base's prefix
  (`v0.27-NRF-pr12-gabc12`) is taken on the same terms. Such a file is picked on its own: two files with a variant name
  are refused, since one version on two bases is two releases. An older release's legacy pair (`mm9pdy-L1-…` and
  `mm9pdy-L2-…`) may still be picked together; Prepare uses the one for the radio.
- **Other radios' rows carry no `layout` or `base`**; either on one is a malformed row. Their releases stay keyed and
  sorted as before: by version, newest publication first.

The public repository's `tools/release_index.py` writes the `layout` and `base` fields; this page is their reference
on the Studio side.

### RT95 main board rows

The RT95 main board is its own firmware radio, so its releases live under their own path and project: `radioId`
`retevis-rt95-main`, `patchName` `retevis-rt95-main-firmware`, `patchPath` `releases/retevis-rt95-main/rt95-main-fw-<label>.patch.json`,
`stockVersion` `MAIN V1.61 (20231202)`. The same patch can be loaded from disk as a user patch (CI artifact
`rt95-main-fw-<label>`). Format and limits: [RT95 firmware.md](../../reference/radios/retevis/rt95/firmware.md#main-board-patch-format).
The main board is offered on prod from the RT95 1.2.0 release.

## What Studio checks

| When              | Check                                                                                                                                                                                                                                                                                                                                                                                                                              | Code                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Parsing the index | Known format; every field present and well formed; channel matches the version; patch path inside `releases/<radioId>/`; project is the radio's; `layout` and `base` only on a radio with release layouts, each one of them; no duplicates (per version, and stock base where the radio has bases). A row for a radio Studio doesn't know, or for another stock version, is skipped, so the index can run ahead of a Studio deploy | `parsePublishedReleaseIndex` (`src/core/firmware/releases/publishedIndex.ts`)           |
| Loading a release | Downloaded bytes match `patchSha256`; the patch parses; its project and version match the row; it is built on the radio's pinned stock (every member's hash and size); its result hashes equal the row's. With layouts: the patch names the row's base; the layout is the row's and its base's, and the build name agrees with both                                                                                                | `createPublishedFirmwareReleaseSource`, `checkPublishedPatch`, `resolvePublishedLayout` |
| Preparing         | With layouts: the release has a file for the radio's layout and base (`pickPatchForLayout`). The patch applies to the user's verified stock and the result matches; the updater's hard interlocks                                                                                                                                                                                                                                  | `prepareFirmwareImage`, the radio's `FirmwareUpdater`                                   |

## Tests

- `publishedIndex.test.ts`, `sources.test.ts`, `layouts.test.ts` and `publicReleaseIndex.test.ts` cover parsing, the
  checks, releases by layout and the fetcher with synthetic releases; `variantReleases.test.ts` covers the Mini's
  releases by base and version (two bases at one version, the radio's base over a higher version elsewhere, SemVer
  order, fail-closed names and metadata, the legacy 1.0.0 row, to-stock per base, files from disk).
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

Published index rows may include `toStock` with a `path` under the radio’s `releases/` directory and a SHA-256 `sha256` of the patch bytes. Back to stock offers one per base, preferring the newest final that has one, or the newest release candidate; the downloaded hash is checked. A file from disk remains available. Malformed fields invalidate the index.
