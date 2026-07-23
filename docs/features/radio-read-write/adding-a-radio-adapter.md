# Adding a browser radio adapter

Canonical checklist for contributors shipping a **Web Serial (or BLE) radio module** under `src/integrations/radio-io/radios/<id>/`.

Sibling concern to [adding a CPS file format](../import-export/adding-a-new-format.md): file adapters live in `src/core/import-export/formats/`; **binary protocols and clone images** live in integrations. Both ultimately feed the same operator story — **library + RadioBuild + active EgressPath** — but radio I/O must also preserve **unmodelled radio state** so a write-back remains a valid codeplug.

**Hub:** [radio-read-write/README.md](README.md) · **Architecture:** [protocol-kit-architecture.md](protocol-kit-architecture.md) · **Epic:** [#594](https://github.com/pskillen/codeplug-studio/issues/594)

**Living doc:** append new requirements discovered while implementing adapters (UV-5R Mini [#617](https://github.com/pskillen/codeplug-studio/issues/617), OpenGD77 [#624](https://github.com/pskillen/codeplug-studio/issues/624), DM-32UV [#638](https://github.com/pskillen/codeplug-studio/issues/638), …). Prefer a dated bullet under [Discovered during implementation](#discovered-during-implementation) plus a short stable rule above when the pattern generalises.

---

## What an adapter is

| Piece                 | Owns                                                                                                                             | Must not own                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `radios/<id>/` module | Descriptor, ident/handshake, memory layout, crypt, encode/decode of modelled regions, safe write strategy, firmware string parse | React; library CRUD; `assemble`; `RadioBuild` mutations |
| `kit/` codecs         | Shared framing (PROGRAM+R/W, OpenGD77 serial, V-probe, …)                                                                        | Per-radio `MEM_*`, XOR tables, model idents             |
| `transport/`          | `BytePipe` (Web Serial today)                                                                                                    | Handshake or memory maps                                |
| Registry              | Descriptor list / lookup by model or compatible profile                                                                          | Framing details                                         |
| App services + UI     | Port request, progress, **egress hydration**, `assemble` → encode → upload, attribution                                          | Frame bytes, CPS column names                           |

**Dependency direction:** `app` → `core` + `integrations/radio-io`; radio modules → kit + types only. Never `core` → `integrations`.

---

## Product model (do not bypass)

```text
Library (RF semantics)  +  RadioBuild (wire names, slots, trait layout)
                                    │
                          assemble(radioBuild, library)
                                    │
                            AssembledBuild  ──►  RadioChannelDto[]  ──►  encode into image
                                    │
              Active EgressPath.hydration (unmodelled / full clone cache)
                                    │
                          merge modelled channels into image
                                    │
                              upload (full or selective)
```

| Rule                                                           | Why                                                                                                                                |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Write always goes through a RadioBuild + egress**            | Same bridge as CPS export — name limits, slots, exclusions, trait layout; egress supplies `formatId` / `profileId` for the pathway |
| **`assemble(build, library)` before encode**                   | Modelled channels come from the projection, not a raw library dump                                                                 |
| **Read hydrates the active EgressPath, not the library** (MVP) | Unmodelled registers must survive; importing radio channels into the library is a separate deliverable                             |
| **Hydration is a labelled escape hatch on egress**             | Same spirit as NeonPlug donor retain — opaque state Studio does not model; stored on `EgressPath.hydration` (`CpsWireHydration`)   |
| **Display unmodelled settings read-only**                      | Operator can see that a donor/read exists; editing those bytes in Studio is out of scope until modelled                            |

**NeonPlug file path (shipped):** operator imports `.neonplug` on the NeonPlug **egress** → Studio stores retain on `EgressPath.hydration` (`formatId: 'neonplug'`) → merge export through that egress.  
**Direct Web Serial path:** pick the **Web Serial** egress on a catalog target that includes `radio-io` (e.g. UV-5R Mini) → **Read** in Studio → persist `EgressPath.hydration` with `formatId: 'radio-clone'` (`RadioCloneHydrationBag`) → show read-only settings on **Radio image** → **Write** merges `assemble` projection into that image → upload. CPS file egresses on the same build remain separate children.

See [neonplug merge](../../reference/export-formats/neonplug/merge.md), [`CpsWireHydration`](../../../src/core/models/cpsWireHydration.ts), and [`radioCloneHydration.ts`](../../../src/core/models/radioCloneHydration.ts).

---

## Write strategies

Radios differ in how safely Studio can update them:

| Strategy              | Behaviour                                                                       | Adapter must                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Selective ranges**  | Write only modelled (or declared safe) address ranges; leave other EEPROM alone | Publish safe upload ranges; still **read/cache** first when non-channel regions must be known                                                                          |
| **Full image upload** | Radio/firmware expects a complete clone; partial write is unsafe or unsupported | Require a prior **Read** (or equivalent hydration) on the FormatBuild; encode modelled channels into the cached full image; upload the whole (or all required regions) |

Declare the strategy on the descriptor (e.g. capability flag or `writeStrategy: 'selective-ranges' | 'full-image'`). UI gates **Write** when hydration is missing on the active Web Serial **egress** (same UX idea as NeonPlug “donor required for radio-write download”).

UV-5R Mini (PROGRAM+R/W): treat as **read-cached image + encode channels + upload safe/full regions** — follow NeonPlug/CHIRP practice (cache full `0x8240` image so settings/VFO/ANI survive). Exact range list belongs in the radio module + tier-3 docs.

---

## Checklist — new radio adapter

### 1. Tier-3 radio reference (before or with code)

- [ ] Home under `docs/reference/radios/<mfr>/<model>/` (protocol, memory layout, channel record, fixtures notes)
- [ ] Explicit: CPS CSV / `.neonplug` wire ≠ binary clone image
- [ ] Attribution sources listed (CHIRP / NeonPlug / qdmr / …) — cite paths; **do not** paste GPL sources
- [ ] Fixture recipe for synthetic images (no personal dumps in git)

### 2. Kit codec (only if framing is new)

- [ ] Reuse an existing `kit/codecs/*` surface when possible (PROGRAM+R/W, OpenGD77 serial, V-probe, …)
- [ ] New family → new sibling module — do **not** stretch Mini `BlockCodec` into unrelated families
- [ ] Kit stays free of radio idents, XOR tables, and `MEM_*` layouts

### 3. Radio module (`src/integrations/radio-io/radios/<id>/`)

- [ ] `constants` / layout from tier-3
- [ ] Handshake / ident (wrong-ident → typed error)
- [ ] Download → assembled `MemoryMap` (or sparse equivalent) with progress + `AbortSignal`
- [ ] Upload with declared write strategy; progress + abort
- [ ] Channel (and later contacts/zones) encode/decode for **modelled** regions only
- [ ] Firmware string parse (for future catalog gate [#619](https://github.com/pskillen/codeplug-studio/issues/619))
- [ ] Hydration extract: what to persist on the **active EgressPath** so unmodelled state round-trips on write
- [ ] Comments cite ground-truth paths

### 4. Descriptor + registry

- [ ] `RadioDescriptor`: `modelIds`, label, group, capabilities, `attributionIds`, `protocolFactory`
- [ ] **`compatibleProfiles`**: `{ formatId, profileId }[]` so UI binds egress pathways to catalog targets. Prefer a **Direct radio** (`radio-io`) profile for Web Serial — not a CPS file format (NeonPlug/CHIRP). CPS pathways are separate `EgressPath` children; adapters cite protocol lineage via `attributionIds` only.
- [ ] For Direct radio profiles: still wire `nameLimit` / `resolveMaxNameLength` / `getProfileExportLimits` / Export naming settings (same as [adding-a-new-format.md](../import-export/adding-a-new-format.md) channel wire-name checklist) — serial write uses them even without a CPS adapter
- [ ] On failed connect/read/write: always close `BytePipe` / clear UI session so the OS port is not held
- [ ] Write-strategy / hydration-required flags for UI gating
- [ ] Register in `registry.ts`; UI picks only via registry (no `instanceof`)

### 5. App / RadioBuild + egress integration

- [ ] **Read:** download → cache → persist hydration on the **selected Web Serial EgressPath** → read-only settings view (no library channel import unless a later ticket says so)
- [ ] **Write:** require compatible egress on the build → `assemble(build, library)` → map to radio DTOs → encode into hydrated image → upload
- [ ] Refuse write when full-image strategy lacks egress hydration
- [ ] In-flow attribution from `attributionIds`
- [ ] Build Export hosts egress switcher + connect/read/write for Web Serial — not a library-only dump UI

### 6. Tests

- [ ] Codec / layout: directional fixture tests (bytes → fields; fields → bytes)
- [ ] Mocked `BytePipe`: handshake, download assemble, upload frames/ACKs
- [ ] App services: hydration persist + assemble→encode path (fake radio)
- [ ] No React in `integrations/radio-io/`; no frame bytes in `src/app/`
- [ ] No personal codeplug dumps in the repo

### 7. Documentation deliverables

- [ ] Update [radio-read-write hub](README.md) status
- [ ] Progress / outstanding for epic #594 when behaviour ships
- [ ] Tier-3 link “Studio module” → implemented path
- [ ] **Update this file** with any new cross-radio requirements discovered
- [ ] Component sidecars for new shared UI widgets

---

## Anti-patterns

1. Writing the radio from a bare library channel list (skips RadioBuild / `assemble`)
2. Importing radio channels into the library as a side effect of “preserve settings” read (unless explicitly scoped)
3. Stashing modelled channel wire in hydration and replaying instead of `assemble` (see [export-from-model](../../../.cursor/rules/export-from-model.mdc))
4. Putting binary protocol or `MEM_*` in `src/core/` models or library CRUD
5. God protocol class mixing port UX, handshake, parse, and diagnostics
6. App `instanceof` concrete radios — gate on capabilities / descriptor fields
7. Forcing one codec shape (e.g. V-probe+4KB) into the generic kit for every radio
8. Committing live radio dumps or operator callsigns as fixtures

---

## Discovered during implementation

Append here as adapters ship. Keep entries short; promote repeated patterns into the sections above.

| Date       | Adapter / PR    | Discovery                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-07-23 | UV-5R Mini #617 | Binary Web Serial reads persist on `EgressPath.hydration` with discriminant `formatId: 'radio-clone'` (`RadioCloneHydrationBag` in `src/core/models/radioCloneHydration.ts`). Sibling to NeonPlug `formatId: 'neonplug'` file donors on a separate egress — same `CpsWireHydration` union, different retain shape. Native YAML round-trips egress hydration.                                                                               |
| 2026-07-23 | UI #618         | Export panel hosts `BuildRadioIoPanel` when the active egress is Web Serial. NeonPlug file-donor and Web Serial `radio-clone` bags share `EgressPath.hydration` — distinguish with `isNeonplugDonorBag` vs `isRadioCloneHydrationBag`.                                                                                                                                                                                                     |
| 2026-07-23 | UI #618         | Web Serial binds to `formatId: 'radio-io'` on a dedicated egress (e.g. `radio-io-uv5r-mini`), not NeonPlug/CHIRP CPS egresses. Export egress switcher selects pathway; CPS ZIP/CSV remain on sibling egress children.                                                                                                                                                                                                                      |
| 2026-07-23 | UI #618         | Direct radio still needs CPS-format boundary wiring for name limits: `profiles.ts` `nameLimit`, `resolveMaxNameLength`, `getProfileExportLimits`, `getFormatExportDefaults`, Export naming/scan settings, wire preview via `previewGeneratedChannelWireName`, and write-path `applyWireNameLimits` — even with no file adapter. See [adding-a-new-format.md](../import-export/adding-a-new-format.md) § registration + channel wire names. |
| 2026-07-23 | UI #618         | On read/write failure (timeout, abort, protocol error), release the Web Serial port: close pipe if `connect` fails before a session exists; UI clears the session after any failed Read/Write so the next attempt (or another process) can open the port.                                                                                                                                                                                  |
| 2026-07-23 | UI #618         | Busy Read/Write uses a blocking progress modal (steps + `ProgressUpdate` bar) and `useUnsavedNavigationGuard` so operators cannot change routes or casually close the tab mid-transfer; copy warns to keep the tab open.                                                                                                                                                                                                                   |
| 2026-07-23 | UI #618         | Direct radio builds get a secondary-nav **Radio image** page (`/builds/:id/radio-image`) — sibling to NeonPlug settings. Shows capture metadata, firmware, occupied-channel decode, and opaque retained regions (VFO/settings/ANI); labelled settings enums from binary remain future work.                                                                                                                                                |
| 2026-07-23 | DM-32UV #638    | Sparse radios persist `RadioCloneRetain.blocks[]` (absolute addr + base64) instead of a contiguous `imageBase64`. Mini keeps contiguous image. Validators accept either shape.                                                                                                                                                                                                                                                             |
| 2026-07-23 | DM-32UV #638    | `RadioDescriptor.hydration` hooks (`extractHydration` / `mergeChannelsIntoHydration`) keep `radioIoSession` free of per-radio imports; sparse extract may read download cache from `meta.protocol`.                                                                                                                                                                                                                                        |
| 2026-07-23 | DM-32UV #638    | Catalog `baofeng-dm32uv` seeds Web Serial (`radio-io-dm32uv`) ahead of NeonPlug / DM32 CSV. Prefer-NeonPlug orange alert is **Export-only** when the active egress is native DM32 CPS — not on New Radio.                                                                                                                                                                                                                                  |
| 2026-07-23 | DM-32UV #638    | Write strategy `selective-ranges` with `hydrationRequiredForWrite`: upload dirty 4KB blocks only; TX-contact / settings regions survive via RMW. Zone/scan/contact address-book encode deferred — unmodelled regions left untouched.                                                                                                                                                                                                       |
| 2026-07-23 | DM-32UV #663    | Web Serial `port.open` must pass `bufferSize` ≫ 255 (Studio: 64 KiB). Default 255 drops / stalls 4KB block replies on macOS CDC and can reboot the radio after metadata discovery. Also apply NeonPlug `BLOCK_READ_DELAY` (150 ms) between full-block downloads.                                                                                                                                                                           |

---

## Related

- [protocol-kit-architecture.md](protocol-kit-architecture.md)
- [adding-a-new-format.md](../import-export/adding-a-new-format.md) — CPS file sibling checklist
- [builds hub](../builds/README.md) — RadioBuild + EgressPath operator workflow
- [NeonPlug merge / donor](../../reference/export-formats/neonplug/merge.md) — file-path hydration precedent
- AGENTS.md — vendor boundaries
