# AAB build and Play Store publish pipeline

Part of [#1206](https://github.com/pskillen/codeplug-studio/issues/1206) (follows [#890](https://github.com/pskillen/codeplug-studio/issues/890)). Covers how a signed `.aab` is built and how it reaches Google Play. Listing graphics/copy live in [store-assets/README.md](store-assets/README.md); Play Console account setup (app creation, Data safety form) remains separate manual work under #890.

## Purpose

Play treats every `versionCode` as single-use, monotone, and permanent. GitHub still builds **per environment** (pre-release tags are `1.2.3-rc.N`, full releases are `1.2.3`, and `BUILD_ENV` is baked). CI therefore does not promote one binary across tracks. It **reconciles** Play towards “version V, code C, is on track T”: upload only when that code is absent, otherwise patch the track.

Retries of the same tag must never mint a second binary or hit `Version code N has already been used`.

## Fixed track map

No workflow accepts a track input. The GitHub event implies the track; the reconcile workflow derives it from the tag.

| GitHub event             | Workflow                                                                                | `BUILD_ENV`    | Play                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Push to `dev`            | [`dev.yaml`](../../../.github/workflows/dev.yaml)                                       | `dev`          | none — APK artifact only                                                                                                                             |
| Push to `main`           | [`main.yaml`](../../../.github/workflows/main.yaml)                                     | `main`         | none — APK artifact only (do **not** upload `main` AABs; run-number codes on Internal can strand a code higher than the next SemVer-derived release) |
| Pre-release `1.2.3-rc.N` | [`staging.yaml`](../../../.github/workflows/staging.yaml)                               | `staging`      | ensure on **Open testing** (`beta`)                                                                                                                  |
| Full release `1.2.3`     | [`prod.yaml`](../../../.github/workflows/prod.yaml)                                     | `prod`         | ensure on **Production**                                                                                                                             |
| Manual dispatch          | [`android-play-reconcile.yaml`](../../../.github/workflows/android-play-reconcile.yaml) | n/a — no build | re-assert a version Play already holds on **its mapped track** (`-rc` → `beta`, else `production`)                                                   |

RC binaries are staging-flavoured (staging API origin, pre-prod GA4, Propagation Visualiser visible). Putting an RC on Production is a **hard refusal** with no override.

Each automatic path publishes `status: completed` at 100% (no staged rollout). Play may still hold a rollout while a version is under review — that is Play Console behaviour, not a pipeline bug.

**Cadence:** testers get a build when you publish a GitHub pre-release; real users get a build when you publish a full GitHub release. If Play update notifications feel too frequent, publish full releases less often. Do not reintroduce weekly batching or a cron.

## `versionCode` scheme

Tagged staging/prod runs share one code between that run’s APK and AAB, derived in [`scripts/play/version-code.mjs`](../../../scripts/play/version-code.mjs):

```text
versionCode = major * 1_000_000 + minor * 10_000 + patch * 100 + prerelease
```

`prerelease` is the RC ordinal (`-rc.4` → 4) or **99** for a final release, so a final always outranks every RC of the same version. Untagged `dev`/`main` APKs still use `github.run_number` (they never reach Play).

| Tag          | `versionCode` |
| ------------ | ------------- |
| `0.2.7-rc.1` | 20 701        |
| `0.2.7`      | 20 799        |
| `1.2.3-rc.4` | 1 020 304     |
| `1.2.3`      | 1 020 399     |

The same tag always produces the same code. A bad RC is fixed by cutting `-rc.(N+1)`; a failed CI run for an unchanged tag reuses the code and only patches the track.

`rc.99` and unrecognised pre-release ids (`-beta.1`, bare `-rc`) are rejected so a wrong guess cannot permanently burn a Play code.

## Preflight and ensure-on-track

Reusable [`android-release.yaml`](../../../.github/workflows/android-release.yaml) when `play_track` is set:

1. **Preflight** ([`scripts/play/preflight.mjs`](../../../scripts/play/preflight.mjs)) lists Play bundles (~seconds, before Gradle):
   - code absent → `upload` (build APK + AAB, then ensure)
   - code present, `versionName` matches (or not yet on a track) → `reconcile` (skip Gradle)
   - code present, `versionName` differs → **fail** (scheme drift)
2. **Ensure** ([`scripts/play/ensure-on-track.mjs`](../../../scripts/play/ensure-on-track.mjs)): upload the AAB only if the code is absent, `edits.tracks.patch` with `releaseName` equal to the tag, `status: completed`, then commit. If that code is already completed on the track, the edit is discarded (no-op).

Play-touching jobs share concurrency group `android-play-publisher` with `cancel-in-progress: false` (`edits.*` uses optimistic concurrency).

Release notes come from the GitHub release body (truncated to 500 characters) or a short fallback. `android-<semver>` git tags are not used; Play’s bundle list plus `releaseName` is the cursor.

## Sideload APKs vs Play

Play App Signing re-signs store installs. A Play install and a sideloaded Release-asset APK have different signing keys and **cannot upgrade each other**. Sideload `versionCode` values therefore never contend with Play’s namespace.

Once a tag-derived release APK (≥ 10 000) is sideloaded, a later `dev` APK with a `run_number` code (~hundreds) is an OS **downgrade** and Android refuses it without an uninstall.

## Manual prerequisites (Play Console + GitHub)

1. Play Console service account (**Setup → API access**) with Release Manager permission; JSON key in repo secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.
2. **Open testing** track set up in the Console (countries, testers) before `staging.yaml` can publish to `beta`.
3. At least one tester configured on Open testing — Play rejects uploads to a track with no testers.
4. Listing / Data safety / content rating still under [#890](https://github.com/pskillen/codeplug-studio/issues/890).

## Manual re-run

- **Open testing:** publish a new GitHub pre-release, or **re-run** the failed `staging.yaml` job (preflight reconciles).
- **Production:** publish a full GitHub release, or re-run `prod.yaml`.
- **Half-finished publish** (bundle on Play, track patch missed): Actions → **Reconcile Android Play track** → `version` = the release tag. Track is derived; the workflow does not build.

## Live verify

Workflow behaviour can only be proven against the real Console (Open testing must exist first):

1. Throwaway pre-release `0.3.0-rc.1` → preflight `upload`; one bundle on Open testing, `releaseName` equal to the tag, `versionCode` 30 001, rolled out (not draft).
2. **Re-run that staging job** → preflight `reconcile`, no Gradle, no `Version code … already used`.
3. Dispatch reconcile for `0.3.0-rc.1` → derives `beta`, already on track, exits 0.
4. Full release `0.3.0` → prod-flavoured bundle `versionCode` 30 099 on Production only; RC on Open testing untouched.
5. Footers: `staging · 0.3.0-rc.1` from Open testing, `prod · 0.3.0` from Production.
6. Sideload APK installs over an existing sideload; a subsequent `dev` APK may be refused as a downgrade.
7. Confirm no `android-*` tag is created.
