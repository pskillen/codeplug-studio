# AAB build and Play Store publish pipeline

Part of [#890](https://github.com/pskillen/codeplug-studio/issues/890). Covers how the signed `.aab` gets built and how it reaches Google Play — listing graphics/copy live in [store-assets/README.md](store-assets/README.md); Play Console account setup (app creation, Data safety form) is separate manual work also tracked under #890.

## Why two publish paths

Codeplug Studio ships web changes often (little and often, continuous deploy). Play Store update notifications are visible to real users in a way web deploys aren't, so pushing every full release straight to Production would be noisy. The design decouples release cadence from Play update cadence, while still giving closed testers a fresh build every time:

| Release type                            | AAB destination                       | Timing                                                                                         |
| --------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Staging (GitHub pre-release)            | Play **Closed Testing** track         | Immediate — same CI run, no batching. Testers are opted in and want fresh RCs.                 |
| Prod (GitHub full release)              | Workflow artifact only (no Play push) | —                                                                                              |
| Latest prod release, weekly + on-demand | Play **Production** track             | Batched by [`android-play-publish.yaml`](../../../.github/workflows/android-play-publish.yaml) |

## AAB build (`android-release.yaml`)

`bundleRelease` runs alongside the existing `assembleRelease` (APK) build when the caller sets `build_aab: true` — both `staging.yaml` and `prod.yaml` do. Output is copied to `codeplug-studio-<version>.aab` and uploaded as a workflow artifact named `app-release-aab-${{ inputs.build_env }}` (`retention-days: 90`, same as the APK artifact). It is **never** attached to the GitHub Release — a `.aab` isn't directly installable, so its only real consumer is Play, which retains every version you upload to it indefinitely.

When `publish_to_play_track` is also set (non-empty), a further step pushes the just-built AAB to that track via [`r0adkll/upload-google-play@v1`](https://github.com/r0adkll/upload-google-play). `staging.yaml` sets this to `alpha` (Play's API id for the default Closed Testing track — confirm this against the real Play Console track once created; Play Console allows renaming/custom tracks, in which case adjust the value). `prod.yaml` leaves it empty; the weekly workflow handles Production instead.

## Weekly Production publish (`android-play-publish.yaml`)

Triggers: `schedule` (Monday 09:00 UTC — adjust the cron if a different slot is preferred) and `workflow_dispatch` (manual "ship to Play now").

1. Find the latest full (non-prerelease) GitHub Release via `gh release list`, SemVer-sorted.
2. Compare it against the latest `android-<semver>` git tag (the dedup marker — not a Play API query). If not newer, exit cleanly — this is the expected no-op most weeks.
3. If newer: resolve the release tag's commit SHA, find the matching successful `prod.yaml` run for that commit, and `gh run download` its `app-release-aab-prod` artifact.
4. Publish that AAB to Play's `production` track via the same `r0adkll/upload-google-play` action.
5. On success, create and push a git tag `android-<semver>` on the released commit — this becomes the marker the next run compares against.

Because the AAB is reused from the build that already ran at release time (not rebuilt), the artifact must still be within its 90-day retention window when the weekly job picks it up — fine under a weekly cadence, but don't let more than ~12 weeks pass between a full release and this job running.

## Manual prerequisites (Play Console + GitHub — not automatable)

1. Create a Play Console service account (**Setup → API access**) with Release Manager permission on the app, covering both Closed Testing and Production tracks.
2. Download its JSON key and add it as the repo secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (paste the raw JSON content).
3. Confirm the real Play API track id for Closed Testing and adjust `staging.yaml`'s `publish_to_play_track` if it isn't `alpha`.
4. Add at least one tester (email list or Google Group) to the Closed Testing track — Play rejects uploads to a track with no testers configured.
5. Check repo **Settings → Actions → General → Artifact and log retention period** — org/enterprise policy can cap this below the `retention-days: 90` set explicitly in the workflow.

Until these are done, `build_aab`/artifact upload works on every run, but the `Publish AAB to Play Store track` and weekly production-push steps will fail (no valid service account credentials) — expected until Play Console setup lands.

## Manual re-run

- **Closed Testing:** publish a new GitHub pre-release; the existing `staging.yaml` flow builds and pushes automatically.
- **Production:** `workflow_dispatch` on [`android-play-publish.yaml`](../../../.github/workflows/android-play-publish.yaml) from the Actions tab, rather than waiting for Monday — safe to run any time, it's a no-op if there's nothing newer than the last `android-*` tag.

## Verification

- No newer release available: manually dispatch the workflow, confirm it logs "nothing to do" and exits without creating a tag or touching Play.
- Newer release available: confirm it finds the matching `prod.yaml` run, downloads the artifact, the Play push succeeds, and `android-<semver>` appears on the release's commit afterward.
