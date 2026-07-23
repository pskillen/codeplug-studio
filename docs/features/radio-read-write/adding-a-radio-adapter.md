# Adding a browser radio adapter

Canonical checklist for contributors shipping a **Web Serial (or BLE) radio module** under `src/integrations/radio-io/radios/<id>/`.

Sibling concern to [adding a CPS file format](../import-export/adding-a-new-format.md): file adapters live in `src/core/import-export/formats/`; **binary protocols and clone images** live in integrations. Both ultimately feed the same operator story — **library + FormatBuild** — but radio I/O must also preserve **unmodelled radio state** so a write-back remains a valid codeplug.

**Hub:** [radio-read-write/README.md](README.md) · **Architecture:** [protocol-kit-architecture.md](protocol-kit-architecture.md) · **Epic:** [#594](https://github.com/pskillen/codeplug-studio/issues/594)

**Living doc:** append new requirements discovered while implementing adapters (UV-5R Mini [#617](https://github.com/pskillen/codeplug-studio/issues/617), OpenGD77 [#624](https://github.com/pskillen/codeplug-studio/issues/624), DM-32UV [#638](https://github.com/pskillen/codeplug-studio/issues/638), …). Prefer a dated bullet under [Discovered during implementation](#discovered-during-implementation) plus a short stable rule above when the pattern generalises.

---

## What an adapter is

| Piece                 | Owns                                                                                                                             | Must not own                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `radios/<id>/` module | Descriptor, ident/handshake, memory layout, crypt, encode/decode of modelled regions, safe write strategy, firmware string parse | React; library CRUD; `assemble`; FormatBuild mutations |
| `kit/` codecs         | Shared framing (PROGRAM+R/W, OpenGD77 serial, V-probe, …)                                                                        | Per-radio `MEM_*`, XOR tables, model idents            |
| `transport/`          | `BytePipe` (Web Serial today)                                                                                                    | Handshake or memory maps                               |
| Registry              | Descriptor list / lookup by model or compatible profile                                                                          | Framing details                                        |
| App services + UI     | Port request, progress, **FormatBuild hydration**, `assemble` → encode → upload, attribution                                     | Frame bytes, CPS column names                          |

**Dependency direction:** `app` → `core` + `integrations/radio-io`; radio modules → kit + types only. Never `core` → `integrations`.

---

## Product model (do not bypass)

```text
Library (RF semantics)  +  FormatBuild (profile, wire names, slots, layout, hydration)
                                    │
                          assemble(build, library)
                                    │
                            AssembledBuild  ──►  RadioChannelDto[]  ──►  encode into image
                                    │
                    FormatBuild hydration (unmodelled / full clone cache)
                                    │
                          merge modelled channels into image
                                    │
                              upload (full or selective)
```

| Rule                                                     | Why                                                                                                                                     |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Write always goes through a FormatBuild**              | Same bridge as CPS export — name limits, slots, exclusions, trait layout                                                                |
| **`assemble(build, library)` before encode**             | Modelled channels come from the projection, not a raw library dump                                                                      |
| **Read hydrates the FormatBuild, not the library** (MVP) | Unmodelled registers must survive; importing radio channels into the library is a separate deliverable                                  |
| **Hydration is a labelled escape hatch**                 | Same spirit as NeonPlug `FormatBuild.cpsWireHydration` for `.neonplug` donors — opaque retain of radio-safe state Studio does not model |
| **Display unmodelled settings read-only**                | Operator can see that a donor/read exists; editing those bytes in Studio is out of scope until modelled                                 |

**NeonPlug file path (already shipped):** operator reads in NeonPlug → imports `.neonplug` → Studio stores retain on `cpsWireHydration` (`formatId: 'neonplug'`) → merge export.  
**Direct Web Serial path:** create a **Direct radio** FormatBuild (`formatId: 'radio-io'`, e.g. `radio-io-uv5r-mini`) → **Read** in Studio → download clone/image → persist `cpsWireHydration` with `formatId: 'radio-clone'` (`RadioCloneHydrationBag`) → show read-only settings → **Write** merges `assemble` projection into that image → upload. No CPS ZIP/CSV on this build.

See [neonplug merge](../../reference/export-formats/neonplug/merge.md), [`CpsWireHydration`](../../../src/core/models/cpsWireHydration.ts), and [`radioCloneHydration.ts`](../../../src/core/models/radioCloneHydration.ts).

---

## Write strategies

Radios differ in how safely Studio can update them:

| Strategy              | Behaviour                                                                       | Adapter must                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Selective ranges**  | Write only modelled (or declared safe) address ranges; leave other EEPROM alone | Publish safe upload ranges; still **read/cache** first when non-channel regions must be known                                                                          |
| **Full image upload** | Radio/firmware expects a complete clone; partial write is unsafe or unsupported | Require a prior **Read** (or equivalent hydration) on the FormatBuild; encode modelled channels into the cached full image; upload the whole (or all required regions) |

Declare the strategy on the descriptor (e.g. capability flag or `writeStrategy: 'selective-ranges' | 'full-image'`). UI gates **Write** when hydration is missing for full-image radios (same UX idea as NeonPlug “donor required for radio-write download”).

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
- [ ] Hydration extract: what to persist on the FormatBuild so unmodelled state round-trips on write
- [ ] Comments cite ground-truth paths

### 4. Descriptor + registry

- [ ] `RadioDescriptor`: `modelIds`, label, group, capabilities, `attributionIds`, `protocolFactory`
- [ ] **`compatibleProfiles`**: `{ formatId, profileId }[]` so UI binds to FormatBuilds. Prefer a **Direct radio** (`radio-io`) profile for Web Serial — not a CPS file format (NeonPlug/CHIRP). CPS pathways stay file-only; adapters cite them via `attributionIds` only.
- [ ] Write-strategy / hydration-required flags for UI gating
- [ ] Register in `registry.ts`; UI picks only via registry (no `instanceof`)

### 5. App / FormatBuild integration

- [ ] **Read:** download → cache → persist hydration on **selected FormatBuild** → read-only settings view (no library channel import unless a later ticket says so)
- [ ] **Write:** require compatible FormatBuild → `assemble(build, library)` → map to radio DTOs → encode into hydrated image → upload
- [ ] Refuse write when full-image strategy lacks hydration
- [ ] In-flow attribution from `attributionIds`
- [ ] Build Export (or equivalent) hosts connect/read/write — not a library-only dump UI

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

1. Writing the radio from a bare library channel list (skips FormatBuild / `assemble`)
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

| Date       | Adapter / PR    | Discovery                                                                                                                                                                                                                                                                                                                                                |
| ---------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-23 | UV-5R Mini #617 | Binary Web Serial reads persist on `FormatBuild.cpsWireHydration` with discriminant `formatId: 'radio-clone'` (`RadioCloneHydrationBag` in `src/core/models/radioCloneHydration.ts`). Sibling to NeonPlug `formatId: 'neonplug'` file donors — same build field, different retain shape. Native YAML already accepts unknown formatIds as opaque retain. |
| 2026-07-23 | UI #618         | Export panel hosts `BuildRadioIoPanel` when `listDescriptorsForProfile` matches. NeonPlug file-donor and Web Serial `radio-clone` bags share `cpsWireHydration` — distinguish with `isNeonplugDonorBag` vs `isRadioCloneHydrationBag`.                                                                                                                   |
| 2026-07-23 | UI #618         | Web Serial binds to dedicated `formatId: 'radio-io'` FormatBuilds (e.g. `radio-io-uv5r-mini`), not NeonPlug/CHIRP CPS profiles. Export for `radio-io` is serial-only — no CPS ZIP/CSV. NeonPlug/CHIRP remain file pathways; cite protocol lineage via `attributionIds` only.                                                                             |

---

## Related

- [protocol-kit-architecture.md](protocol-kit-architecture.md)
- [adding-a-new-format.md](../import-export/adding-a-new-format.md) — CPS file sibling checklist
- [builds hub](../builds/README.md) — FormatBuild operator workflow
- [NeonPlug merge / donor](../../reference/export-formats/neonplug/merge.md) — file-path hydration precedent
- AGENTS.md — vendor boundaries
