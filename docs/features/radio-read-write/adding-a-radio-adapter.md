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
                    expandAllMxNChannels (when MxNChannelExpansion)
                                    │
                            RadioChannelDto[]  ──►  encode into image
                                    │
              Active EgressPath.hydration (unmodelled / full clone cache)
                                    │
                          merge modelled channels into image
                                    │
                              upload (full or selective)
```

| Rule                                                           | Why                                                                                                                                                                                                            |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Write always goes through a RadioBuild + egress**            | Same bridge as CPS export — name limits, slots, exclusions, trait layout; egress supplies `formatId` / `profileId` for the pathway                                                                             |
| **`assemble(build, library)` before encode**                   | Modelled channels come from the projection, not a raw library dump                                                                                                                                             |
| **Shared m×n expander when trait applies**                     | Preview, CPS export, and Web Serial write must emit the same channel fan-out ([#664](https://github.com/pskillen/codeplug-studio/issues/664) / [#665](https://github.com/pskillen/codeplug-studio/issues/665)) |
| **Read hydrates the active EgressPath, not the library** (MVP) | Unmodelled registers must survive; importing radio channels into the library is a separate deliverable                                                                                                         |
| **Hydration is a labelled escape hatch on egress**             | Same spirit as NeonPlug donor retain — opaque state Studio does not model; stored on `EgressPath.hydration` (`CpsWireHydration`)                                                                               |
| **Display unmodelled settings read-only**                      | Operator can see that a donor/read exists; editing those bytes in Studio is out of scope until modelled                                                                                                        |

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
- [ ] **`prodWriteDisabled`** when direct serial Write is not safe for production deploys — `BuildRadioIoPanel` + `prepareRadioWriteImage` gate via `__BUILD_ENV__` (`hidden` on `prod`, warn + confirm on pre-prod); prefer the radio target's CPS file egress until cleared
- [ ] Register in `registry.ts`; UI picks only via registry (no `instanceof`)

### 5. App / RadioBuild + egress integration

- [ ] **Read:** download → cache → persist hydration on the **selected Web Serial EgressPath** → read-only settings view (no library channel import unless a later ticket says so)
- [ ] **Write:** require compatible egress on the build → `assemble(build, library)` → **shared MxN expand when trait applies** → map to radio DTOs → encode into hydrated image → upload
- [ ] Do **not** import `formats/<cps>/channelExpansion.ts` from the write path — use `channelExpansion/mxnExpandAll.ts`
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

| Date       | Adapter / PR     | Discovery                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-23 | UV-5R Mini #617  | Binary Web Serial reads persist on `EgressPath.hydration` with discriminant `formatId: 'radio-clone'` (`RadioCloneHydrationBag` in `src/core/models/radioCloneHydration.ts`). Sibling to NeonPlug `formatId: 'neonplug'` file donors on a separate egress — same `CpsWireHydration` union, different retain shape. Native YAML round-trips egress hydration.                                                                                                                                      |
| 2026-07-23 | UI #618          | Export panel hosts `BuildRadioIoPanel` when the active egress is Web Serial. NeonPlug file-donor and Web Serial `radio-clone` bags share `EgressPath.hydration` — distinguish with `isNeonplugDonorBag` vs `isRadioCloneHydrationBag`.                                                                                                                                                                                                                                                            |
| 2026-07-23 | UI #618          | Web Serial binds to `formatId: 'radio-io'` on a dedicated egress (e.g. `radio-io-uv5r-mini`), not NeonPlug/CHIRP CPS egresses. Export egress switcher selects pathway; CPS ZIP/CSV remain on sibling egress children.                                                                                                                                                                                                                                                                             |
| 2026-07-23 | UI #618          | Direct radio still needs CPS-format boundary wiring for name limits: `profiles.ts` `nameLimit`, `resolveMaxNameLength`, `getProfileExportLimits`, `getFormatExportDefaults`, Export naming/scan settings, wire preview via `previewGeneratedChannelWireName`, and write-path `applyWireNameLimits` — even with no file adapter. See [adding-a-new-format.md](../import-export/adding-a-new-format.md) § registration + channel wire names.                                                        |
| 2026-07-23 | UI #618          | On read/write failure (timeout, abort, protocol error), release the Web Serial port: close pipe if `connect` fails before a session exists; UI clears the session after any failed Read/Write so the next attempt (or another process) can open the port.                                                                                                                                                                                                                                         |
| 2026-07-23 | UI #618          | Busy Read/Write uses a blocking progress modal (steps + `ProgressUpdate` bar) and `useUnsavedNavigationGuard` so operators cannot change routes or casually close the tab mid-transfer; copy warns to keep the tab open.                                                                                                                                                                                                                                                                          |
| 2026-07-23 | UI #618          | Direct radio builds get a secondary-nav **Radio image** page (`/builds/:id/radio-image`) — sibling to NeonPlug settings. Shows capture metadata, firmware, and retain summary; shallow binary decode shipped for DM-32 ([#672](https://github.com/pskillen/codeplug-studio/issues/672)) and UV-5R Mini ([#675](https://github.com/pskillen/codeplug-studio/issues/675)).                                                                                                                          |
| 2026-07-23 | DM-32UV #672     | **Radio image** for DM-32UV: on-radio entity counts; **Written from your build** manifest (channels, zones, scan lists, talk groups, RX groups, **digital** contacts, APRS); **Kept on Write** retain decode (general radio settings excluding APRS slice, emergencies, keys, messages). `dm32WriteRole` manifest in `radios/dm32uv/writeRole.ts`. Analog-contact Write gap called out in UI (#667).                                                                                              |
| 2026-07-24 | UV-5R Mini #675  | **Radio image** for UV-5R Mini: channel on-radio counts; **Written from your build** (channels only); **Kept on Write** retain groups (VFO, settings, ANI/PTT/codes); shallow settings/VFO decode. `uv5rMiniWriteRole` manifest in `radios/uv5r-mini/writeRole.ts` — documents channel-only replace contract.                                                                                                                                                                                     |
| 2026-07-24 | UV-5R Mini #695  | **Full channel-span Write:** `encodeChannelsIntoImage` clears `0…0x7CE0` to empty (`0xFF`) before encoding projected DTOs; firmware overlay at `0x1EF0` preserved; `forbidTransmit` → `rxOnly` → TX `FF×4`. Upload stays full-image so `0x8040+` retain survives.                                                                                                                                                                                                                                 |
| 2026-07-25 | UV-5R Mini #696  | **Scan bit on Write:** `buildRadioWriteProjection` stamps `scanAdd` from effective scan inclusion; `channelCodec` encodes byte `15` bit `2` (CHIRP `scan`).                                                                                                                                                                                                                                                                                                                                       |
| 2026-07-25 | UV-5R Mini #697  | **DTCS reverse polarity:** `encodeTone` / `decodeTone` use `+0x69` wire index for reverse (`DnnnI`); library parse already via `channelToneToRadioTone`.                                                                                                                                                                                                                                                                                                                                          |
| 2026-07-23 | UI #668          | Retain viewers (**NeonPlug settings** / **Radio image**) appear in secondary nav whenever the matching `EgressPath.hydration` bag exists — not only while that pathway is the active Export selection. Pages resolve the owning egress from `egressPaths`.                                                                                                                                                                                                                                        |
| 2026-07-23 | DM-32UV #638     | Sparse radios persist `RadioCloneRetain.blocks[]` (absolute addr + base64) instead of a contiguous `imageBase64`. Mini keeps contiguous image. Validators accept either shape.                                                                                                                                                                                                                                                                                                                    |
| 2026-07-23 | DM-32UV #638     | `RadioDescriptor.hydration` hooks (`extractHydration` / `mergeChannelsIntoHydration`) keep `radioIoSession` free of per-radio imports; sparse extract may read download cache from `meta.protocol`.                                                                                                                                                                                                                                                                                               |
| 2026-07-23 | DM-32UV #638     | Catalog `baofeng-dm32uv` seeds Web Serial (`radio-io-dm32uv`) ahead of NeonPlug / DM32 CSV. Prefer-NeonPlug orange alert is **Export-only** when the active egress is native DM32 CPS — not on New Radio.                                                                                                                                                                                                                                                                                         |
| 2026-07-23 | DM-32UV #638     | Write strategy `selective-ranges` with `hydrationRequiredForWrite`: upload dirty 4KB blocks only; TX-contact / settings regions survive via RMW. Zone/scan/contact address-book encode deferred — unmodelled regions left untouched.                                                                                                                                                                                                                                                              |
| 2026-07-23 | UV-5R Mini #673  | Ident/handshake: primary baud **115200** (CHIRP), one reconnect at **38400** (NeonPlug) on ident timeout/wrong ident. Post-open **300+200 ms** settle, flush RX before ident and before each magic/write, seek ACK `0x06`, sync read replies to `0x52`. Assert RTS/DTR via `setSignals` when supported.                                                                                                                                                                                           |
| 2026-07-23 | UV-5R Mini #673  | Write path must **assemble the clone image before** opening serial / program mode. Leaving the Mini in read-handshake program mode during `assemble()` lets it drop back to VFO before upload (NeonPlug calls `handshakeUpload()` immediately before block writes).                                                                                                                                                                                                                               |
| 2026-07-23 | UV-5R Mini #673  | Write connect uses **`handshake: 'none'`** (port only). `upload()` runs NeonPlug-style upload handshake (flush + ident + upload magics, **no** 300+200 ms port settle). Never read-handshake then idle before upload handshake.                                                                                                                                                                                                                                                                   |
| 2026-07-23 | DM-32UV #663     | Web Serial `port.open` must pass `bufferSize` ≫ 255 (Studio: 64 KiB). Default 255 drops / stalls 4KB block replies on macOS CDC and can reboot the radio after metadata discovery. Also apply NeonPlug `BLOCK_READ_DELAY` (150 ms) between full-block downloads.                                                                                                                                                                                                                                  |
| 2026-07-23 | DM-32UV #663     | `WebSerialBytePipe.readExact` must **park** until the buffer grows when a partial chunk is already buffered. Resolving early whenever `buf.length > 0` busy-spins the microtask queue, starves the continuous `pump()`, and stalls the first 4KB reply after metadata (radio leaves PC Program). NeonPlug pull-`read()` never hits this.                                                                                                                                                          |
| 2026-07-23 | DM-32UV #638     | Selective-range upload must **seed** sparse block addresses from prior Read hydration (`seedProtocolForUpload`) before `upload`. Connect alone leaves `cache.blocks` empty — Write then no-ops, the progress modal vanishes, and the radio drops out of PROGRAM.                                                                                                                                                                                                                                  |
| 2026-07-23 | MxN #664/#665    | Web Serial write for `MxNChannelExpansion` radios must call shared `expandAllMxNChannels` (not lean 1:1 assemble). Defaults for `radio-io-dm32uv` match CPS (`expandRxGroupLists` / scratch on). Do not import format-named `channelExpansion.ts` from the write path. Contact-table encode still deferred (#636).                                                                                                                                                                                |
| 2026-07-24 | DM-32UV #667     | Modelled Write replaces channels, zones, scan lists, talk groups, RX groups, **digital** contacts (V-frame), TX-contact indices, and APRS settings slice (`0x301`–`0x334`) from one `RadioWriteProjection`. Settings block stays mostly RMW except the APRS subsection. **Analog/DTMF contacts are not encoded** on Web Serial — UI + docs call out the gap; use CPS/NeonPlug file egress.                                                                                                        |
| 2026-07-24 | OpenGD77 #624    | OpenUV380 Write is **`full-image`** with `hydrationRequiredForWrite`: Read assembles registered FLASH spans into one contiguous map; upload writes **dirty 4KB sectors** via `'X'` (`set sector` → 32-byte buffers → `finish sector`). Baud **115200**; gate on FirmwareInfo `radioType` (`08h`/`0ah` for DM-1701/RT-84). Seed prior image before upload so unmodelled regions survive.                                                                                                           |
| 2026-07-24 | OpenGD77 #624    | OpenGD77 channels are **lean 1:1** (Contact + TG-list FKs) — **not** `MxNChannelExpansion`. Write projection must not call `expandAllMxNChannels`; talk groups encode as group contacts in the DMR contact bank. Zone-as-scan-list: stamp `skipScan` / `skipZoneScan` on channel records from scan-inclusion trait.                                                                                                                                                                               |
| 2026-07-24 | OpenGD77 #624    | **DTMF contacts** and **FM APRS systems** stay retain-only on v1 Write (parallel to DM-32 analog-contact gap). Call out on Radio image + docs; operators use OpenGD77 CPS CSV egress to change those. Shared `radios/opengd77/` family code leaves MD-9600 (#625) as a thin descriptor + power-ladder slice.                                                                                                                                                                                      |
| 2026-07-24 | DM-32UV #685     | **Full entity Write encode:** channel records encode every byte from projection + NeonPlug defaults (unmodelled emergency/encryption/PTT/signaling); unused channel slots and TX-contact entries clear to sentinels; `forbidTransmit` → `rxOnly` + aviation TX `FF×4`; digital-contact bank clears packed / trusted-span entry slots on shrink (not a huge L01 `contactsEnd`). Org banks (zones, scan, TG, RX) already full-replace; shrink tests added.                                          |
| 2026-07-24 | DM-32UV #685     | **Stale hydration guard:** before selective-range Write, re-read metadata at each seeded address. Factory reset can move ZONE/VFO/channel banks; writing the old map leaves live banks as factory demos. Error asks for a fresh Read. _(Superseded by discover+remap #703 — guard removed from upload path.)_                                                                                                                                                                                     |
| 2026-07-25 | DM-32UV #703     | **Discover + remap before Write:** every upload runs lightweight metadata discovery over the live V-frame range, remaps hydration blocks and the prepared `MemoryMap` by metadata tag onto live absolute addresses, then uploads. Refuse when a required tag is missing from the live map. Full Read is for refreshing unmodelled retain payloads — not for address refresh alone. Future V-frame siblings should reuse the same pattern.                                                         |
| 2026-07-24 | OpenGD77 #691    | **Full modelled Write encode:** hydration merge always replaces DMR contact, zone, RX group, and channel banks from `RadioWriteProjection` — no RMW of prior Read bytes inside those records. Unmodelled channel offsets (TOT, flags, APRS index, alias, lat/lon, DMR-ID override) encode to firmware-safe defaults. Settings / APRS / DTMF / VFO / additional settings stay Read-retained via full-image dirty-sector upload.                                                                    |
| 2026-07-25 | AT-D890UV #649   | Sparse **selective-ranges** adapter at **921600**: seed hydration before upload; `applyAtD890WriteImageToCache` merges projection into sparse blocks; skip-write `0x2fa0010`; inverted `TalkgroupSet`; channel `0x80` = two `0x40` halves; FK order TG→RX→radio ID→channels→zones→scan; **no** DM-32 discover+remap (fixed `D890_MAP`); `DigitalContact*` / boot images retained — CSV egress for those.                                                                                          |
| 2026-07-25 | AT-D890UV #712   | **PROGRAM exit on disconnect:** `disconnect()` must send ASCII `END` (kit `exitAnytoneDmrProgramMode`) before the pipe closes — otherwise the LCD stays on “Read data”. Export UI releases the session after a **standalone** Read or after Write completes; Write does not inline-read from the radio (hydration is from a prior Read), so no mid-flow disconnect between read and upload phases. Apply the same pattern to D878UVII (#650).                                                     |
| 2026-07-25 | AT-D890UV #714   | **Radio image write-role labels:** `D890_MAP` is non-monotonic — classify regions by each bank’s own base + stride × capacity, never by comparing one region base to an unrelated region (e.g. `TalkgroupData` vs `ReceiveGroupSet`). Broken range heuristics dumped modelled zone/TG/RX/radio-ID blocks into “Other retained region”. `LocalInfo` is the main v1 kept region.                                                                                                                    |
| 2026-07-25 | AT-D890UV #717   | **Write fidelity:** channel frequencies are BCD-as-hex digit strings in **10 Hz** units (not `hz.toString(16)`). Empty projection `radioIds` must **retain** hydrated RadioIdSet/Data (do not `clearBitmap`). Talkgroup **index stride** is `0xc8`; serial/cache I/O uses a **16-aligned span** covering each slot (odd indices are not 16-aligned). Purge TalkgroupData cache keys before re-sync so a prior wrong-stride Read cannot leak. Hardware re-check pending before calling Write safe. |
| 2026-07-25 | AT-D890UV #721   | **Talkgroup Write fidelity:** DMR IDs are BCD-as-hex decimal digit strings (same bridge as channel BCD, **no ×10**). Call type is Anytone `0/1/2` — remap NeonPlug `0x03/0x04/0x05` at the AT-D890 codec; never write `0x04` as group. Tier-3: [talkgroup-record.md](../../reference/radios/anytone/at-d890uv/talkgroup-record.md).                                                                                                                                                               |
| 2026-07-25 | Anytone DMR #646 | Kit codec `anytoneDmrRw.ts`: baud **921600** on descriptor (not in frame builders); PROGRAM→QX enter tolerates lone `0x00`; **no echo-strip** (unlike RT95 #641); 16-byte blocks with u32 BE + 8-bit checksum; safe-skip write `0x2fa0010` belongs in adapter (#649).                                                                                                                                                                                                                             |
| 2026-07-25 | OpenGD77 #692    | **Binary squelch:** analogue library `squelch` % → channel `0x37` via qDMR Global/Open/Normal/Closed scaling (`encodeOpenGd77SquelchByte`). Digital rows stay Global. **`skipScan` / `skipZoneScan`:** both bits stamped from the same scan-inclusion trait — library has no separate all-scan vs zone-scan fields (intentional).                                                                                                                                                                 |
| 2026-07-25 | UV-21Pro V2 #639 | **UV-17Pro family extract:** shared `radios/uv17pro-family/` (`Uv17ProLayout`, protocol, channel codec, hydration, retain preview). Mini is a thin layout wrapper; UV-21 adds fourth `MEM_*` region (`0x8380`, 1000 slots, `PROGRAMBFNORMALU`). Write path ships channel-span clear, TX inhibit, scan bit, and DTCS reverse from day one — not post-ship gap tickets. AM library mode not encoded on Web Serial (FM/NFM only).                                                                    |
| 2026-07-25 | AT-D890UV #741   | **`prodWriteDisabled` deploy gate:** set on the descriptor when serial Write is not production-safe. `resolveRadioWriteGate` (`radioWriteEnvGate.ts`) hides Write on `__BUILD_ENV__ === 'prod'` and shows red alert + confirm modal on pre-prod; `prepareRadioWriteImage` throws as a backstop. Read stays enabled; steer operators to the radio target's CPS file egress (Anytone CSV for AT-D890UV).                                                                                            |
| 2026-07-25 | RT95 #643        | **PROGRAM→QX @ 9600** via `programQx.ts` ([#641](https://github.com/pskillen/codeplug-studio/issues/641)): echo-strip on commands; u16 BE `0x52`/`0x57` + 16-byte blocks + checksum. Ident allow-list `RT95-P` / `V100`. Full contiguous image `0x32A0`; upload primes with read `@0x3b10`. Assemble image **before** PROGRAM; Write connect `handshake: 'none'`; `END` on disconnect ([#712](https://github.com/pskillen/codeplug-studio/issues/712) pattern). |
| 2026-07-25 | RT95 #733        | **Occupancy @ `0x1940`**, not FF-fill alone: `encodeChannelsIntoImage` clears full 200-slot span, writes DTOs, syncs occupied bits. Unused slots empty **and** bit cleared on shrink Write. `forbidTransmit` / `rxOnly` → channel byte `10` bit `7` (`tx_off`). Scan bitfield @ `0x1960` stamped from `scanAdd` on DTO ([#734](https://github.com/pskillen/codeplug-studio/issues/734) projection). |

---

## Related

- [protocol-kit-architecture.md](protocol-kit-architecture.md)
- [adding-a-new-format.md](../import-export/adding-a-new-format.md) — CPS file sibling checklist
- [builds hub](../builds/README.md) — RadioBuild + EgressPath operator workflow
- [NeonPlug merge / donor](../../reference/export-formats/neonplug/merge.md) — file-path hydration precedent
- AGENTS.md — vendor boundaries
