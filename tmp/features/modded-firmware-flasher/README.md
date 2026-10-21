# Modded firmware flasher — investigation and direction

**Status:** investigation done. **Direction chosen 2026-10-21: Proposal A** (patches bundled in Studio, stock
firmware supplied by the user). Proposal B stays in the docs as a possible future direction, with its blockers listed.
No delivery plan exists yet. Sourced facts are in [findings.md](findings.md).

**Ask:** let an operator flash the MM9PDY modded firmware (AT-D890UV, DM-32UV) from Studio. We must not ship vendor
firmware: the stock image is supplied by the user during the session, patched in the browser, then written.

## TL;DR

- **Patching is easy.** Each firmware release is a **JSON patch** that applies to the pinned stock firmware with a
  pure, hash-checked algorithm. It needs no toolchain, and it ports to roughly 30 lines of TypeScript per radio.
- **The update protocols are small.** Both are documented, simple request/response protocols. Each Python sender is
  under 500 lines and has a mock bootloader we can port as a test fixture.
- **The plumbing already exists.** Studio's `BytePipe`, Web Serial and Capacitor transports, progress/abort/error kit,
  `fflate`, and `crypto.subtle` cover it.
- **How the two inputs reach the browser decides the design.** Both firmware repos are private, and neither vendor
  host sends CORS headers. Proposal A sidesteps both: the patches ship inside Studio, and the user supplies the stock
  file.

## The pipeline

```text
 stock file (user) ──► verify zip sha256 ──► unzip (fflate) ──► verify file sha256s
                                                                     │
 patch JSON ─────────► bundled release (reviewed, pinned)  ─────────┤
                    or user-supplied file (advanced, warned)         ▼
                                                       applyPatch()  (pure, core)
                                                                     │
                                                       verify result sha256s
                                                                     ▼
                              guided "enter bootloader" step ──► pick port ──► ident check
                                                                     ▼
                                                       flash (radio-io, per radio)
                                                         hard interlocks always on
                                                                     ▼
                                         reboot → "check Device Info shows <tag>"
```

Suggested placement, following the layer rules:

| Piece | Where |
|---|---|
| Pinned stock descriptors (version, zip and file SHA-256s, vendor URL, expected file names) | `src/core/radios/<mfr>/<model>/firmware.ts`, next to `limits.ts` (the radio's SoT) |
| Patch apply + hash checks, one per patch `name` (`anytone-d890-firmware`, `baofeng-dm32-firmware`) | `src/core/firmware/patch/`. Pure, and testable against the repos' `test_make_patch.py` cases |
| Bundled releases + index | `src/core/firmware/releases/<radio>/<tag>.patch.json` + `index.ts`. See [Releases in Studio](#releases-in-studio-rcs-and-finals) |
| Update protocol + interlocks (D890 address window and vector check; DM-32 model-ID check and length = stock) | `src/integrations/radio-io/radios/<id>/firmwareUpdate.ts`. A new `FirmwareUpdater` interface sits beside `CloneImageRadio`: `identify(pipe)`, `flash(image, {onProgress, signal})` |
| Service that ties the pipeline together | `src/app/services/firmwareFlash.ts` |
| UI | A new route, `/radio/firmware` (or a tab on the radio tools page) with a wizard. It sits outside builds: firmware is per-radio, not per-build |

Safety UX:

- An explicit "this can brick your radio" acknowledgement.
- Battery and cable declarations, carried over from the D890 `reflash_preflight.py`.
- A strong suggestion to back up the codeplug first (the existing Backup tab).
- Per-radio illustrated instructions for entering the bootloader (DM-32: **cable after power-on**).
- Keep the screen awake (Wake Lock API) and block navigation while writing.

## Proposal A — Patches bundled in Studio, stock supplied by the user (chosen)

**How it works**

- **Patches** are copied by hand from the firmware repos' GitHub releases into Studio (see the next section).
- **Stock:** the wizard shows the vendor download link (opens in a new tab) and the expected file name and size. The
  user drops the zip, or the individual files, into a file picker. Studio checks the zip hash, or the per-file hashes
  if the user extracted the files, and rejects anything else with a clear "wrong version" message.
- **Fully static:** no new backend. It works offline and in the Android app.

**Why A**

- It works with private firmware repos.
- It's the cleanest legal position: the vendor file only ever travels vendor → user → their browser.
- The patches are pinned and reviewed in Studio PRs, so it's obvious which patch built which flash.
- It has the fewest failure modes: no GitHub rate limits, no CORS surprises, and no dependency on a dealer URL.

**Costs we accept**

- A firmware release reaches users only with a Studio release. That is deliberate, and it lets us be selective.
- The user takes one extra manual step: download the stock file, then drop it in. The D890 zip is 44.5 MB because it
  includes the ICON pack.

### Releases in Studio: RCs and finals

Adding a release to Studio is a **manual, selective** step. Nothing syncs automatically.

1. Download `<radio>-fw-<tag>.patch.json` and `SHA256SUMS` from the firmware repo's release page, and check the hash.
2. Commit the patch under `src/core/firmware/releases/<radio>/<tag>.patch.json`.
3. Add an index row: `tag`, `channel: 'rc' | 'final'`, a release-notes link, the stock version it targets, and the
   patch's own sha256. The patch's `stock` and `result` hashes are read from the file.
4. A unit test re-verifies every bundled patch: the sha256 matches the index row, the format is known, the stock hashes
   match the radio's `firmware.ts`, and the segments and hooks are well formed. The test can't apply a patch, because
   there is no stock image in CI.

In the UI:

- Finals are listed by default.
- RCs appear behind a **"Show release candidates"** toggle, labelled as pre-release / for testing, with each one's
  tested-on-radio status taken from the firmware repo's release notes.
- Removing a release from Studio is a normal PR. Keep at least the latest final, so operators always have a known-good
  target.

### User-supplied patch file (advanced)

This is for flashing RCs during firmware development, before (or instead of) bundling them.

- Show it under an "Advanced" disclosure in the wizard: **"Use a patch file from disk"**.
- Before the user can continue, they must accept a risk statement. Suggested wording:
  > This patch has not been reviewed or bundled by Codeplug Studio. Studio checks that it matches your stock
  > firmware and that the result matches the hash inside the patch, but it **cannot tell whether the firmware it
  > produces is safe**. A bad patch can leave your radio unable to boot. Only use patch files you built yourself or
  > got from the firmware project's own release page.
- **These checks still apply, and can't be bypassed:** the patch format must be known; the stock hashes must match
  the pinned stock version; the result hash must match after apply; and every radio-side **hard interlock** stays on.
  - D890: the address window `0x0800C000`–`0x081E4000`, never the activation page or the bootloader; the first entry
    must load at `0x0800C000`; and the vector-table sanity check.
  - DM-32: the result must be stock length, and its model ID must equal the bootloader's ident.
- If the file's sha256 matches a bundled release, say so and treat it as that release, with no warning.
- The flash summary and any saved log record "user-supplied patch, sha256 …". That way a report of trouble shows
  where the patch came from.

### Prod availability

Studio's normal release path decides prod availability. The flasher is on in prod from the first Studio release
candidate that is promoted to prod, so it needs **no extra env gate**. It is visible on next, dev, and staging as soon as
it merges.

> Interpretation to confirm: "release candidate" here means a Studio release (pre-release → staging, then full release
> → prod), not a firmware RC.

## Proposal B — Runtime fetch (possible future direction, not planned)

**Idea:** Studio lists firmware releases at runtime from GitHub (`api.github.com/repos/pskillen/<repo>/releases`) and
offers "download for me" for the stock file. That would be a streaming, fixed-URL, hash-checked Pages Function proxy
(`functions/api/firmware/<radio>-stock.ts`), following the IRTS/RadioID pattern. The file picker stays as a fallback.
New firmware releases would reach users without a Studio deploy.

**Blockers**

1. **Legal: open firmware repos.** Making the firmware repos public, which B needs, publishes:
   - the reverse-engineering record of the vendor firmware and bootloader (decompilation notes, memory maps, protocol
     captures);
   - patches that contain small runs of stock bytes, namely the D890 hook `original` fields used as checks.

   Whether that is acceptable is an unresolved legal gray area: interoperability RE in the relevant jurisdictions,
   and the vendor EULA. That needs settling before anything else in B matters.
2. **Legal: relaying vendor firmware.** A stock-file proxy stores nothing, but it serves vendor binaries from Studio's
   domain. That is a weaker "we don't distribute" position than the user downloading the file directly.
3. **Mechanical: repo visibility.** Runtime GitHub fetches only work once the repos are public. Release-asset
   downloads redirect to `objects.githubusercontent.com`, and whether that works cross-origin is unverified. If it
   doesn't, we'd need a patch-asset proxy as well.
4. **Mechanical: a stock-file proxy is needed.** Neither vendor host sends CORS headers (verified 2026-10-21). Neither
   URL is versioned: the AnyTone zip is on a US dealer's site, and the Baofeng zip is a bare S3 object. Streaming
   44.5 MB through a Pages Function also needs confirming.
5. **Selectivity.** Runtime listing would expose every tagged release unless the firmware repos publish a curated
   index. That undoes the "we choose what ships" property of A.

**Keeping the door open:** the bundled index and the stock-file picker go behind small `FirmwareReleaseSource` and
`StockSource` interfaces, so B can be added later as another source without reworking the pipeline.

## Delivery order

1. **DM-32 first.** The protocol is a few hundred frames, the stock zip is 659 KB, and the Python sender has already
   written a real radio. "Flash stock 048" works without any patch and is a useful recovery tool on its own.
2. **D890 second.** Measure Web Serial throughput for the 52k-frame ACK loop early: spike the protocol against the
   ported mock, then do a stock-hash dry run on hardware. Treat the port vanishing at `18` as success.
3. A **"flash stock" path** for both radios as the documented way back. It's the same pipeline with no patch: the
   stock hashes are checked and the image goes to the same updater. It needs no firmware-side work on either radio.
   - **DM-32:** our sender has already written stock 048 to a real radio.
   - **D890:** our sender has written modded images (MOD, rc.2, rc.3). A stock image is the zero-change case of the
     same write. Our own sender has never written stock, though: that runbook step (S4/S5) was dropped on 2026-10-20
     because the official CPS already worked. Prove it once on hardware before calling it the recovery route. Keep
     the official CPS documented as the fallback.

## Decisions

| # | Question | Decision (2026-10-21) |
|---|---|---|
| 1 | A, B, or A then B? | **A** for the medium term. B is a possible future direction, blocked as listed above |
| 2 | Stock-download proxy? | **No** for now. The user supplies the stock file (B blocker 2) |
| 3 | Firmware repo visibility | Stays private. The legal implications haven't been considered yet (B blocker 1) |
| 4 | Prod gating | No extra gate. On in prod from the first Studio RC promoted to prod (interpretation to confirm) |
| 5 | RCs in Studio | **Yes**, behind a "Show release candidates" toggle. Adding RCs and finals is manual and selective |
| 6 | User-supplied patch | **Yes**, as an advanced option with a risk statement. The hard interlocks are never bypassed |

Optional firmware-side asks (recovery testing after an interrupted write, an app-vs-bootloader ident) were judged not
worth doing (2026-10-21). The wizard relies on the user following the bootloader-entry steps, and on the ident step
inside the update protocol.

## Tickets

Epic [#1358](https://github.com/pskillen/codeplug-studio/issues/1358) (under #594), children #1359–#1366. Filed
2026-10-21; see the epic for the dependency table.

## Next step

Hand this to the `designer` agent for `hl-delivery-plan.md`. That work should include a DESIGN.md "Firmware
flashing" section covering the no-vendor-firmware rule, user-supplied stock, bundled and user-supplied patches, and the
hard interlocks.
