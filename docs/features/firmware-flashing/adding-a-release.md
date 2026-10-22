# Adding a firmware release

How a maintainer bundles a new firmware release into Studio. Releases reach Studio by hand: a release ships to users
only with a Studio release, which is deliberate. Studio chooses what ships.

**The rule:** only the firmware project's published **release patch** (`*.patch.json`) and a Studio copy of its notes
are committed. **Never vendor firmware**: no stock image, vendor zip or slice of one, anywhere in the repo, including
test fixtures. See [DESIGN.md — Firmware flashing](../../../DESIGN.md#firmware-flashing).

## Code anchors

| What                   | Where                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| Patch files and notes  | `src/core/firmware/releases/<radioId>/<tag>.patch.json`, `<tag>.release-notes.md`                         |
| Index                  | `BUNDLED_FIRMWARE_RELEASES` in `src/core/firmware/releases/index.ts`                                      |
| Catalog test           | `src/core/firmware/releases/catalog.test.ts`                                                              |
| Local stock check      | `src/core/firmware/releases/localStockCheck.test.ts` (skipped unless the env var is set)                  |
| Byte-exactness hygiene | `.prettierignore` (`src/core/firmware/releases/**/*.patch.json`), `.gitattributes` (`*.patch.json -text`) |

`<radioId>` is the firmware radio id (`baofeng-dm32uv`, `anytone-at-d890uv`). `<tag>` is the firmware project's tag
without a `v` (`1.1.0`, `1.1.0-rc.1`).

## Procedure

1. **Download** the release's `.patch.json` and `SHA256SUMS` from the firmware project's release page.
2. **Check the hash.** `sha256sum <file>.patch.json` must match its `SHA256SUMS` line. Both forms appear in published
   files, and both are fine: `<hash>  name.patch.json` and `<hash>  ./name.patch.json`.
3. **Copy the file with `cp`**, never through an editor or formatter:

   ```bash
   cp ~/Downloads/dm32-fw-1.1.0.patch.json src/core/firmware/releases/baofeng-dm32uv/1.1.0.patch.json
   sha256sum src/core/firmware/releases/baofeng-dm32uv/1.1.0.patch.json
   ```

   **Never reformat it.** `.prettierignore` and `.gitattributes` protect it; don't remove those entries.

4. **Write the Studio copy of the release notes** as `<tag>.release-notes.md` beside the patch. The wizard shows it
   unchanged, with a simple renderer: paragraphs, `- ` bullets, `**bold**` and `` `code` `` only. No links or HTML.
   Don't link to private repositories.
5. **Add the index row** to `BUNDLED_FIRMWARE_RELEASES`:
   - `tag`, `channel` (`'rc'` exactly when the tag ends `-rc.N`), `patchFile` (the published asset name),
     `patchSha256` (from `SHA256SUMS`), `stockVersion` (the radio's pinned `StockFirmwareDescriptor.version`),
     `publishedOn`;
   - `summary`: one or two sentences, from the notes' "What's in it";
   - `verifyHint`: how the operator confirms it is running, from the notes' "Checking it worked";
   - `resultSha256`: the patch's `result` hashes by role;
   - `loadBytes` / `loadNotes`: `import('./<radioId>/<tag>.patch.json?raw')` and the notes with `?raw`, as the
     existing rows do.
6. **Run `npm run format`** and confirm the patch hash is unchanged.
7. **Run the catalog test:** `npx vitest run src/core/firmware/releases`. It checks the bytes, the format, the pinned
   stock, the result hashes, radio-specific limits and the notes.
8. **Optional, local only:** apply the patch to your own stock firmware:

   ```bash
   CODEPLUG_FIRMWARE_STOCK_DIR=/path/outside/the/repo npx vitest run src/core/firmware/releases/localStockCheck.test.ts
   ```

   Keep the stock directory outside the repo. The test reads it in memory and copies nothing.

9. **Keep at least one final per radio.** The catalog test fails otherwise.

## Removing a release

Delete its row, patch and notes in one commit. Keep at least one final release per radio.

## Related

- [Firmware flashing hub](README.md)
- Tier-3 patch formats: [DM-32UV](../../reference/radios/baofeng/dm-32uv/firmware.md), [AT-D890UV](../../reference/radios/anytone/at-d890uv/firmware.md)
