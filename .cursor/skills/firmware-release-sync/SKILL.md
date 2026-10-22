---
name: firmware-release-sync
description: >-
  Check the MM9PDY firmware projects (AT-D890UV and DM-32UV) for new releases
  and release candidates, and bundle them into the Studio firmware flasher. Use
  when asked to update, refresh or sync the bundled firmware, to add a firmware
  release, or to check whether the flasher is behind upstream. Needs `gh`
  access to the private firmware repos.
---

# Firmware release sync (codeplug-studio)

Keeps `BUNDLED_FIRMWARE_RELEASES` (`src/core/firmware/releases/`) in step with the firmware projects. The per-release mechanics live in [adding-a-release.md](../../../docs/features/firmware-flashing/adding-a-release.md); this skill finds _what_ to add and drives that procedure.

**Read first:** [adding-a-release](../../../docs/features/firmware-flashing/adding-a-release.md), [firmware-flashing hub](../../../docs/features/firmware-flashing/README.md), [DESIGN.md — Firmware flashing](../../../DESIGN.md#firmware-flashing).

## Pinned projects

This list is static. Add a row here, and a row in `FIRMWARE_PROJECTS` (`src/core/firmware/releases/projects.ts`), when a new radio gets a firmware project.

| Radio id            | Repo                                  | Patch asset                  | Patch `name`            |
| ------------------- | ------------------------------------- | ---------------------------- | ----------------------- |
| `anytone-at-d890uv` | `pskillen/anytone-d890-firmware`      | `d890-fw-<tag>.patch.json`   | `anytone-d890-firmware` |
| `baofeng-dm32uv`    | `pskillen/baofeng-dm32-firmware`      | `dm32-fw-<tag>.patch.json`   | `baofeng-dm32-firmware` |

**Both repos are private.** Only people whose `gh` account can read them can run this skill. That is expected: if `gh release list -R <repo>` fails with 404 or auth errors, stop and tell the user; do not look for another source.

## Rules

- Bundle, per repo, the **latest final** and the **latest pre-release**. Older tags are not bundled, and are not removed by this skill.
- A pre-release older than the latest final (e.g. DM-32 `1.0.0-rc.3` below `1.0.0`) still counts as the latest pre-release until a newer one exists.
- Bundle only `*.patch.json` and a Studio copy of the notes. **Never vendor firmware** (stock image, vendor zip or slice).
- Copy patches with `cp`; never open, format or re-save them. Verify against the release's `SHA256SUMS`.
- Notes must not link to private repositories (see the procedure's step 4).
- Releases ship to users only with a Studio release; do not change flasher gates (`firmwareFlashEnvGate`) here.
- Do not write to a radio or run the local stock check against real firmware inside the repo.

## Procedure

1. **List upstream.** For each pinned repo:

   ```bash
   gh release list -R pskillen/anytone-d890-firmware --limit 10
   gh release list -R pskillen/baofeng-dm32-firmware --limit 10
   ```

   Pick the row marked `Latest`, and the newest row marked `Pre-release` (by publish date).

2. **Compare with the bundle.** The bundled tags are the `tag` fields in `src/core/firmware/releases/index.ts`. If both picks are already there for every repo, report "up to date" and stop.

3. **For each missing tag**, in a scratch directory outside the repo:

   ```bash
   gh release download <tag> -R <repo> -D <scratch>/<radio>-<tag>
   (cd <scratch>/<radio>-<tag> && sha256sum -c SHA256SUMS)
   gh release view <tag> -R <repo> --json body,publishedAt,isPrerelease
   ```

   The check must print `OK`. Stop on a mismatch.

4. **Write the notes** (`<tag>.release-notes.md`). The GitHub release body is usually only a changelog of PR titles; the user-facing description is in the project's docs at that tag:

   ```bash
   gh api 'repos/<repo>/contents/docs/user/releases.md?ref=<tag>' -H 'Accept: application/vnd.github.raw'   # AT-D890UV
   gh api 'repos/<repo>/contents/docs/guides/features.md?ref=<tag>' -H 'Accept: application/vnd.github.raw' # DM-32UV
   ```

   If the paths have moved, list `docs/` with `gh api repos/<repo>/contents/docs`. Follow the shape of the existing notes: what it applies to, what's in it, known limits, how to check it worked, going back to stock. Say plainly when a build is emulator-checked only. For an rc, say it is for testing.

5. **Add the files and index row** as in [adding-a-release.md](../../../docs/features/firmware-flashing/adding-a-release.md) steps 3 and 5. Read the values from the patch itself (`name`, `version`, `stock`, `result` hashes) rather than copying a neighbouring row. `channel` is `'rc'` exactly when the tag ends `-rc.N`; `stockVersion` must equal the radio's pinned stock descriptor.

6. **Check the patch against its neighbours.** A new release can change the layout (e.g. D890 `1.1.0-rc.1` has a longer version slot and a larger `.CDD`). The catalog test covers pinned stock, hooks and append offset. If it fails, or a size-dependent doc or interlock looks wrong, report it; do not loosen the test.

7. **Gates:**

   ```bash
   npx prettier --check src/core/firmware/releases/index.ts 'src/core/firmware/releases/*/*.md'
   npx vitest run src/core/firmware src/app/routes/firmware src/app/services/firmwareFlash
   sha256sum src/core/firmware/releases/*/<tag>.patch.json   # must equal SHA256SUMS
   ```

8. **Docs:** update the "Bundled releases" row in the firmware-flashing hub, and any "How to check" row that quotes a version. Then follow [git-workflow](../git-workflow/SKILL.md): issue, `{num}/{author}/…` branch, atomic conventional commits (`feat(firmware): bundle …`), PR.

## Report

End with a table of what was found upstream (per repo: latest final, latest pre-release), what was already bundled, what was added, and anything the catalog test or the docs flagged.
