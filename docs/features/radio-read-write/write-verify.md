# Cross-session write verify

**Tracking:** [#838](https://github.com/pskillen/codeplug-studio/issues/838) · epic [#632](https://github.com/pskillen/codeplug-studio/issues/632)

Operators can confirm that bytes **actually transmitted** during a Web Serial Write landed on flash after the radio commits. The workflow is shared; compare semantics are **per-radio** on optional `writeVerify` hooks on `RadioDescriptor`.

---

## Purpose

Some radios stage writes to RAM and commit on `END` (AT-D890UV). In-session read-back shows **pre-commit flash**, so verify must run in a **new** session after restart. The app orchestration (post-write prompt, debounced **Verify write** button, progress modal, report modal, debug export) is generic; adapters supply staging capture, read-back scope, compare, and markdown formatting.

D890 reference behaviour shipped in [#837](https://github.com/pskillen/codeplug-studio/issues/837); this document describes the **neutral platform** ([#838](https://github.com/pskillen/codeplug-studio/issues/838)).

---

## Code anchors

| Layer        | Path                                                                         | Role                                                         |
| ------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Contracts    | `src/integrations/radio-io/writeVerify.ts`                                   | `WriteVerifyResult`, hooks, JSON staging helpers             |
| Descriptor   | `RadioDescriptor.writeVerify` in `types.ts`                                  | Optional `WriteVerifyHooks`                                  |
| Session      | `src/app/services/radioIoSession.ts`                                         | `uploadPreparedRadioWrite`, `verifyRadioWrite`               |
| Persistence  | `src/app/services/writeVerifyStorage.ts`                                     | `sessionStorage` key `radioIo.writeVerify.pending`           |
| UI           | `BuildRadioIoPanel.tsx`, `WriteVerifyReport.tsx`, `RadioIoProgressModal.tsx` | Gate on `descriptor.writeVerify`; report from neutral result |
| D890 adapter | `radios/at-d890uv/writeVerifyHooks.ts`                                       | Maps D890 compare engine ↔ neutral types                     |

---

## Extension pattern (new radio)

1. **Implement `WriteVerifyHooks`** on the radio descriptor:
   - `captureAfterUpload(session)` — snapshot **transmitted** staging chunks (and optional pre-upload kept regions). Never include addresses skipped at transmit.
   - `runVerify(session, pending, opts)` — cross-session read-back + compare; populate `WriteVerifyResult.regionGroups` for the report table.
   - `formatDebugMarkdown(result, context)` — agent-oriented export (full mismatch list + hints).
   - `requiresCrossSessionReconnect` — `true` when the operator must reconnect after radio restart (D890).
2. **Kept snapshot opacity** — serialize adapter-specific retained bytes into `WriteVerifyKeptSnapshot` (`Record<string, unknown>`). D890 uses `{ entries: [{ id, data: number[] }] }` via `serializeAtD890KeptSnapshot`.
3. **Compare exclusions** — document adapter-owned rules (D890: erase-unit bookkeeping outside modelled banks; `not_read` never fabricates bytes).
4. **No app `instanceof`** — `instanceof` for concrete protocols stays inside the adapter module only (same rule as `RadioHydrationHooks`).
5. **Storage** — generic `writeVerifyStorage` matches `buildId`, `egressId`, and **`profileId`**.

`ChannelData` writable vs verify prefix note (D890): staging may cover `0x40000` spans while verify read uses `0x4000` region chunks plus spill paths — document per-radio in tier-3 protocol docs.

---

## Operator flow

1. **Write to radio** completes; if `descriptor.writeVerify` is defined, staging (+ optional kept) snapshots persist to `sessionStorage`.
2. Progress modal shows **Verify write** after debounce (radio may restart).
3. Operator clicks **Verify write** → new serial session → read-back compare → **Write verify report** modal.
4. **Skip verify** / close clears pending storage.

Radios without `writeVerify` skip the prompt entirely.

---

## Phase 1 adapters (not in Phase 0)

Tracked on [#838](https://github.com/pskillen/codeplug-studio/issues/838):

| Family                 | Staging source               | Read-back                    | Notes                          |
| ---------------------- | ---------------------------- | ---------------------------- | ------------------------------ |
| DM-32UV                | 4 KB blocks from upload loop | discover + bulk read + spill | Closest to D890 sparse RMW     |
| OpenGD77 1701 / MD9600 | `collectDirtySectors`        | full `download()`            | Shared protocol; reboot at end |
| UV-5R Mini / UV-21     | every clone block written    | full `download()`            | `uv17pro-family` layouts       |
| RT95                   | fixed block range            | full `download()`            | CHIRP-style clone              |

---

## Manual verify (D890)

1. `npm run dev` — build with `radio-io-at-d890uv` egress.
2. Read → Write → wait for radio UI → **Verify write** → confirm report pass/fail matches pre-platform behaviour.
3. Grep: no `radio-io-at-d890uv` gate in `BuildRadioIoPanel` verify path; no `instanceof AtD890uvProtocol` in `radioIoSession.ts`.

---

## Related

- [write-verify-platform-progress.md](write-verify-platform-progress.md)
- [WriteVerifyReport.md](../../../src/app/components/builds/WriteVerifyReport.md)
- [AT-D890UV protocol (tier 3)](../../reference/radios/anytone/at-d890uv/protocol.md)
