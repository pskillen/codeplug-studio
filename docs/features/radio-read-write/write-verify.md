# Cross-session write verify

**Tracking:** [#838](https://github.com/pskillen/codeplug-studio/issues/838) · epic [#632](https://github.com/pskillen/codeplug-studio/issues/632)

Operators can confirm that bytes **actually transmitted** during a Web Serial Write landed on flash after the radio commits. The workflow is shared; compare semantics are **per-radio** on optional `writeVerify` hooks on `RadioDescriptor`.

---

## Purpose

Some radios stage writes to RAM and commit on `END` (AT-D890UV, OpenGD77 `SAVE_REBOOT`). In-session read-back shows **pre-commit flash**, so verify must run in a **new** session after restart. Other families (RT95, UV-17Pro, DM-32UV) keep the port usable without reboot — verify still reconnects in a fresh session but the progress modal skips restart-wait copy.

The app orchestration (post-write prompt, debounced **Verify write** button, progress modal, report modal, debug export) is generic; adapters supply staging capture, read-back scope, compare, and markdown formatting.

---

## Code anchors

| Layer       | Path                                                                         | Role                                                       |
| ----------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Contracts   | `src/integrations/radio-io/writeVerify.ts`                                   | `WriteVerifyResult`, hooks, JSON staging helpers           |
| Compare     | `src/integrations/radio-io/writeVerifyCompare.ts`                            | Shared staging compare + region summarize                  |
| Descriptor  | `RadioDescriptor.writeVerify` in `types.ts`                                  | Optional `WriteVerifyHooks`                                |
| Session     | `src/app/services/radioIoSession.ts`                                         | `uploadPreparedRadioWrite`, `verifyRadioWrite`             |
| Persistence | `src/app/services/writeVerifyStorage.ts`                                     | `sessionStorage` key `radioIo.writeVerify.pending`         |
| UI          | `BuildRadioIoPanel.tsx`, `WriteVerifyReport.tsx`, `RadioIoProgressModal.tsx` | Gate on `descriptor.writeVerify`; soft/hard reconnect copy |
| Adapters    | `radios/*/writeVerifyHooks.ts`                                               | Per-radio staging + compare                                |

---

## Extension pattern (new radio)

1. **Implement `WriteVerifyHooks`** on the radio descriptor:
   - `captureAfterUpload(session)` — snapshot **transmitted** staging chunks (and optional pre-upload kept regions). Never include addresses skipped at transmit.
   - `runVerify(session, pending, opts)` — cross-session read-back + compare; populate `WriteVerifyResult.regionGroups` for the report table.
   - `formatDebugMarkdown(result, context)` — agent-oriented export (full mismatch list + hints).
   - `requiresCrossSessionReconnect` — `true` when the operator must wait for radio restart before verify (D890, OpenGD77); `false` for soft reconnect (RT95, UV, DM-32).
2. **Kept snapshot opacity** — serialize adapter-specific retained bytes into `WriteVerifyKeptSnapshot` (`Record<string, unknown>`). D890 and OpenGD77 use `{ entries: [{ id, data: number[] }] }`.
3. **Compare exclusions** — document adapter-owned rules (D890: erase-unit bookkeeping; `not_read` never fabricates bytes). Prefer `writeVerifyCompare.ts` for full-image / dirty-sector adapters.
4. **No app `instanceof`** — `instanceof` for concrete protocols stays inside the adapter module only (same rule as `RadioHydrationHooks`).
5. **Storage** — generic `writeVerifyStorage` matches `buildId`, `egressId`, and **`profileId`**.

`ChannelData` writable vs verify prefix note (D890): staging may cover `0x40000` spans while verify read uses `0x4000` region chunks plus spill paths — document per-radio in tier-3 protocol docs.

---

## Operator flow

1. **Write to radio** completes; if `descriptor.writeVerify` is defined, staging (+ optional kept) snapshots persist to `sessionStorage`.
2. Progress modal shows **Verify write** after a 5s debounce. Copy depends on `requiresCrossSessionReconnect` (restart wait vs immediate reconnect prompt).
3. Operator clicks **Verify write** → new serial session → read-back compare → **Write verify report** modal.
4. **Skip verify** / close clears pending storage.

Radios without `writeVerify` skip the prompt entirely.

---

## Shipped adapters (Phase 0 + Phase 1)

| Family                 | Hooks module                         | Staging source                | Read-back                        | Reconnect |
| ---------------------- | ------------------------------------ | ----------------------------- | -------------------------------- | --------- |
| AT-D890UV              | `at-d890uv/writeVerifyHooks.ts`      | upload staging + sentinel     | modelled regions + spill         | hard      |
| RT95                   | `rt95/writeVerifyHooks.ts`           | 16 B blocks `0x0000`–`0x3290` | full `download()`                | soft      |
| UV-5R Mini / UV-21     | `uv17pro-family/writeVerifyHooks.ts` | 64 B plaintext @ radio addr   | full `download()` (decrypt)      | soft      |
| OpenGD77 1701 / MD9600 | `opengd77/writeVerifyHooks.ts`       | `collectDirtySectors`         | full `download()` + kept compare | hard      |
| DM-32UV                | `dm32uv/writeVerifyHooks.ts`         | post-remap 4 KB upload blocks | bulk read staged addresses only  | soft      |

Tier-3 protocol notes: each radio's `protocol.md` under `docs/reference/radios/`.

---

## Manual verify

1. `npm run dev` — open a build with a shipped `radio-io-*` egress.
2. Read → Write → **Verify write** → confirm report pass/fail.
3. **Hard reconnect:** D890, OpenGD77 — wait for radio UI before verify.
4. **Soft reconnect:** RT95, UV, DM-32 — verify prompt appears without restart-wait copy.
5. Grep: no `profileId === 'radio-io-*'` gate in `BuildRadioIoPanel` verify path; no adapter `instanceof` in `radioIoSession.ts`.

---

## Related

- [write-verify-platform-progress.md](write-verify-platform-progress.md)
- [WriteVerifyReport.md](../../../src/app/components/builds/WriteVerifyReport.md)
