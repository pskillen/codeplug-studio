# Modded firmware flasher: high-level delivery plan

**Status:** design under review. Tickets already exist (epic [#1358](https://github.com/pskillen/codeplug-studio/issues/1358),
children #1359 to #1366). This doc is the design gate named in #1359. It does not file, edit or split tickets: mismatches
are listed in [Ticket alignment](#ticket-alignment-1359-to-1366).
**Source:** [README.md](README.md) (investigation and decisions #1 to #6, 2026-10-21) and [findings.md](findings.md).
Firmware repos read at `anytone-d890-firmware@f018b28` and `baofeng-dm32-firmware@be3101a`.
**Parent epic:** [#594](https://github.com/pskillen/codeplug-studio/issues/594) Browser radio I/O. **Related:**
[#1312](https://github.com/pskillen/codeplug-studio/issues/1312) MM9PDY codeplug targets (shipped).

Decisions taken as given, not re-opened: **Proposal A** (patches bundled in Studio, stock supplied by the user); no
stock proxy; firmware repos stay private; no extra env gate; RCs behind a toggle; user-supplied patch as an advanced
option. Proposal B is described only as a future direction (Appendix A, and the seams in section 3.6).

---

## Problem

An operator who wants the MM9PDY modded firmware on an AT-D890UV or DM-32UV today has to:

1. clone a private firmware repo;
2. run `fw/make_patch.py apply` by hand;
3. send the result with a Python sender (`tools/d890update.py`, `tools/flash/dm32_fw_send.py`) or the Windows-only vendor
   CPS.

Studio already writes codeplugs for the MM9PDY targets (`anytone-at-d890uv-mm9pdy`, `baofeng-dm32uv-mm9pdy`,
[docs/features/modded-firmware/README.md](../../../docs/features/modded-firmware/README.md)). It cannot put the firmware those
targets need onto the radio.

What is missing in the code:

- **No firmware seam.** Every radio-io contract in `src/integrations/radio-io/types.ts` is codeplug-shaped.
  `CloneImageRadio` is `connect` → `download(): MemoryMap` → `upload(MemoryMap)`, plus channel encode and decode. A
  bootloader update has no memory map, no download, and a different session: it is a one-way, precomputed frame stream
  with a destructive point part-way through.
- **No firmware model in core.** `src/core/radios/<mfr>/<model>/` holds only `limits.ts` and capability helpers. Nothing
  pins a stock firmware version, hash or file set. There is no patch format, no SHA-256 helper in core, and no release
  catalog. The only SHA-256 calls are `crypto.subtle.digest` in
  `src/integrations/radio-io/radios/dm32uv/calibrationDecode.ts:246` and `src/integrations/cloud/pkce.ts:16`.
- **Port picking can't target a bootloader.** `requestWebSerialPort()` (`src/integrations/radio-io/transport/webSerialPipe.ts:210-226`)
  takes no USB filters. Unless `forceSelection` is set, it reuses `getPorts()[0]`. On Android,
  `requestCapacitorSerialPort()` (`capacitorSerialPipe.ts`, the `devices[0]` fallback) takes the first device, and the
  plugin surface (`UsbSerialPluginLike`) has no DTR/RTS control. The DM-32 bootloader dialect raises DTR and RTS
  (`dm32_fw_send.py` `SerialPipe`).
- **DESIGN.md says nothing about firmware.** It describes Studio as a codeplug designer that "does not replace vendor
  CPS" (DESIGN.md "What this is", "Non-goals"). Writing program flash, and the rule that Studio never carries vendor
  firmware, are new scope with no written rules.
- **No wake lock exists, and no flow keeps the tab alive** for a multi-minute, timing-sensitive transfer.
  `useUnsavedNavigationGuard` (`src/app/hooks/useUnsavedNavigationGuard.ts`) already blocks navigation and `beforeunload`,
  and `RadioIoProgressModal.md` asks callers to pair with it. Neither keeps the screen awake.

## Goal

When this epic is done, these hold:

1. **No vendor bytes in Studio.** No vendor firmware file, image or excerpt is in the repo, the bundle, a test fixture,
   or any network path Studio controls. Stock firmware only ever travels vendor → user → that user's browser tab.
   (Release patches carry a few stock bytes inside hook and segment data; see [OQ1](#open-questions).)
2. **Every byte sent to a bootloader is derived from hash-verified inputs.** The stock files match pinned SHA-256s and
   sizes. Then, if a patch is used, the patch's own stock hashes match the pinned ones and the patched result matches
   the patch's result hashes. Nothing else reaches an updater.
3. **Radio-side hard interlocks are non-bypassable.** They are code, not configuration. Each updater checks them on the
   prepared image before the user enters the bootloader, and again inside `flash()` before the first byte. No UI
   control, flag, env value or patch field can turn one off.
4. **One pipeline, three targets.** Bundled release, user-supplied patch, and stock all go through the same
   `prepareFirmwareImage` → `FirmwareUpdater.flash` path. "Flash stock" is the zero-patch case, not a separate code path.
5. **Layer rules hold:**
   - Radio facts live next to `limits.ts`.
   - Patch formats are pure core modules, one per patch `name`.
   - Bootloader protocols live in `integrations/radio-io/radios/<id>/`.
   - The app holds only the wizard and a thin orchestration service.
   - The app has no radio literals, USB IDs or wire bytes.
6. **Proposal B can be added without reworking the pipeline.** It would add one more `FirmwareReleaseSource` and one
   more `StockSource`; neither changes the interfaces.

---

## Vocabulary

The brainstorm, the firmware repos and Studio use overlapping words. These are the terms used from here on. The
reasons matter because two of the words already mean something else in Studio.

| Term                                   | Meaning here                                                                                                                                                                                                                | Why this word                                                                                                                                                                                                                                                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Flash** (verb)                       | Write a firmware image into a radio's program flash through its bootloader                                                                                                                                                  | Studio already uses **Write** for codeplug writes (`writeBuildToRadio`, "Write radio" modal). Keeping the two words apart stops "Write" UI, gates or docs being read as applying to firmware, or the reverse                                                                                                          |
| **Stock firmware**                     | The vendor's firmware file set for one pinned version (DM-32UV: one `.bin`; AT-D890UV: `.CDD` + `.CDI` + `.spi`)                                                                                                            | Firmware repos say "stock". "Vendor firmware" is kept for the rule ("never ship vendor firmware")                                                                                                                                                                                                                    |
| **Firmware package**                   | The set of files that make one flashable image, keyed by **member role** (`bin`; `cdd` / `cdi` / `spi`). Both stock and patched results are packages                                                                   | The AT-D890UV image is three files, so "image" alone misleads. Role keys come from the radio's `firmware.ts`, so generic code never names `.CDD`                                                                                                                                                                       |
| **Firmware release**                   | One tagged firmware-repo release (`1.0.0`, `1.0.0-rc.3`), shipped as a **release patch** (`<radio>-fw-<tag>.patch.json`)                                                                                               | "Release" is also a Studio release (staging/prod). Always write **firmware release** or **Studio release** in prose; that is what [OQ2](#open-questions) is about                                                                                                                                                    |
| **Patch format**                       | The JSON schema identified by the patch's `name` + `format` (`baofeng-dm32-firmware` / `anytone-d890-firmware`, both format `1`)                                                                                         | Treated like an import format: a boundary format with its own module                                                                                                                                                                                                                                                  |
| **Bundled release / user patch**       | A firmware release whose patch file is committed to Studio and listed in the index, versus a `.patch.json` the user picks from disk                                                                                      | Matches the decisions table                                                                                                                                                                                                                                                                                           |
| **Provenance**                         | `stock` / `bundled` / `unreviewed`, recorded on every prepared image and in the flash summary                                                                                                                              | A user patch whose sha256 equals a bundled one becomes `bundled`                                                                                                                                                                                                                                                      |
| **Hard interlock**                     | A radio-side safety refusal enforced by the updater before any byte is sent. Not configurable                                                                                                                              | Avoids **gate**: Studio already has `radioWriteEnvGate` (deploy env), and the firmware repos use "gate" for their emulator gate (`gate-result.json`). Using "gate" here would collide with both                                                                                                                       |
| **Bootloader / update mode**           | The radio's firmware-update mode (DM-32UV: SK1+PTT at power-on, green LED; AT-D890UV: PTT+PF3, blinking red LED)                                                                                                            | The firmware repos' user docs say "update mode"; the protocol docs say "bootloader". UI copy says **update mode**; code says `bootloader`                                                                                                                                                                             |
| **`FirmwareRadioId`**                  | `'baofeng-dm32uv' \| 'anytone-at-d890uv'`                                                                                                                                                                                 | Reuses the stock **radio target** ids from `src/core/radio-targets/catalog.ts` (`id: 'baofeng-dm32uv'`, `id: 'anytone-at-d890uv'`). Firmware belongs to the hardware, not to a build or a radio target, but the stock target id is already core's stable name for the hardware. The radio-io dir ids (`dm32uv`, `at-d890uv`) are integration-internal. See [OQ8](#open-questions) |

---

## Proposed model

### 3.0 Pipeline and layer placement

```text
             core (pure, no I/O)                                 integrations/radio-io             app (thin)
 ┌───────────────────────────────────────────────────┐      ┌───────────────────────────┐   ┌──────────────────────────┐
 │ radios/<mfr>/<model>/firmware.ts  (pinned stock)  │      │ firmware/types.ts         │   │ routes/firmware/         │
 │ firmware/stock     resolveStockFirmware()          │──┐   │   FirmwareUpdater          │   │   FirmwareFlasherPage    │
 │ firmware/patch     parse + apply (per patch name)  │  │   │ firmware/registry.ts      │   │ services/firmwareFlash.ts│
 │ firmware/releases  bundled index + sources         │  ├──►│ radios/dm32uv/firmwareUpdate/   │◄──│   prepare → grant port → │
 │ services/firmware  prepareFirmwareImage()          │──┘   │ radios/at-d890uv/firmwareUpdate/│   │   identify → flash       │
 └───────────────────────────────────────────────────┘      │ transport (BytePipe)      │   │ hooks/useScreenWakeLock  │
                                                            └───────────────────────────┘   └──────────────────────────┘
```

| Piece                                                                              | Where                                                                    | Depends on                         |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------- |
| Pinned stock descriptor, bootloader-entry facts, post-flash verify hint            | `src/core/radios/<mfr>/<model>/firmware.ts` (next to `limits.ts`)        | `src/core/firmware/types.ts`       |
| Firmware types, hash and hex helpers, errors                                       | `src/core/firmware/`                                                     | nothing (Web Crypto, see 3.1)      |
| Stock resolution (zip or extracted files) + `StockSource`                          | `src/core/firmware/stock/`                                               | `fflate` (already used in core)    |
| Patch formats, one module per patch `name`                                         | `src/core/firmware/patch/formats/<patch-name>/`                          | core only                          |
| Bundled releases, index, `FirmwareReleaseSource`s                                  | `src/core/firmware/releases/`                                            | core only                          |
| `prepareFirmwareImage` application service                                         | `src/core/services/firmware/prepareFirmwareImage.ts`                     | all of the above                   |
| `FirmwareUpdater` interface, registry, guarded send, firmware errors               | `src/integrations/radio-io/firmware/`                                    | `@core/firmware`, `radio-io/kit`   |
| DM-32UV bootloader updater                                                         | `src/integrations/radio-io/radios/dm32uv/firmwareUpdate/`                | the above + core `firmware.ts`     |
| AT-D890UV bootloader updater                                                       | `src/integrations/radio-io/radios/at-d890uv/firmwareUpdate/`             | the above + core `firmware.ts`     |
| Orchestration (port grant with filters, open, identify, flash, close, summary)     | `src/app/services/firmwareFlash.ts`                                      | core service + integrations        |
| Wizard route, step components, wake-lock hook                                      | `src/app/routes/firmware/`, `src/app/hooks/useScreenWakeLock.ts`         | app service                        |

Dependency direction stays `app → core`, `app → integrations`, `integrations → core`. Core never imports
integrations. That is why the updater interface lives in integrations, and the image it consumes is defined in core.

### 3.1 Core firmware types (`src/core/firmware/types.ts`)

```ts
export type FirmwareRadioId = 'baofeng-dm32uv' | 'anytone-at-d890uv';

/** A file the user gave us (or, later, a remote source fetched). Name is the basename only. */
export interface NamedBytes {
  readonly name: string;
  readonly bytes: Uint8Array;
}

/** One member of a stock firmware set, e.g. the DM-32UV `.bin`, or the D890 `.CDD`. */
export interface StockFirmwareMember {
  /** Stable role key used by patch formats and updaters. Declared per radio; generic code never hard-codes one. */
  readonly role: string;
  readonly fileName: string;
  readonly size: number;
  readonly sha256: string;
}

export interface StockFirmwareDescriptor {
  readonly radioId: FirmwareRadioId;
  readonly label: string; // 'Baofeng DM-32UV'
  readonly version: string; // 'v1.01.048'
  /** Shown as a link only. Never fetched by Studio code (Proposal A). */
  readonly vendorDownload: { readonly url: string; readonly host: string; readonly note?: string };
  /** The vendor zip as published. Hash is diagnostic; member hashes are authoritative (OQ5). */
  readonly zip: { readonly fileName: string; readonly sha256: string };
  readonly members: readonly StockFirmwareMember[];
  /** Patch `name` values whose releases apply to this radio. */
  readonly patchNames: readonly string[];
  /** Human-facing update-mode entry, rendered generically by the wizard. */
  readonly bootloaderEntry: {
    readonly steps: readonly string[];
    readonly indicator: string; // 'Green LED' / 'Red LED blinking, screen blank'
    readonly warnings: readonly string[];
  };
  /** How the operator confirms stock is running after a flash. */
  readonly stockVerifyHint: string;
}

/** Result bytes keyed by member role. Stock and patched packages share this shape. */
export interface FirmwarePackage {
  readonly radioId: FirmwareRadioId;
  readonly files: Readonly<Record<string, Uint8Array>>;
}

export type FirmwareProvenance = 'stock' | 'bundled' | 'unreviewed';
```

SHA-256 helper, `src/core/firmware/hash.ts`:
`sha256Hex(bytes: Uint8Array): Promise<string>`, using `globalThis.crypto.subtle.digest`. Web Crypto is a platform API
available in browsers, the Capacitor WebView and Node 22 (`node -v` here: v22.22.0). It is not DOM, so it is allowed
in core. Vitest already exercises `crypto.subtle` (`calibrationDecode.test.ts`). `hex.ts`: strict
`hexToBytes(hex: string): Uint8Array`, which refuses odd length and non-hex characters.

Errors, `src/core/firmware/errors.ts`:

```ts
export type FirmwareErrorCode =
  | 'stock-corrupt-zip'
  | 'stock-missing-member'
  | 'stock-duplicate-member'
  | 'stock-wrong-version' // right file names, wrong hashes
  | 'stock-wrong-radio' // matches another radio's pinned stock
  | 'stock-is-patched' // matches a bundled release's result hash
  | 'patch-unreadable'
  | 'patch-unknown-format' // unknown name or format
  | 'patch-wrong-radio' // patch name not in descriptor.patchNames
  | 'patch-wrong-stock' // patch.stock hashes != pinned stock
  | 'patch-malformed' // bad hex, overlapping/out-of-range hook, gap, wrong append offset
  | 'patch-original-mismatch'
  | 'patch-result-mismatch';

export class FirmwareError extends Error {
  constructor(
    readonly code: FirmwareErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FirmwareError';
  }
}
```

Every message names the problem in user terms ("This is AT-D890UV firmware; you picked the DM-32UV", "This zip is not
stock v1.01.048"). That covers #1360's "wrong version, missing file, corrupt zip, or not this radio's firmware".

### 3.2 Pinned stock descriptors (`src/core/radios/<mfr>/<model>/firmware.ts`)

These sit beside `limits.ts`, under the radio-limits SoT pattern in
[vendor-boundaries.md](../../../.claude/rules/vendor-boundaries.md): one code home per radio, one tier-3 doc mirror
(`docs/reference/radios/<mfr>/<model>/firmware.md`). Updaters and patch formats **import** sizes, model IDs and role
keys from here; they do not re-declare them.

`src/core/radios/baofeng/dm-32uv/firmware.ts`. Values are from `tools/ci/fetch-stock.sh` and
`tools/ci/stock-zip.sha256` in `baofeng-dm32-firmware`:

```ts
export const DM32UV_FIRMWARE_ROLE_BIN = 'bin';
/** First 9 bytes of every DM-32UV image; the bootloader returns the same 9 bytes as its ident. */
export const DM32UV_FIRMWARE_MODEL_ID = 'BFUV32-V2';
/** Every release so far is stock length; the updater refuses anything else (firmware repo decision D24 (a)). */
export const DM32UV_FIRMWARE_IMAGE_SIZE = 860_416;
export const DM32UV_FIRMWARE_HEADER_LEN = 0x100;

export const DM32UV_STOCK_FIRMWARE: StockFirmwareDescriptor = {
  radioId: 'baofeng-dm32uv',
  label: 'Baofeng DM-32UV',
  version: 'v1.01.048',
  vendorDownload: {
    url: 'https://baofeng.s3.amazonaws.com/Baofeng_DM-32UV_Firmware_v1.01.048.zip',
    host: 'Baofeng (S3 bucket)',
  },
  zip: {
    fileName: 'Baofeng_DM-32UV_Firmware_v1.01.048.zip',
    sha256: '79ee0f41de20231300d6cad1e3d063148cc03c8e3c6d40924fc7198601c6336d',
  },
  members: [
    {
      role: 'bin',
      fileName: 'DM32_L01_048_20250821.bin',
      size: 860_416,
      sha256: 'fda860febfcf1a234eed7fa73272112891074aac83746e4f8dfe224a2a700f8f',
    },
  ],
  patchNames: ['baofeng-dm32-firmware'],
  bootloaderEntry: {
    steps: [
      'Turn the radio off and leave the programming cable out of the radio.',
      'Hold SK1 and PTT together, then turn the radio on.',
      'When the LED lights green, release the keys.',
      'Now plug the cable into the radio.',
    ],
    indicator: 'Green LED',
    warnings: ['Plugging the cable in before power-on can hang the radio until it is power-cycled.'],
  },
  stockVerifyHint: 'The radio boots to its normal screen with your channels.',
};
```

`src/core/radios/anytone/at-d890uv/firmware.ts`. Values are from `tools/ci/fetch-stock.sh` and
`docs/user/install.md` in `anytone-d890-firmware`:

```ts
export const AT_D890UV_FIRMWARE_ROLE = { CDD: 'cdd', CDI: 'cdi', SPI: 'spi' } as const;

export const AT_D890UV_STOCK_FIRMWARE: StockFirmwareDescriptor = {
  radioId: 'anytone-at-d890uv',
  label: 'AnyTone AT-D890UV',
  version: 'V1.05 (20260521)',
  vendorDownload: {
    url: 'https://anytoneusa.com/Files/D890UV%20V1.05%20DMR%20official%20release%20260521.zip',
    host: 'anytoneusa.com (12 Volt Power, US dealer)',
    note: 'About 44.5 MB: the zip also holds the ICON pack, which Studio does not use.',
  },
  zip: {
    fileName: 'D890UV V1.05 DMR official release 260521.zip',
    sha256: '193a4c24956a13094d3d529975d1f16077418d6527afaeb3de96c8628547f731',
  },
  members: [
    { role: 'cdd', fileName: 'D890UV_V1.05_20260521.CDD', size: 1_675_272, sha256: '6d84926eecf309b25f68287d3521adaae2765f171db9d9f6a1358a454c71c96e' },
    { role: 'cdi', fileName: 'D890UV_V1.05_20260521.CDI', size: 278, sha256: 'b24dd25aa02d0d72b6ba32b3b6c0d08d787f40248c80132cc4d5d7942c0470de' },
    { role: 'spi', fileName: 'D890UV_V1.05_20260521.spi', size: 51, sha256: '857771404d6ac1e38c9427ae1735007af0d174e27fc59fa1dfa1881560319c8a' },
  ],
  patchNames: ['anytone-d890-firmware'],
  bootloaderEntry: {
    steps: [
      'Switch the radio off. Check the battery is full.',
      'Hold PTT and PF3, and switch the radio on. Keep holding for 2 to 3 seconds.',
      'The red LED blinks and the screen stays blank. There is no sound.',
      'Plug the USB cable in.',
    ],
    indicator: 'Red LED blinking, screen blank',
    warnings: ['In update mode the radio appears on the computer exactly as in normal mode. The blinking red LED is the only sign.'],
  },
  stockVerifyHint: 'Menu > Device Info > Version shows "Ver 1.05".',
};
```

The bootloader-entry text and verify hints are radio facts, so they live in the radio home and the wizard renders
them generically. This follows the pattern the app already uses with `DM32_POWER_CYCLE_AFTER_SESSION_NOTE`, and it
keeps per-radio prose out of `src/app/`. Illustrations are app assets keyed by `FirmwareRadioId`
(`src/app/assets/firmware/<radioId>/`).

### 3.3 Stock resolution and `StockSource` (`src/core/firmware/stock/`)

```ts
export interface StockSource {
  readonly kind: 'user-files' | 'remote';
  /** Produce the raw bytes the user supplied (or a future source fetched). No verification here. */
  load(descriptor: StockFirmwareDescriptor, opts?: { signal?: AbortSignal }): Promise<readonly NamedBytes[]>;
}

export interface VerifiedStockFirmware {
  readonly descriptor: StockFirmwareDescriptor;
  readonly package: FirmwarePackage; // files keyed by member role
  readonly sha256: Readonly<Record<string, string>>;
  readonly via: 'zip' | 'files';
  /** Zip hash differed from the pinned one, but every member matched (re-zipped by the user). */
  readonly zipMismatchNoted: boolean;
}

/** Pure. Every source, present and future, goes through this one verifier. */
export function resolveStockFirmware(
  descriptor: StockFirmwareDescriptor,
  inputs: readonly NamedBytes[],
  others: readonly StockFirmwareDescriptor[], // for 'stock-wrong-radio' diagnosis
): Promise<VerifiedStockFirmware>;
```

Behaviour:

1. **Zip detection.** An input whose first bytes are `PK\x03\x04` is treated as a zip. Hash the whole zip
   (diagnostic). Then unzip with `fflate.unzipSync(bytes, { filter })`, inflating **only** entries whose basename
   (after normalising `\` to `/`) equals a member `fileName`. This matters for the 44.5 MB D890 zip, whose ICON pack
   must never be inflated into memory. Exactly one entry per member is required, matching `fetch-stock.sh`'s "expected
   exactly one" rule. Otherwise the error is `stock-missing-member` or `stock-duplicate-member`.
2. **Extracted files.** Non-zip inputs are matched to members by basename. Several files may be given at once
   (FileDropzone `multiple`).
3. **Verify every member:** size, then `sha256Hex`. A mismatch is `stock-wrong-version`. Before reporting it, check:
   - whether the bytes match a bundled release's `result` hash (`stock-is-patched`: "this is already-patched firmware
     for release X; supply the vendor download");
   - whether the bytes or zip match another radio's descriptor (`stock-wrong-radio`).
4. Return role-keyed bytes. The `Uint8Array`s handed back are copies, so later patching cannot mutate the user's
   buffers.

`createUserFileStockSource(files: readonly NamedBytes[]): StockSource` is the only implementation in this epic. The
app turns `File` objects into `NamedBytes` (`await file.arrayBuffer()`), because `File` is a DOM type and stays out of
core. A Proposal B proxy source would be a second implementation in integrations; it would still go through
`resolveStockFirmware`.

### 3.4 Patch formats and apply (`src/core/firmware/patch/`)

The patch JSON is a third-party interchange format at the boundary (the firmware repos own it). It is modelled like
`src/core/import-export/formats/<format>/`: a small generic dispatcher plus one module per patch `name`. Only the
format modules know about `.CDD`, `0x104`, or segments versus hooks.

```ts
// src/core/firmware/patch/types.ts
export interface FirmwarePatchFormat<P> {
  readonly name: string; // 'baofeng-dm32-firmware'
  readonly formats: readonly number[]; // [1]
  /** Structural validation of untrusted JSON. Throws FirmwareError('patch-malformed' | 'patch-unknown-format'). */
  parse(json: unknown): P;
  /** Release metadata every format exposes. */
  describe(p: P): { version: string; stock: Record<string, { sha256: string; size: number }>; result: Record<string, { sha256: string; size: number }> };
  /** Pure: verify stock, apply, verify result. Never mutates `stock`. */
  apply(stock: FirmwarePackage, p: P): Promise<FirmwarePackage>;
  /** Optional: the tag stamped into the result image, for the flash summary. */
  readVersionStamp?(result: FirmwarePackage, p: P): string | undefined;
}

// src/core/firmware/patch/index.ts
export function parseFirmwarePatch(bytes: Uint8Array): { format: FirmwarePatchFormat<unknown>; patch: unknown };
export function applyFirmwarePatch(stock: FirmwarePackage, parsed: ReturnType<typeof parseFirmwarePatch>): Promise<FirmwarePackage>;
```

`describe().stock` / `result` are keyed by **member role**. Each format maps its wire keys to roles (D890's
`".CDD"` maps to `cdd`), so generic code compares them against `StockFirmwareDescriptor.members` without knowing any
file extension.

**`baofeng-dm32-firmware` format 1** (port of `baofeng-dm32-firmware/fw/make_patch.py` `apply`):

| Field                                    | Rule                                                                                                                                                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format`                                 | must be `1`                                                                                                                                                                                                       |
| `name`                                   | must be `baofeng-dm32-firmware`. Studio checks this; the Python `apply` does not                                                                                                                                 |
| `version`                                | non-empty string                                                                                                                                                                                                  |
| `stock` / `result`                       | `{ sha256: 64-hex, size: int ≥ 0 }`                                                                                                                                                                               |
| `segments[]`                             | `{ offset: int ≥ 0, hex }`. Applied in order: `if offset > out.length → refuse (gap)`; else overwrite `out[offset..offset+len)`, extending when past the end                                                     |
| `neutral_sha256`, `version_slot{offset,len}` | Optional, parsed and kept. `version_slot` feeds `readVersionStamp` (NUL-trimmed ASCII). `neutral_sha256` is unused in Studio (it serves the firmware repo's emulator gate)                                       |
| Apply                                    | check stock sha256 and size → segments → check result sha256 and size → return `{ bin: out }`                                                                                                                    |

**`anytone-d890-firmware` format 1** (port of `anytone-d890-firmware/fw/make_patch.py` `apply`):

| Field                                  | Rule                                                                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format`, `name`, `version`            | `1`, `anytone-d890-firmware`, non-empty                                                                                                                       |
| `stock` / `result`                     | objects with exactly the keys `.CDD`, `.CDI`, `.spi`, each `{ sha256, size }`                                                                                 |
| `hooks[]`                              | `{ offset, original, hex }`; `len(original) == len(hex)`; `0 ≤ offset`, `offset + len ≤ stock .CDD length`; current bytes must equal `original` (`patch-original-mismatch`) |
| `append`                               | `{ offset, hex }`; `offset` must equal the `.CDD` length after hooks                                                                                          |
| Length fields                          | write the new `.CDD` length as u32 LE at `.CDI + 0x104` and at `.spi + 6` (bounds-checked)                                                                    |
| Apply                                  | check all three stock hashes → hooks → append → length fields → check all three result hashes → `{ cdd, cdi, spi }`                                           |

What both formats share: no toolchain, no network, no checksum recomputation, no input mutation. Each port is about
40 lines plus the parse schema. Studio adds stricter structural parsing than the Python (which trusts its own JSON),
because a user patch is untrusted input.

### 3.5 Release catalog and `FirmwareReleaseSource` (`src/core/firmware/releases/`)

```ts
export type FirmwareReleaseChannel = 'final' | 'rc';

export interface BundledFirmwareRelease {
  readonly radioId: FirmwareRadioId;
  readonly tag: string; // '1.0.0', '1.0.0-rc.3' (firmware-repo tag, no 'v')
  readonly channel: FirmwareReleaseChannel;
  readonly patchFile: string; // 'dm32-fw-1.0.0.patch.json' (as published)
  readonly patchSha256: string; // from the release's SHA256SUMS
  readonly stockVersion: string; // must equal the radio's StockFirmwareDescriptor.version
  readonly publishedOn: string; // ISO date
  /** User-facing summary. Firmware repos are private, so a release-notes URL would 404 for operators (OQ4). */
  readonly summary: string;
  readonly radioStatus: 'radio-checked' | 'emulator-checked' | 'not-checked';
  /** How the operator confirms this release is running (differs by radio and release; see 3.10). */
  readonly verifyHint: string;
  /** Lazy load of the exact published bytes. */
  readonly loadBytes: () => Promise<Uint8Array>;
}

export interface FirmwareReleaseSummary {
  readonly radioId: FirmwareRadioId;
  readonly key: string; // tag for bundled; 'user:<sha256>' for a user file
  readonly label: string;
  readonly channel: FirmwareReleaseChannel | 'unknown';
  readonly provenance: Exclude<FirmwareProvenance, 'stock'>;
}

export interface LoadedFirmwarePatch {
  readonly bytes: Uint8Array;
  readonly sha256: string;
  readonly parsed: ReturnType<typeof parseFirmwarePatch>;
  readonly provenance: 'bundled' | 'unreviewed';
  readonly release?: BundledFirmwareRelease; // set when bundled, or when a user file matches one
}

export interface FirmwareReleaseSource {
  readonly kind: 'bundled' | 'user-file' | 'remote';
  listReleases(radioId: FirmwareRadioId, opts: { includeRc: boolean }): Promise<readonly FirmwareReleaseSummary[]>;
  loadPatch(radioId: FirmwareRadioId, key: string): Promise<LoadedFirmwarePatch>;
}

export const bundledFirmwareReleaseSource: FirmwareReleaseSource;
export function createUserPatchSource(file: NamedBytes): FirmwareReleaseSource; // lists exactly one entry
```

Rules:

- **Bundled list:** finals by default. `includeRc` adds RCs. Sorted newest first by `publishedOn`, then tag.
- **Bundled load:** `loadBytes()` → `sha256Hex` → it must equal `patchSha256`, or a hard error. This is a runtime
  self-check that the shipped bytes are the published bytes. It catches formatter or line-ending mangling in a build.
  Then `parseFirmwarePatch`.
- **User file:**
  1. Hash the bytes.
  2. If the hash equals a bundled `patchSha256` for the same radio, return that release with provenance `bundled`. No
     warning: the decision's "treat it as that release".
  3. Otherwise parse it. The patch `name` must be in `descriptor.patchNames` (`patch-wrong-radio`). Then return
     provenance `unreviewed`.
  4. The patch's stock hashes must equal the pinned stock (`patch-wrong-stock`). This is checked in
     `prepareFirmwareImage`, so stock and bundled paths share it.
- **Lazy loading:** each bundled patch is a dynamic import, so only the chosen release's bytes reach the browser. The
  catalog index itself is tiny.

**Raw bytes, not a JSON module.** A release's sha256 is over the exact published file bytes. `import x from
'./x.json'` returns a parsed object, so the bytes can't be re-hashed. The proposal is `loadBytes: () =>
import('./baofeng-dm32uv/1.0.0.patch.json?raw').then((m) => new TextEncoder().encode(m.default))`.
- Published patches come from Python's `json.dump(..., indent=1)` and are ASCII, so UTF-8 re-encoding is
  byte-identical.
- No `src/core` module uses a Vite import suffix today, and `tsconfig.app.json` has no `resolveJsonModule`. Both are
  new. The alternative is base64 strings in a generated `.ts` file. See [OQ7](#open-questions).

**Repo hygiene (required, or the hashes break):**

- `.prettierignore` gets `src/core/firmware/releases/**/*.patch.json` and `src/core/firmware/**/__fixtures__/**/*.json`.
  `npm run format` is `prettier --write .`, which would re-indent the `indent=1` files.
- `.gitattributes` gets `*.patch.json -text`. The file sets `* text=auto`, and a Windows checkout with autocrlf would
  rewrite line endings.

**Catalog unit test** (`releases/catalog.test.ts`, Node, reads the raw files with `node:fs`):

- every index row's file exists, and `sha256(file bytes) === patchSha256`;
- `parseFirmwarePatch` succeeds, `name` is in the radio's `patchNames`, and `version === tag`;
- every `describe().stock` role and hash equals the radio's `StockFirmwareDescriptor.members`;
- `stockVersion` equals `descriptor.version`;
- **DM-32UV:** `result.size === DM32UV_FIRMWARE_IMAGE_SIZE`, so a bundled release can never be refused by the updater
  at flash time;
- **D890:** the hooks are in range and of equal length, and `append.offset` equals the stock `.CDD` size;
- there is at least one `final` per radio (decision: "keep at least the latest final");
- no `(radioId, tag)` duplicates; a `-rc.N` tag implies `channel: 'rc'`, and the reverse.

The test can't apply a real patch: there is no stock in CI, and none may be committed.

**Seed content:** DM-32UV `1.0.0` (final, 2026-10-20) and AT-D890UV `1.0.0` (final, 2026-10-20), both from the
firmware repos' release history. Current RCs are optional: both radios' latest RC (`1.0.0-rc.3`) was promoted to
`1.0.0` unchanged except for the release name.

### 3.6 `prepareFirmwareImage` (`src/core/services/firmware/prepareFirmwareImage.ts`)

```ts
export type FirmwareTarget =
  | { readonly kind: 'stock' }
  | { readonly kind: 'patch'; readonly patch: LoadedFirmwarePatch };

declare const prepared: unique symbol;

export interface PreparedFirmwareImage {
  readonly [prepared]: true; // only this service constructs one
  readonly radioId: FirmwareRadioId;
  readonly provenance: FirmwareProvenance;
  readonly stockVersion: string;
  readonly releaseTag?: string; // bundled, or a user patch that matched one
  readonly patchVersion?: string; // patch.version (also for unreviewed)
  readonly patchSha256?: string;
  readonly versionStamp?: string; // from readVersionStamp, when the format has one
  readonly package: FirmwarePackage; // the bytes that will be flashed
  readonly sha256: Readonly<Record<string, string>>; // per role, recomputed after apply
  readonly verifyHint: string;
}

export async function prepareFirmwareImage(input: {
  descriptor: StockFirmwareDescriptor;
  stock: VerifiedStockFirmware;
  target: FirmwareTarget;
}): Promise<PreparedFirmwareImage>;
```

Steps:

1. **Stock target:** the package is the verified stock. Provenance `stock`; `verifyHint` comes from
   `descriptor.stockVerifyHint`.
2. **Patch target:**
   - `describe(patch).stock` must equal the pinned members (`patch-wrong-stock`);
   - `apply`, which verifies stock and result inside the format;
   - recompute result hashes and assert equality again, as a cheap second check;
   - provenance comes from the loaded patch;
   - `verifyHint` comes from the release row. An unreviewed patch gets a generic hint: "Check the radio boots and shows
     the expected version".

The brand is a type-level speed bump: integrations can't make a `PreparedFirmwareImage` without a visible cast. Safety
does not rest on it. The updater re-runs its interlocks on whatever it is handed (3.8).

**Proposal B seams.** A runtime GitHub release list would be a third `FirmwareReleaseSource` (`kind: 'remote'`)
returning `LoadedFirmwarePatch` with provenance `unreviewed` or a new `published` value. A stock proxy would be a second
`StockSource` (`kind: 'remote'`). Neither changes `resolveStockFirmware`, `prepareFirmwareImage`, the updaters or the
wizard steps. Only the release picker and the stock step gain an extra option.

### 3.7 `FirmwareUpdater` seam (`src/integrations/radio-io/firmware/`)

This is a sibling of `CloneImageRadio`, not an extension of it. Firmware has no memory map, no download, no hydration
and no build.

```ts
// types.ts
export interface FirmwareLinkSpec {
  readonly baudRate: number;
  /** Narrow the Web Serial picker. Identifies the cable or USB device, NOT whether the radio is in update mode. */
  readonly usbFilters: readonly { readonly usbVendorId: number; readonly usbProductId?: number }[];
  readonly raiseDtrRts: boolean;
}

export interface FirmwareBootloaderIdent {
  readonly radioId: FirmwareRadioId;
  readonly model: string; // 'BFUV32-V2' | 'D890UV'
  readonly version?: string; // D890: 'V100'
  readonly raw: Uint8Array;
}

export type FirmwareFlashPhase = 'handshake' | 'erase' | 'transfer' | 'finish';

export interface FirmwareFlashProgress extends ProgressUpdate {
  readonly phase: FirmwareFlashPhase;
  /** True from the first erase-capable frame onward: an abort now leaves the radio needing a re-flash. */
  readonly radioTouched: boolean;
}

export interface FirmwareFlashResult {
  readonly framesSent: number;
  readonly dataFrames: number;
  readonly elapsedMs: number;
  /** DM-32 'eot-sent' (reply ignored, as the CPS does); D890 'acknowledged' | 'port-closed-by-radio' | 'no-reply'. */
  readonly end: 'eot-sent' | 'acknowledged' | 'port-closed-by-radio' | 'no-reply';
}

export interface FirmwareUpdater {
  readonly radioId: FirmwareRadioId;
  readonly link: FirmwareLinkSpec;
  /** Pure hard interlocks on the image. Throws RadioInterlockError. Nothing about it is configurable. */
  checkImage(image: PreparedFirmwareImage): void;
  /** Non-destructive handshake up to and including the bootloader ident. Binds `pipe` for flash(). */
  identify(pipe: BytePipe, opts?: { signal?: AbortSignal }): Promise<FirmwareBootloaderIdent>;
  /**
   * Re-runs checkImage, checks ident against image, precomputes every frame, then sends.
   * Must be called straight after identify() in the same session, without waiting for user input (OQ6).
   */
  flash(
    image: PreparedFirmwareImage,
    opts: { onProgress?: (p: FirmwareFlashProgress) => void; signal?: AbortSignal },
  ): Promise<FirmwareFlashResult>;
}

// registry.ts
export interface FirmwareUpdaterDescriptor {
  readonly radioId: FirmwareRadioId;
  readonly stock: StockFirmwareDescriptor; // imported from core firmware.ts
  readonly link: FirmwareLinkSpec;
  readonly createUpdater: () => FirmwareUpdater; // one instance per session, like protocolFactory
  /** Hidden on Capacitor until proven end to end (OQ9). */
  readonly capacitorSupported: boolean;
}
export function listFirmwareUpdaters(): readonly FirmwareUpdaterDescriptor[];
export function getFirmwareUpdater(radioId: FirmwareRadioId): FirmwareUpdaterDescriptor | undefined;
```

The `identify(pipe)` + `flash(image, { onProgress, signal })` split follows #1363. It binds the pipe in `identify`, as
`CloneImageRadio.connect(pipe)` does.

**One send path per updater (ported from both senders).** Each updater sends only through `createGuardedSend(pipe,
check)` (`firmware/guardedSend.ts`). It calls `check(frame)` before `pipe.write`, and a refusal throws
`RadioInterlockError` and is never caught inside the updater.

- **DM-32:** `check` is `TxGuard`. It accepts exactly the next frame of the precomputed plan and nothing else
  (`dm32_fw_send.py` `TxGuard`).
- **D890:** `check` is `checkOutgoing`. It allows only `UPDATE`, `02`, `18` and well-formed 40-byte data frames whose
  sum is right and whose address passes the window interlock (`d890update.py` `check_outgoing`).
- A unit test per updater asserts that the module has exactly one `pipe.write` call site. This mirrors the DM-32
  sender's `test_source_has_one_write_call_and_no_open_outside_pipe`.

**Errors.** Add `'interlock'` to `RadioIoErrorCode`, and `RadioInterlockError extends RadioIoError`, in
`src/integrations/radio-io/kit/errors.ts`. Add `FirmwareFlashError extends RadioIoError` in `firmware/errors.ts`, with:

- `cause: RadioIoError`;
- `radioTouched: boolean`;
- `position: string`: the plan step name (DM-32) or `frame n/N @ 0x…` (D890).

It reuses the cause's `code`. The wizard maps `radioTouched` to "nothing was written; power the radio off" or to the
recovery screen.

**Abort.** `signal` is checked between frames, never mid-frame. Before the first erase-capable frame, abort is clean.
After it, abort stops sending and throws `FirmwareFlashError` with `radioTouched: true`. The wizard asks for
confirmation before passing an abort through once `radioTouched` is true.

**No retry beyond the protocol's.**
- DM-32 has no NAK, resend or resume (F26): any wrong reply aborts.
- D890 resends a frame once (NAK `15`, timeout, or a wrong byte; the input is drained before the resend), then aborts.
- Studio never restarts a session on its own. "Try again" in the UI means "re-enter update mode and start from the
  handshake".

**Transport change.** `requestWebSerialPort(forceSelection, filters?)` and `WebSerialPipeOptions.filters?:
SerialPortFilter[]` are passed to `navigator.serial.requestPort({ filters })`. The firmware flow always uses
`forceSelection: true` with `descriptor.link.usbFilters`. The port is re-picked after the radio is in update mode, and
`getPorts()[0]` is never reused.

`openWebSerialPipe` already raises DTR and RTS (`assertSerialSignals`) and opens with a 64 KiB host buffer. Both are
correct for both bootloaders, so the pipe needs no other change.

### 3.8 DM-32UV bootloader updater (`radios/dm32uv/firmwareUpdate/`)

This is a byte-exact port of `baofeng-dm32-firmware/tools/flash/dm32_fw_send.py`. That sender's plan equals a USB
capture of the official CPS byte for byte (F215), and it has written stock 048 to a real radio (`tools/flash/README.md`,
F266/F267).

| Item       | Value                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Link       | 115200 8N1, DTR and RTS raised; USB filter CH340 `{usbVendorId: 0x1a86, usbProductId: 0x7523}`. This identifies the **cable**, which enumerates with or without a radio |
| Pre-write  | `pipe.flush()` (clear RX), then a 10 ms delay before every frame. This is the CPS's `ComWrite` (purge RX, 10 ms, `WriteFile`)                                                |

`plan.ts`: `buildDm32FirmwarePlan(image: Uint8Array, fileName: string): Dm32PlanStep[]` is pure and fully precomputed:

| #     | Step name        | TX                                                                                             | Expected RX (exact)          | Timeout                  | Phase     |
| ----- | ---------------- | ---------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------ | --------- |
| 1     | `init`           | `52`                                                                                           | `06`                         | 500 ms                   | handshake |
| 2     | `model-query`    | `4D 00 00 00 01`                                                                               | `4D 01 09`                   | 500 ms                   | handshake |
| 3     | `model-id`       | `06`                                                                                           | `image[0..9)` = `BFUV32-V2`  | 500 ms                   | handshake |
| 4     | `prelude-45`     | `45 00 00 00 00`                                                                               | `06`                         | 500 ms                   | handshake |
| 5     | `prelude-31`     | `31`                                                                                           | `43`                         | 5 s                      | handshake |
| 6     | `soh-block0`     | `01`                                                                                           | `43`                         | 5 s                      | handshake |
| 7     | `block0+erase`   | `00 FF` + block0[128] + CRC16 BE. block0 = `fileName` + `00` + decimal `len(image) - 0x100`, zero-padded to 128 bytes | `06 43`                      | 60 s (CPS: 20 s; erase observed 12.6 s) | **erase** |
| 8..   | `type#n`         | `02` (STX, 1024 B) while ≥ 0x400 remain, else `01` (SOH, 128 B)                                | `43`                         | 10 s                     | transfer  |
| 9..   | `block#n`        | `seq, 0xFF-seq` + data (short tail padded `0x1A`) + CRC16-XMODEM BE. seq starts at 1 and wraps `0xFF → 0`                    | `06`                         | 10 s                     | transfer  |
| last  | `eot`            | `04`                                                                                           | read 1 byte, **ignored**     | 5 s                      | finish    |

- The 0x100-byte header is never sent.
- `fileName` is always the pinned stock member name `DM32_L01_048_20250821.bin`, including for patched images. That is
  the name every successful write so far has used (`docs/guides/flashing.md` section 4).
- CRC16-XMODEM: poly `0x1021`, init 0, MSB first, no xorout. It lives in the radio module, since nothing else in Studio
  uses it.
- For stock 048 the plan is 840 STX blocks, no SOH, last seq `0x48`, and **1,688 frames**. A modded stock-length image
  is the same count.

`identify()` runs steps 1 to 3, which precede the destructive step by construction ("the model check is enforced
before the erase"). It returns `{ model: 'BFUV32-V2' }`. `flash()` continues at step 4. `radioTouched` becomes true
when step 7 is sent. Expected time: the erase (about 13 s) plus 1,680 transfer round trips with 10 ms pacing. The
firmware repo's guide says "about two minutes", like the CPS.

`identify` and `flash` share one precomputed plan. The plan is built in `flash()` from the image, and the steps
already sent by `identify()` must equal the plan's first three steps. That holds because step 3's expected reply is
`image[0..9)` and the ident has already been compared against it.

Interlocks: see 3.10.

Mock: `radios/dm32uv/__fixtures__/dm32BootloaderMock.ts`, a `BytePipe` port of `tools/flash/bootloader_mock.py`
(state machine, CRC and seq checks, body reassembly, `violations[]`, and fault injection: `silentAt`, `wrongReplyAt`).
Golden frames: block 0, the first two data blocks and the last, checked against an independent derivation as in
`tools/cps/cps_fw_frames.py`.

Tests port `test_dm32_fw_send.py`:

- CRC matches an independent implementation;
- prelude bytes; block 0 byte-exact; data blocks; EOT last; header never sent;
- short tail uses SOH and `0x1A` padding; seq wraps;
- the guard accepts only the next frame; one write site;
- full run reassembles the body;
- silence mid-transfer aborts with no further sends;
- wrong model aborts before the erase;
- erase failure reply aborts; a NAK-like data reply aborts at once;
- silent EOT is not an error;
- abort before and after step 7 (`radioTouched` false and true).

### 3.9 AT-D890UV bootloader updater (`radios/at-d890uv/firmwareUpdate/`)

This is a byte-exact port of `anytone-d890-firmware/tools/d890update.py`, **firmware mode only**. Resource mode
(`PROGRAM`, the ICON pack, external flash) is not ported, and a 14-byte `.spi` is refused. Our sender has written MOD,
rc.2 and rc.3 images; the official CPS has written stock with a captured transcript (F125/F126). The sender's own
`docs/features/radio-tools/update-sender.md` still says "not run" against a real bootloader. That doc is stale in the
firmware repo; its `docs/user/install.md` and `releases.md` record the hardware writes.

| Item       | Value                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Link       | USB CDC `{usbVendorId: 0x0483, usbProductId: 0x5740}` (ST's generic VCP ID, same as app mode); 921600 nominal (CDC ignores the rate; `AT_D890_CONNECTION.BAUD_RATE` is already 921600); no echo (CPS "Duplex" not needed) |

`package.ts`: `parseD890FirmwarePackage({cdd, cdi, spi})`:

- `.spi` must be 50 or 51 bytes (firmware mode), with u32 LE at 0 equal to `0x20`;
- u16 `count` at 4; u32 `total` at 6, equal to the `.CDD` length;
- `.CDI` length equals `278 × count`;
- each entry: name `[0, 0x100)`, `addr` u32 at `0x100`, `len` at `0x104`, `off` at `0x108`, `flag` at `0x10C`, with
  `off + len ≤ .CDD length`;
- model `= spi[0x0E..0x14)` ASCII trimmed (`D890UV`), version `= spi[0x16..0x1A)` (`V100`).

`blocks()`: entry by entry, `(addr + k, cdd[off + k .. off + min(k + 32, len)) zero-padded to 32)`.

`frames.ts`: `makeD890UpdateFrame(addr, data32) = 01 | addr u32 LE | data[32] | sum16 LE over bytes [1, 37) | 06`
(40 bytes).

Session:

| Step       | TX                         | RX                                                                                                         | Timeout                 | Notes                                                                                     |
| ---------- | -------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| drain      |                            |                                                                                                            |                         | `pipe.flush()`                                                                            |
| `UPDATE`   | ASCII `UPDATE` (6 B)       | read 1 byte at a time until the last byte is `06`, up to 16 bytes                                          | 2 s                     | The reply length is not documented; hardware returned `06` (S2, 2026-10-19)               |
| ident      | `02`                       | 16 B: `I` + model[7] NUL-padded + **band** + version[4] + `00 00` + `06`                                   | 2 s                     | model and version must equal the `.spi` (`Model Error`); see interlocks for the band byte |
| data × N   | 40-byte frame              | `06`; `15` = NAK                                                                                           | **30 s first frame**, 2 s after | One resend after NAK, timeout or a wrong byte (drain first), then abort. `radioTouched` from frame 1                          |
| end        | `18`                       | `06`, **or the port closing** (Web Serial reader rejects → pipe `eof` → `RadioClosedError`)                 | 2 s                     | Closed after `18` = success (`port-closed-by-radio`). Closed before `18` = error. Timeout after `18` = `no-reply`: every frame was ACKed, so the UI says "check Device Info" |

Stock is `0x199008` = 1,675,272 bytes = **52,353 data frames**. A modded release adds `append.length / 32` frames.
`identify()` = drain + `UPDATE` + ident. Hardware stage S2 showed this erases nothing (the radio booted normally
afterwards).

Mock: `radios/at-d890uv/__fixtures__/d890BootloaderMock.ts`, a `BytePipe` port of `MockBootloader`:

- firmware mode only;
- `mem` map, `log`;
- faults `corruptReplyAt`, `nakAt`, `silentAt`;
- `dropAfterEnd`, which makes `readExact` throw `RadioClosedError`.

Tests port the firmware-mode cases of `tools/test_d890update.py`:

- frame layout; the outgoing guard; bad checksum; address windows; package checks; model mismatch stops before any
  frame;
- one resend then success (each fault kind); two failures abort without `18`;
- nothing unsafe reaches the mock; an unsafe package sends nothing;
- port closing after `18` is success; port closing before `18` is an error;
- a synthetic package reproducing the image;
- a 52,353-frame synthetic run, to time the JS-side overhead.

#### D890 Web Serial throughput: the risk to retire first

Our Python sender takes about 25 s for about 52k frames, roughly **0.5 ms per round trip**. The CPS takes under a
minute. Studio's pipe does one `await writer.write()`, then one `readExact(1, …)` that parks on a promise woken by the
reader pump (`webSerialPipe.ts:77-106`, `143-168`).

Browser per-round-trip latency over Chromium Web Serial is **unmeasured**. At 1 to 4 ms per frame, the transfer would
take about 50 to 210 s. That is acceptable, but at the top end it is 3 to 4 times the CPS. Background-tab throttling
could stretch it further, and the bootloader's 2 s per-frame timeout is the hard limit.

The spike should run **before** the D890 updater and the UI are built. It must not write firmware.

1. **JS overhead.** Time the TS updater against the TS mock for 52,353 frames in Vitest, and against a
   zero-latency fake `SerialPort` in the browser. This isolates Studio's own per-frame cost: `Uint8Array`
   concatenation in the pump, one `setTimeout` per `readExact`, and promise hops.
2. **Host round-trip latency on the real USB device, read-only.** On a D890 in **normal mode**, run N = 2,000 small
   read-only request/reply exchanges over the existing AnyTone DMR program-mode `R` frames (`kit/codecs/anytoneDmrRw.ts`,
   the same CDC device and driver). Measure the median and p99 round trip. Repeat with the tab backgrounded and with the
   screen locked. Extrapolate to 52,353 frames. A debug route next to `/debug/d890-erase-probe` is enough; it sends
   nothing the Backup tab doesn't already send.
3. **Decision rule:**
   - if the projected time is ≤ 3 min with p99 well under 2 s, proceed;
   - if it's slower, raise it with the owner before UI work. Options: fix the pump, use a dedicated reader loop for
     single-byte ACKs, or move pacing off timers. **Pipelining frames ahead of their ACK is rejected.** It changes the
     protocol the CPS speaks, and the resend-once rule would no longer be well defined.
4. The first real measurement in bootloader mode is the hardware acceptance flash. Record its duration in #1364.

Hardware stage S2 (handshake only) proves the handshake, not throughput. That is why step 2 uses read-only app-mode
traffic as the proxy (see [Ticket alignment](#ticket-alignment-1359-to-1366)).

### 3.10 Hard interlocks (non-bypassable)

Every interlock is a function in the updater module, called from `checkImage()` and again at the top of `flash()`. The
constants come from core `firmware.ts` (radio facts) or the updater's `constants.ts` (protocol and memory-map facts,
the "protocol-only layout" allowance in vendor-boundaries). No interlock reads a setting, flag, env value, query
parameter or patch field. Each one has a refusal test.

| Radio     | Interlock                                                                                                                         | Source                                                       | When                       |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------- |
| both      | Image is a `PreparedFirmwareImage` for **this** `radioId`, with all roles present                                                 | Studio                                                       | `checkImage`, `flash`      |
| DM-32UV   | `len(image) === DM32UV_FIRMWARE_IMAGE_SIZE` (860,416)                                                                             | firmware repo D24 (a)                                        | `checkImage`, `flash`      |
| DM-32UV   | `image[0..9) === 'BFUV32-V2'`                                                                                                     | `MODEL_ID`                                                   | `checkImage`, `flash`      |
| DM-32UV   | Header END marker: one of `image[0xFD]=='E'`, `[0xFE]=='N'`, `[0xFF]=='D'` (the CPS's own check)                                  | `cps_fw_frames.py` / CPS `0x42320B`                          | `checkImage`, `flash`      |
| DM-32UV   | Bootloader replies `4D 01 09` and the 9-byte ident equals `image[0..9)` **before** step 7 (erase)                                 | sender `build_plan`                                          | `flash` (from `identify`)  |
| DM-32UV   | Only the next precomputed frame may be sent (`TxGuard`)                                                                           | sender `TxGuard`                                             | every write                |
| AT-D890UV | Firmware mode only: `.spi` is 50 or 51 bytes, `u32[0] == 0x20`; never `PROGRAM`, never resource mode                              | `Package`                                                    | `checkImage`, every write  |
| AT-D890UV | `.CDI` count and size, and `.spi` total == `.CDD` length                                                                          | `Package`                                                    | `checkImage`               |
| AT-D890UV | Every block: `0x0800C000 ≤ addr` and `addr + 32 ≤ 0x081E4000`; never overlaps `0x0800A000–0x0800BFFF` (activation page) or anything below (bootloader) | `addr_problem` (F34, F36)                                    | `checkImage`, every write  |
| AT-D890UV | First entry loads at `0x0800C000`                                                                                                 | `check_package`                                              | `checkImage`               |
| AT-D890UV | Vector table: `0x20000000 ≤ SP ≤ 0x20040000`; reset vector odd and in `[0x0800C000, 0x0800C000 + entry0.len)`                     | `check_package`                                              | `checkImage`               |
| AT-D890UV | Ident model and version equal the `.spi` (`D890UV`, `V100`) before any data frame                                                 | `Sender.handshake`                                           | `flash`                    |
| AT-D890UV | **Proposed, stricter than the Python:** ident band byte `ident[8] === 0x00` (bootloader; `03` = app)                              | runbook S1 result (F125)                                     | `flash`                    |
| AT-D890UV | Outgoing guard: only `UPDATE`, `02`, `18`, or a 40-byte frame with a correct sum and a safe address                               | `check_outgoing`                                             | every write                |

The stock image passes every interlock (the stock-through-mock test in both repos proves it), so "flash stock" needs
no exception.

The Python senders' policy gates (a stock-only default, `--gate` result files, typed phrases, the `EMU-ONLY` filename
rule) are **not** ported. In Studio, the pinned stock hashes plus the patch's `result` hash from a bundled or
deliberately accepted patch do that job, as the investigation established. This also resolves DM-32 firmware issue
#39 (the sender refuses patch-rebuilt images) for Studio users. It does not change the Python tools.

### 3.11 Flash stock (recovery)

This is `FirmwareTarget { kind: 'stock' }` through the same path. The release picker shows **"Stock firmware
(\<vendor version\>)"** as an entry for both radios, alongside the bundled releases. The recovery docs say: re-enter
update mode, flash stock; the vendor CPS stays the documented fallback for both radios.

Evidence and remaining proof:

- **DM-32UV:** the firmware repo's sender wrote stock 048 to a real radio and it booted (F266/F267). Studio's DM-32
  hardware acceptance (#1363) flashes stock first.
- **AT-D890UV:** our sender has never written stock: runbook S4/S5 was dropped on 2026-10-20 in favour of the CPS.
  Stock is the zero-hook, zero-append case of the same frame stream (`test_stock_firmware_through_the_mock`), but it
  must be proven once on hardware before the docs call it the recovery route. Until then, the entry is labelled
  "Stock firmware: Studio route not yet hardware-proven; the vendor CPS is the proven route". The wording is
  data-driven from a flag on the updater descriptor, not hard-coded in the app.

### 3.12 App orchestration (`src/app/services/firmwareFlash.ts`)

This stays thin: it wires core and integrations and holds no protocol or radio knowledge.

```ts
export async function grantFirmwarePort(radioId: FirmwareRadioId): Promise<SerialPortLike>; // forceSelection + link.usbFilters
export async function runFirmwareFlash(input: {
  radioId: FirmwareRadioId;
  image: PreparedFirmwareImage;
  port: SerialPortLike;
  onProgress: (p: FirmwareFlashProgress) => void;
  signal: AbortSignal;
}): Promise<FirmwareFlashOutcome>; // open → identify → flash → close (always) → summary
export function formatFirmwareFlashSummary(outcome: FirmwareFlashOutcome): string; // plain-text log
```

`FirmwareFlashOutcome` records:

- radio, provenance ("user-supplied patch, sha256 …" for `unreviewed`), and release tag or patch version;
- stock version and member sha256s; result sha256s; version stamp; ident;
- frames, elapsed time, and the end kind;
- for a failure: error code, position, and `radioTouched`;
- the Studio build (`__BUILD_VERSION__`, `__BUILD_ENV__`).

The summary is shown, copyable, and downloadable as `.txt` through the existing `integrations/download` helper. It is
**not persisted**: no project is needed and none is touched (see [OQ10](#open-questions)).

`radioWriteEnvGate.ts` (`src/app/services/`) is **not consulted** (decision #4). The flasher ships wherever Studio
ships.

### 3.13 Vendor-neutral internal-model note

- **Nothing in the library, builds, `assemble`, persistence schema or library CRUD changes.** Firmware is per physical
  radio and session-scoped. It is not a library entity, it is not part of a `RadioBuild` or `EgressPath`, and it never
  touches `RadioCloneHydrationBag`.
- **Generic core code (`src/core/firmware/*.ts`, `stock/`, `releases/` types, `services/firmware/`) names no vendor
  files, offsets or wire keys.** It works on member **roles** declared by `StockFirmwareDescriptor` and on hashes.
  `.CDD`, `0x104`, `segments` and `hooks` appear only in `patch/formats/<patch-name>/` (boundary format modules) and
  in the radio's `firmware.ts`.
- **Radio facts have one home each.** Stock sizes, hashes, model ID, entry steps and verify hints live in
  `src/core/radios/<mfr>/<model>/firmware.ts`, mirrored by `docs/reference/radios/<mfr>/<model>/firmware.md`.
  Bootloader framing, timeouts, USB IDs and flash address windows live in
  `src/integrations/radio-io/radios/<id>/firmwareUpdate/constants.ts`, mirrored in the same tier-3 doc. The app gets
  all of these only through the updater registry and descriptor fields: no literals in `src/app/`.
- **No relationships are introduced,** so no FKs. Release identity is `(radioId, tag)` in a static index; user patches
  are identified by sha256.
- **Neither firmware repo shapes the model beyond its own boundary module.** A third radio would add a `firmware.ts`,
  one patch-format module if its format differs, and one updater, with no change to the generic layers.

---

## UI changes

**Route:** `/firmware`, outside `RequireActiveProject` (firmware is per radio, not per project or build), listed in
the **Tools** contextual strip as "Firmware flasher".

- `toolsStripItems` in `src/app/nav/contextualStripItems.ts` gets the entry.
- The strip resolver's `pathname.startsWith('/reference') || pathname.startsWith('/tracking')` gains `/firmware`.
- The page uses the v2 design system (`Page`, `Panel`, `FileDropzone`, `Checkbox`, `StatusBanner`, `ConfirmModal`,
  `ProgressModal`) and the styleguide conventions. A small reusable `Stepper` (v2, with sidecar and a styleguide demo)
  is proposed, since no step-indicator component exists. Alternatively the steps could be page-local, with no sidecar
  ([OQ12](#open-questions)).
- Hidden on Capacitor in the first release, with a message ([OQ9](#open-questions)). Feature-detects Web Serial with
  the existing `isWebSerialSupported` / `getRadioSerialUnsupportedMessage`.

Wizard (one page, linear steps; going back never discards verified stock unless the radio changes):

1. **Radio.** Cards from `listFirmwareUpdaters()` (label, pinned stock version).
2. **Release.**
   - A list of bundled finals, newest first. Each row: tag, date, summary, radio-check status.
   - A **"Show release candidates"** toggle adds RCs, with a "Pre-release, for testing" pill and their radio status.
   - The entry **"Stock firmware (V…)"** is always present (recovery).
   - **Advanced** disclosure: **"Use a patch file from disk"**. A FileDropzone for `.json`, then the risk statement
     (decision wording) and an "I understand" checkbox that must be ticked to continue. If the file matches a bundled
     release, the warning is replaced by "This is release X (bundled)".
3. **Stock firmware.**
   - The vendor link (opens in a new tab, `rel="noopener noreferrer"`), host and note, and the expected zip name and
     member names.
   - A FileDropzone (`multiple`) taking the zip or extracted files.
   - On success: "Stock V… verified" with short hashes. On failure: the `FirmwareError` message.
   - Verified stock is held in memory only and dropped on leaving the page.
4. **Prepare.** Runs `prepareFirmwareImage` and `updater.checkImage`. Shows result hashes, the version stamp when
   known, and provenance. Any failure stops here, with nothing written and no bootloader entry asked for.
5. **Before you flash.** Declarations, all required:
   - "This can brick your radio";
   - battery charged;
   - a short direct USB cable and no hub (from `reflash_preflight.py`);
   - vendor CPS and other Studio tabs closed.

   Plus a strong **back up first** prompt. The Backup tab is per build (`/builds/:id/backup`), so:
   - with an active project that has a build for this radio's stock or MM9PDY target, link to that build's Backup tab;
   - otherwise say how to get there ([OQ11](#open-questions)).

   This is also where the final go-ahead is given ([OQ6](#open-questions)).
6. **Enter update mode.** `descriptor.stock.bootloaderEntry` steps, indicator and warnings, with the illustration.
7. **Connect and flash.** One button, **"Connect and flash"** (the user gesture for `requestPort`), then:
   - the picker opens, filtered; open; `identify()`;
   - show the ident;
   - on a match, `flash()` starts immediately (ProgressModal: Handshake → Erase → Transfer n/N → Finish);
   - while running: `useUnsavedNavigationGuard(true)`, `useScreenWakeLock(true)` (new hook: `navigator.wakeLock.request('screen')`,
     re-acquired on `visibilitychange`, released on unmount), and a note "Keep this tab in front; don't let the
     computer sleep";
   - Cancel is a ConfirmModal once `radioTouched` is true.
8. **Done / failed.**
   - **Success:** "Power-cycle if needed, then check: \<verifyHint\>", plus the summary with copy and download.
   - **Failure, `radioTouched: false`:** "Nothing was written. Power the radio off."
   - **Failure, `radioTouched: true`:** a recovery screen. Do not keep power-cycling. Re-enter update mode, and flash the
     same target again or flash stock. The vendor CPS is the fallback. Link to the hub's recovery section.
   - `ProgressModal`'s `onRetry` maps to "start again from step 6", never to an automatic resend.

Every verification failure in steps 3 and 4 shows a specific message and leaves the radio untouched (#1365
acceptance).

---

## Consumer changes

| File                                                                                                     | Today                                                                       | Becomes                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/integrations/radio-io/transport/webSerialPipe.ts`                                                   | `requestPort()` without filters; `getPorts()[0]` reuse                       | `WebSerialPipeOptions.filters?`, `requestWebSerialPort(forceSelection, filters?)` passes `{ filters }`. Existing callers unchanged                           |
| `src/integrations/radio-io/transport/index.ts`                                                           | exports pipe helpers                                                        | also exports the `SerialPortFilter` type                                                                                                                      |
| `src/integrations/radio-io/kit/errors.ts`                                                                | 7 error codes                                                               | `+ 'interlock'`, `RadioInterlockError`                                                                                                                        |
| `src/integrations/radio-io/kit/index.ts`                                                                 | re-exports errors                                                           | re-exports `RadioInterlockError`                                                                                                                              |
| `src/integrations/radio-io/index.ts`                                                                     | codeplug contracts                                                          | also exports firmware types and `listFirmwareUpdaters` / `getFirmwareUpdater`                                                                                 |
| `src/integrations/radio-io/types.ts`                                                                     | `CloneImageRadio`, `RadioDescriptor`                                        | **unchanged**. Firmware contracts are a sibling module, not new optional members on `RadioDescriptor`                                                        |
| `src/integrations/radio-io/registry.ts`                                                                  | codeplug descriptors                                                        | **unchanged**. A separate `firmware/registry.ts`                                                                                                              |
| `src/integrations/radio-io/radios/dm32uv/index.ts`, `radios/at-d890uv/index.ts`                          | codeplug exports                                                            | export the radio's `FirmwareUpdaterDescriptor` for the firmware registry only                                                                                 |
| `src/core/radios/baofeng/dm-32uv/`, `src/core/radios/anytone/at-d890uv/`                                 | `limits.ts` (+ helpers)                                                     | `+ firmware.ts` (3.2). `limits.ts` unchanged                                                                                                                  |
| `src/app/App.tsx`                                                                                        | no firmware route                                                           | `{ path: '/firmware', element: <FirmwareFlasherPage /> }` outside `RequireActiveProject`                                                                     |
| `src/app/nav/contextualStripItems.ts`                                                                    | Tools strip: Maidenhead, Band plan, Tracking, Propagation                   | `+ { label: 'Firmware flasher', to: '/firmware' }`; the resolver maps `/firmware` to the Tools strip                                                          |
| `src/app/routes/reference/ReferenceIndexPage.tsx`                                                        | Tools panel links                                                           | `+` a Firmware flasher link (if the panel lists the strip tools; check when implementing)                                                                    |
| `src/app/hooks/useUnsavedNavigationGuard.ts`                                                             | used by write flows                                                         | reused as is                                                                                                                                                  |
| `src/app/hooks/useScreenWakeLock.ts`                                                                     | n/a                                                                         | new                                                                                                                                                           |
| `src/app/components/v2/ProgressModal`                                                                    | write/verify modal                                                          | reused. The firmware page passes phase steps; `onRetry` is restart-from-update-mode, not a resend                                                            |
| `src/app/services/radioWriteEnvGate.ts`                                                                  | prod gate for codeplug Write                                                | **unchanged and not used** by firmware (decision #4)                                                                                                         |
| `src/app/services/radioIoSession.ts` `grantRadioSerialPortForEgress`                                     | egress port grant                                                           | **unchanged**. Firmware has its own `grantFirmwarePort` with filters                                                                                          |
| `.prettierignore`                                                                                        | ignores native-yaml fixtures                                                | `+ src/core/firmware/releases/**/*.patch.json`, `+ src/core/firmware/**/__fixtures__/**/*.json`                                                             |
| `.gitattributes`                                                                                         | `* text=auto`                                                               | `+ *.patch.json -text`                                                                                                                                         |
| `DESIGN.md`                                                                                              | no firmware                                                                 | new **Firmware flashing** section (Appendix A); Glossary terms; Non-goals: "hosting, mirroring or proxying vendor firmware"; revision-log row (#1359)          |
| `AGENTS.md`                                                                                              | Working principles 1 to 10                                                  | `+` one principle: "Firmware flashing: never vendor bytes; interlocks are code. See DESIGN.md — Firmware flashing" ([OQ13](#open-questions))                 |
| `docs/features/radio-read-write/adding-a-radio-adapter.md`                                               | codeplug adapter checklist                                                  | `+` an optional **Firmware updater** section (descriptor, guarded send, interlocks, mock, tier-3 `firmware.md`)                                             |
| `docs/features/radio-read-write/README.md`                                                               | status table                                                                | `+` a row linking the firmware-flashing hub                                                                                                                    |
| `docs/features/modded-firmware/README.md`                                                                | MM9PDY codeplug targets                                                     | `+` "Getting the firmware onto the radio" link to the firmware-flashing hub                                                                                  |
| `docs/features/README.md`                                                                                | feature index                                                               | `+ firmware-flashing` row                                                                                                                                      |
| `docs/reference/radios/baofeng/dm-32uv/README.md`, `.../anytone/at-d890uv/README.md`                     | doc maps                                                                    | `+ firmware.md` row                                                                                                                                            |

## Migration

No persisted-schema impact: nothing is stored in IndexedDB, localStorage or the project. The only repo-level "migration"
is the `.prettierignore` / `.gitattributes` hygiene in 3.5. It must land in the same PR as the first bundled patch,
or `npm run format` breaks the catalog test.

---

## Test fixtures and the owner's example patch files

**No vendor bytes anywhere.** Apply tests build a **synthetic** stock package in memory, with seeded random bytes:

- DM-32: a fake 0x100 header starting `BFUV32-V2`, with `END` at `0xFD`;
- D890: a fake `.spi` (`u32 0x20`, count 1, total), a fake 278-byte `.CDI` entry at `0x0800C000`, and a `.CDD` with a
  plausible vector table, as in `test_d890update.py` `synth()`.

A test-only port of each repo's `make` (`patch/formats/<name>/__fixtures__/makeSyntheticPatch.ts`) produces matching
patches with hashes computed on the fly. Synthetic stock descriptors are passed in, never the real
`firmware.ts`, because the real pins can't be matched without vendor bytes.

Where the owner's example patch files go:

| What the file is                                                                              | Put it in                                                                                     | Used for                                                                                                                                                     |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A published release that should ship in Studio (final or RC), byte-exact from the release assets | `src/core/firmware/releases/<radioId>/<tag>.patch.json` (`baofeng-dm32uv/`, `anytone-at-d890uv/`) + an index row | The product catalog. `catalog.test.ts` checks sha256 against `SHA256SUMS`, schema and pinned stock                                                         |
| A real patch that should **not** ship (an old RC, a dev build), kept for parser and identify tests | `src/core/firmware/patch/__fixtures__/<patch-name>/<file>.patch.json`                           | `parseFirmwarePatch` against real-world shape; the user-patch "unreviewed" path; the "matches bundled" path (a copy of a bundled file under a different name) |
| Deliberately broken variants (bad hex, a gap, wrong `name`, a different stock hash)            | Generated in-test from the above, not committed                                                | Refusal paths                                                                                                                                                |

Real patches can't be apply-tested in CI (no stock). The owner can run a **local, uncommitted** check: a Vitest case
gated on an env var (`CODEPLUG_FIRMWARE_STOCK_DIR`) that applies each bundled patch to stock read from outside the
repo and compares result hashes. It is skipped in CI, the way the firmware repos skip stock-dependent tests when
`vendor/` is absent. Both kinds of committed `*.patch.json` are covered by the `.prettierignore` / `.gitattributes`
rules above.

---

## Delivery order (constraints for the planner)

This is not a phase plan. These are the ordering constraints the design implies:

1. **DESIGN.md section first** (#1359), from Appendix A. It is the gate for everything else.
2. **Core foundations in parallel:** stock pins and `resolveStockFirmware` (#1360); both patch formats (#1361); the
   `FirmwareUpdater` seam, transport filters, interlock error and DM-32UV updater with its mock (#1363). None depend on
   each other beyond `src/core/firmware/types.ts`, so whichever lands first owns that file.
3. **D890 throughput spike early,** right after the seam exists and before the D890 updater is finished or any UI is
   built (3.9 steps 1 to 3). It is read-only on hardware. Its result decides whether #1364 needs pipe work.
4. **DM-32UV first, end to end.** The first shippable wizard can be **DM-32UV, stock target only**. It needs only
   #1360 + #1363 + the wizard, and it proves the riskiest app pieces (port re-pick, wake lock, navigation block,
   recovery screen) on the shorter protocol. The catalog (#1362) then adds bundled releases and user patches to the same
   wizard. This is earlier than the epic's dependency table, where #1365 waits on #1362 (see Ticket alignment).
5. **AT-D890UV second:** updater (#1364), then enable it in the wizard. The hardware stock flash for D890 (#1366
   acceptance) must happen before the docs call Studio's stock flash the D890 recovery route.
6. **Docs ship with each slice:** tier-3 `firmware.md` with #1360/#1363/#1364; the feature hub with the first wizard
   PR, including its implementation-status table.

---

## Ticket alignment (#1359 to #1366)

| Ticket | Design section | Fit | Mismatch or gap to flag (not edited) |
| ------ | -------------- | --- | ------------------------------------ |
| #1359 DESIGN.md + plan | Appendix A, this doc | Matches | None |
| #1360 stock pins + StockSource | 3.1, 3.2, 3.3 | Matches | It says "vendor download page URL". Both pinned URLs are **direct zip URLs** (S3 object; dealer `/Files/` path), not pages. Cosmetic. The design adds `stock-is-patched` and `stock-wrong-radio` diagnostics, both within the ticket's error list |
| #1361 patch apply | 3.4 | Matches | It says "port the test cases from each repo's `fw/test_make_patch.py` (synthetic images)". The **D890 tests use the real stock package** (`stock.stock_dir()`, pinned hashes), so they need re-deriving onto synthetic packages, not porting as-is |
| #1362 catalog + user patch source | 3.5 | Matches, with additions | (a) The index row's **release-notes link** points at private repos, so operators get a 404: [OQ4](#open-questions). (b) The raw-bytes loading decision ([OQ7](#open-questions)). (c) The required `.prettierignore` / `.gitattributes` hygiene is not in the ticket. (d) Bundling patches in the **public** Studio repo has the legal implication in [OQ1](#open-questions) |
| #1363 seam + DM-32 updater | 3.7, 3.8, 3.10 | Matches | (a) It names `tools/cps/cps_fw_frames.py` as the mock to port. The **mock is `tools/flash/bootloader_mock.py`**; `cps_fw_frames.py` is the CPS frame model, used for golden-frame checks. (b) Hardware acceptance "Device Info shows its tag" **is false for DM-32UV 1.0.0**: Device Info still shows Baofeng's `DM32.01.L01.048`, and a version row is planned for a later firmware release (`docs/guides/features.md` section 6). Verification must be per release (`verifyHint`). (c) Scope also covers the transport `filters` option and the `'interlock'` error code |
| #1364 D890 updater | 3.9, 3.10 | Matches | (a) The spike's "dry-run handshake on hardware" **cannot measure throughput**: no data frames are sent. The design uses read-only app-mode round trips as the hardware proxy. (b) The proposed band-byte interlock is stricter than the Python sender ([OQ3](#open-questions)) |
| #1365 wizard | UI changes, 3.12 | Matches | (a) "Done: check Device Info shows \<tag\>" needs to come from the per-release `verifyHint` (DM-32 issue above). (b) "Link to the Backup tab": the Backup tab needs a project and a build ([OQ11](#open-questions)). (c) Wake lock is new (`useScreenWakeLock`). (d) It depends on #1362 in the epic table, but a stock-only DM-32 wizard could ship before #1362 (Delivery order 4) |
| #1366 flash stock | 3.11 | Matches | Its DM-32UV acceptance ("stock flashed from Studio, radio boots stock") is **the same hardware test as #1363's first acceptance step**: partial overlap, not redundant. Its real unique content is the picker entry, the recovery docs and the **D890 hardware stock proof**, which needs #1364, not just #1365 |

**No missing ticket is required.** Possible follow-ups outside this epic, flagged not filed:

- DM-32UV post-flash read-back verify. Studio already sends `0x47` only for the factory sector
  (`DM32_FACTORY_SECTOR_READ_FRAME`); reading the app region back to compare against the flashed image would be new
  `0x47` traffic.
- Android support, if [OQ9](#open-questions) keeps it hidden.

---

## Open questions

### Owner decisions (2026-10-21)

| OQ | Decision |
|---|---|
| 1 | **Accept for A (option a).** Bundle the release patches as published, including the hook `original` bytes and the stock gap bytes. Proposal B's legal blocker stays separate and unresolved. |
| 2 | **Revised 2026-10-21: per-radio prod gate.** Each radio's firmware updater carries its own prod-disabled flag (mirroring `prodWriteDisabled` / `radioWriteEnvGate.ts`): hidden on the prod build, fully available on next/dev/staging. Both start disabled; each is flipped in a one-line PR once that radio is proven on hardware, in whichever order that happens. This supersedes "no feature flag" and the earlier "merge D890 unregistered" idea. |
| 4 | **Copy each firmware release's notes into Studio** alongside its patch file. Index rows link to Studio-hosted notes, never to the private firmware repos. |
| 9 | **Defer Android.** The flasher is hidden on Capacitor; flashing a radio from a phone is too risky for now. Android becomes a follow-up. |

Boundary breaches flagged in existing code (direct radio-module imports in app, stale "No backend" wording): **ignore for now** (owner).

OQs 3, 5–8 and 10–14 remain open; the design's proposed defaults stand until the owner says otherwise.

1. **Bundling patches publishes stock bytes and GPL object code (legal; needs an owner call before #1362 merges).**
   The Studio repo is **public** (`pskillen/codeplug-studio`, visibility public) and CC BY-NC-SA 4.0. Bundling release
   patches puts into that public repo, and into the deployed JS:
   - D890 hook `original` fields: stock bytes, used as a check;
   - stock bytes inside merged hook and segment runs: both `make_patch.py` merge differences closer than 16 bytes, so
     unchanged stock bytes between them are carried too;
   - the compiled code of two private GPL-3.0 repos.

   That is a smaller version of Proposal B blocker 1, which the decisions left unresolved for B. Options:
   - (a) accept it for A;
   - (b) Studio ships a **derived** patch with `original` stripped and segments split to remove stock gap bytes. The
     pinned stock hash already guarantees what `original` checks. But the bundled bytes would no longer equal the
     published asset, so `patchSha256` would be Studio's own;
   - (c) take it as a reason to keep the user-supplied-patch path as the only path until the legal question is settled.

   Separately: GPL-3.0 code distributed in a CC BY-NC-SA repo, with the corresponding source private. The owner holds
   copyright on both, so this is a policy question, not a blocker, unless the firmware repos take outside contributions.
2. **Prod availability (carried from the investigation).** Is "first Studio release candidate promoted to prod" meant
   as a **Studio** release (pre-release → staging, then a full release → prod on `codeplug.mm9pdy.net`), not a firmware
   RC? This design assumes yes: no env gate; visible on next, dev and staging once merged; on prod from the next full
   Studio release.
3. **D890 band-byte interlock.** Require `ident[8] === 0x00` (bootloader) before the first data frame? It is stricter
   than `d890update.py`, which does not check it, and is based on two observations (S1/S2 and the CPS capture, F125).
   Recommended: yes. It catches a radio in app mode that somehow accepted `UPDATE`.
4. **Release notes for operators.** The firmware repos are private, so a release-notes URL in the index 404s for
   users. Proposed: a short `summary` and `radioStatus` per index row, written when the release is bundled, plus a
   `docs/features/firmware-flashing/releases.md` page. Or should the firmware repos publish user notes somewhere
   public?
5. **Zip hash versus member hashes.** Proposed: member hashes are authoritative, and a matching set of members is
   accepted even when the zip hash differs (a re-zipped download), with a note. The alternative is to refuse any zip
   whose hash differs, which is stricter but rejects harmless re-zips.
6. **No human pause between ident and flash.** Proposed: one "Connect and flash" action. The final go-ahead is in the
   preflight step, and `flash()` follows a matching `identify()` immediately. Neither bootloader's idle timeout between
   handshake steps is known. Alternative: show the ident and wait for a click, accepting an unknown risk, or restart
   the session after the click (D890 S2 shows a handshake-only session is harmless; DM-32 is unknown).
7. **How bundled patch bytes are loaded.** Proposed: dynamic `import('…/x.patch.json?raw')`, so the runtime re-hashes
   the exact bytes. This is the first Vite import suffix in `src/core`. Alternative: a generated `.ts` file with base64
   strings, plus a script and a test that keep it in sync with the `.json`.
8. **`FirmwareRadioId` values.** Reuse the stock radio-target ids (`baofeng-dm32uv`, `anytone-at-d890uv`), or
   introduce a separate hardware-id vocabulary? Reuse is proposed, to avoid a third naming scheme beside the radio-io
   dir ids (`dm32uv`, `at-d890uv`) and core paths (`baofeng/dm-32uv`).
9. **Android (Capacitor).** #1365 says "works end to end or hidden". The Capacitor plugin surface has no DTR/RTS
   control, which the DM-32 dialect raises. Port choice is `devices[0]`, and update-mode re-enumeration on OTG is
   untested. Proposed: **hidden on Capacitor** in this epic (`capacitorSupported: false`), with Android as a follow-up
   once tested on hardware.
10. **Flash log persistence.** Proposed: summary shown, copyable and downloadable, never persisted (privacy; no
    project). Is a local history of past flashes wanted?
11. **Backup before flashing.** The Backup tab lives at `/builds/:id/backup` and needs an active project with a build
    for that radio. Is a context-sensitive link plus guidance enough, or should the flasher offer a codeplug backup
    itself through the existing `radioBackupRestore` service (bigger scope)? The firmware repos note that a firmware
    write has not touched the codeplug, calibration or factory sector in their tests.
12. **Step indicator component.** A new reusable v2 `Stepper` (sidecar + styleguide demo), or page-local steps?
13. **Agent rules.** Add a short path-scoped rule (`.claude/rules/firmware-flashing.md`, mirrored to `.cursor/rules/`)
    for `src/core/firmware/**` and `**/firmwareUpdate/**`: no vendor bytes in fixtures; interlocks are code; one send
    path. Plus the AGENTS.md principle line? Both are cheap, but the rules are hand-synced across two tool directories.
14. **Releases to seed.** Finals only (`1.0.0` for both radios), or also the current RCs? Both radios' `1.0.0-rc.3`
    became `1.0.0` with only the release name changed, so bundling them adds little.

---

## Files touched (reference for planning)

**core**

- `src/core/firmware/types.ts`, `hash.ts`, `hex.ts`, `errors.ts`, `index.ts` (new)
- `src/core/firmware/stock/resolveStockFirmware.ts`, `stockSource.ts` (+ tests) (new)
- `src/core/firmware/patch/types.ts`, `index.ts` (new)
- `src/core/firmware/patch/formats/baofeng-dm32-firmware/{schema,apply}.ts` (+ tests, `__fixtures__/makeSyntheticPatch.ts`) (new)
- `src/core/firmware/patch/formats/anytone-d890-firmware/{schema,apply}.ts` (+ tests, `__fixtures__/makeSyntheticPatch.ts`) (new)
- `src/core/firmware/patch/__fixtures__/<patch-name>/*.patch.json` (owner-supplied, non-shipping) (new)
- `src/core/firmware/releases/types.ts`, `index.ts`, `bundledSource.ts`, `userPatchSource.ts`, `catalog.test.ts` (new)
- `src/core/firmware/releases/baofeng-dm32uv/1.0.0.patch.json`, `src/core/firmware/releases/anytone-at-d890uv/1.0.0.patch.json` (new, owner-supplied)
- `src/core/services/firmware/prepareFirmwareImage.ts` (+ test) (new)
- `src/core/radios/baofeng/dm-32uv/firmware.ts` (new)
- `src/core/radios/anytone/at-d890uv/firmware.ts` (new)

**integrations**

- `src/integrations/radio-io/firmware/types.ts`, `registry.ts`, `guardedSend.ts`, `errors.ts`, `index.ts` (new)
- `src/integrations/radio-io/radios/dm32uv/firmwareUpdate/{constants,plan,interlocks,updater,descriptor}.ts` (+ tests) (new)
- `src/integrations/radio-io/radios/dm32uv/__fixtures__/dm32BootloaderMock.ts` (new)
- `src/integrations/radio-io/radios/at-d890uv/firmwareUpdate/{constants,package,frames,interlocks,updater,descriptor}.ts` (+ tests) (new)
- `src/integrations/radio-io/radios/at-d890uv/__fixtures__/d890BootloaderMock.ts` (new)
- `src/integrations/radio-io/radios/dm32uv/index.ts`, `radios/at-d890uv/index.ts` (export the firmware descriptor)
- `src/integrations/radio-io/transport/webSerialPipe.ts`, `transport/index.ts` (filters)
- `src/integrations/radio-io/kit/errors.ts`, `kit/index.ts` (`'interlock'`)
- `src/integrations/radio-io/index.ts` (exports)

**app**

- `src/app/routes/firmware/FirmwareFlasherPage.tsx` (+ step components, CSS module) (new)
- `src/app/services/firmwareFlash.ts` (+ test) (new)
- `src/app/hooks/useScreenWakeLock.ts` (+ test) (new)
- `src/app/assets/firmware/<radioId>/` (bootloader-entry illustrations) (new)
- `src/app/components/v2/Stepper.tsx` + `Stepper.md` + styleguide demo (if [OQ12](#open-questions) says yes) (new)
- `src/app/App.tsx`, `src/app/nav/contextualStripItems.ts`, `src/app/routes/reference/ReferenceIndexPage.tsx`
- `src/app/routes/debug/` throughput-spike page (read-only; may be removed after the spike) (new)

**repo**

- `.prettierignore`, `.gitattributes`
- `.claude/rules/firmware-flashing.md` + `.cursor/rules/firmware-flashing.mdc` (if [OQ13](#open-questions) says yes)

**docs**

- `DESIGN.md` (Firmware flashing section, Glossary, Non-goals, revision log)
- `AGENTS.md` (principle line, if [OQ13](#open-questions) says yes)
- `docs/features/firmware-flashing/README.md` (hub: status, map, concepts, recovery) (new)
- `docs/features/firmware-flashing/adding-a-release.md` (maintainer procedure: download, check `SHA256SUMS`, commit byte-exact, index row, run the catalog test) (new)
- `docs/features/firmware-flashing/releases.md` (per-release operator notes, if [OQ4](#open-questions) goes that way) (new)
- `docs/features/README.md` (index row)
- `docs/features/radio-read-write/README.md`, `adding-a-radio-adapter.md`
- `docs/features/modded-firmware/README.md` (cross-link)
- `docs/reference/radios/baofeng/dm-32uv/firmware.md` (stock pin, update protocol, interlocks, recovery; links the firmware repo's `update-protocol.md` by name only, since the repo is private) (new) + `README.md` map row
- `docs/reference/radios/anytone/at-d890uv/firmware.md` (same) (new) + `README.md` map row

---

## Appendix A: Draft DESIGN.md "Firmware flashing" section

> Draft for #1359. Paste into DESIGN.md after "Import and export" (before "Build capability traits"), and add the
> Glossary rows and Non-goals line below it. Product-level only: wire detail stays in tier 3.

```markdown
## Firmware flashing

Studio can flash community **modified firmware** releases, and the vendor's own **stock firmware**, to supported radios
over Web Serial. This is a separate capability from codeplug Write. Firmware belongs to the physical radio, not to a
project, library or build. The flasher needs no open project and stores nothing.

### Rules

1. **Studio never ships, hosts, mirrors or proxies vendor firmware.** No vendor file, image or excerpt goes in the repo,
   the bundle, a test fixture, or any network path Studio controls. Tests use synthetic images.
2. **The user supplies stock firmware** during the session: the vendor zip, or the files extracted from it. The wizard
   shows the vendor's download link as a plain link; Studio never fetches it. The bytes stay in that browser tab's
   memory and are dropped when the user leaves the page.
3. **Everything is pinned by SHA-256.** Each supported radio pins exactly one stock version: the hash and size of every
   file, and the zip hash. A patch applies only to that pinned stock, and its result must match the hashes recorded in
   the patch. Anything else is refused before any radio contact.
4. **Hard interlocks can't be bypassed.** Each radio's updater refuses unsafe images and frames in code, before the
   first byte is sent and again on every write. Examples: address windows that keep away from the bootloader and the
   activation page; a model-ID match with the bootloader's own ident; a stock-length image where the radio requires
   it. No setting, flag, environment value or patch field can switch one off.
5. **One pipeline.** Bundled release, user-supplied patch, and stock all take the same path:
   verify stock → (apply patch → verify result) → interlocks → bootloader ident → flash.
   "Flash stock" is the zero-patch case and is the documented recovery route; the vendor CPS stays the fallback.
6. **Flash is not Write.** Codeplug Write rules, env gates and the build/egress model don't apply to firmware, and
   firmware rules don't apply to Write.

### Patch sources

| Source                | What it is                                                                                                                                         | Trust                                                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bundled releases**  | Release patches copied by hand, byte for byte, from the firmware projects' releases into Studio, with an index row each. Finals are listed by default; release candidates appear behind a "Show release candidates" toggle | Reviewed in a Studio PR. A unit test checks each file's hash, format and pinned stock. A firmware release reaches users only with a Studio release, which is deliberate: Studio chooses what ships |
| **User-supplied patch** | A `.patch.json` the user picks from disk, under an Advanced option, after accepting a risk statement                                            | Unreviewed. The format, stock-hash, result-hash and interlock checks all still apply; Studio can't judge whether the firmware it produces is safe. A file identical to a bundled release is treated as that release. The flash summary records "user-supplied patch, sha256 …" |

### Where things live

| Concern                                                                     | Location                                                                                              |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Pinned stock (version, hashes, file names), update-mode entry, verify hints | `src/core/radios/<mfr>/<model>/firmware.ts`, beside `limits.ts`; human mirror `docs/reference/radios/<mfr>/<model>/firmware.md` |
| Patch formats (pure apply, one module per patch format), release catalog, `prepareFirmwareImage` | `src/core/firmware/`, `src/core/services/firmware/`                                                     |
| Bootloader update protocols and hard interlocks (`FirmwareUpdater`)        | `src/integrations/radio-io/radios/<id>/firmwareUpdate/`                                               |
| Flasher wizard and thin orchestration                                       | `src/app/` (route `/firmware`, under Tools)                                                           |

Generic firmware code works on hashes and file roles only. File formats, offsets and wire bytes stay in the per-format
and per-radio modules.

### Future direction: runtime fetch (not planned)

Studio could list firmware releases at runtime from the firmware projects, and offer a one-click stock download through
a fixed-URL streaming proxy, keeping the file picker as a fallback. The pipeline has seams for it (`FirmwareReleaseSource`,
`StockSource`), so it would add sources without changing verification or flashing. It is blocked by:

- **Legal: opening the firmware repositories.** Runtime fetch needs them public. That would publish the
  reverse-engineering record and patches containing small runs of stock bytes, which is an unresolved gray area.
- **Legal: relaying vendor firmware.** A proxy that stores nothing still serves vendor binaries from Studio's domain.
  That is a weaker position than the user downloading the file from the vendor.
- **Mechanical:** the repos must be public; release-asset redirects may not be fetchable cross-origin; vendor hosts send
  no CORS headers, so stock needs a proxy; vendor URLs aren't versioned; streaming large zips through Pages Functions
  is unproven.
- **Selectivity:** listing every tagged release at runtime undoes "Studio chooses what ships", unless the firmware
  projects publish a curated index.
```

Glossary rows to add:

```markdown
| **Flash** (firmware)            | Writing a firmware image to a radio's program flash through its bootloader. Distinct from codeplug **Write**. |
| **Stock firmware**              | The vendor's firmware for the one version Studio pins per radio. Supplied by the user; never shipped.          |
| **Firmware release (patch)**    | A firmware project's tagged release, shipped as a JSON patch applied in the browser to pinned stock.          |
| **Hard interlock**              | A radio-side safety refusal in an updater, enforced in code before any byte is sent. Not configurable.        |
```

Non-goals line to add: "Hosting, mirroring or proxying vendor firmware; building firmware in the browser; bootloader
or activation-page writes."

Revision-log row: `| <date> | Firmware flashing: user-supplied stock, bundled and user-supplied patches, hard interlocks ([#1359](https://github.com/pskillen/codeplug-studio/issues/1359)) |`

---

## Appendix B: Corrections to the investigation notes

These were checked against the firmware repos while writing this doc. The `tmp/` notes are not edited.

| findings.md says                                                       | Source says                                                                                                                                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DM-32UV volume "about 840 blocks. Seconds, not minutes"                | 840 STX blocks, 1,688 frames, but a write takes **about two minutes** (CPS and our sender), including a 12.6 to 13 s erase (`docs/guides/flashing.md` sections 5 and 6)                           |
| Wizard "Done: check Device Info shows \<tag\>" (both radios)           | True for AT-D890UV (`docs/user/install.md` section 7). **False for DM-32UV 1.0.0**: Device Info shows `DM32.01.L01.048` whatever is installed (`docs/guides/features.md` section 6)               |
| "Gating: `radioWriteEnvGate.ts`" listed under radio-io                 | It is `src/app/services/radioWriteEnvGate.ts`, not under `src/integrations/radio-io/`                                                                                                             |
| D890 ident "byte 8: `00` = bootloader, `03` = app"                     | Confirmed (runbook S1/S2), but `d890update.py` **does not check it**; it compares only model `[1..8)` and version `[9..13)` with the `.spi`                                                       |
| #1363 / findings: DM-32 mock from `tools/cps/cps_fw_frames.py`         | The mock is `tools/flash/bootloader_mock.py`; `cps_fw_frames.py` is the CPS frame model                                                                                                           |
| `dm32_fw_send.py` docstring "NEVER RUN ON HARDWARE"                    | Stale in the firmware repo. `tools/flash/README.md` (2026-10-19) records one hardware write of stock 048                                                                                           |
| `docs/features/radio-tools/update-sender.md` (D890) "not run"          | Stale in the firmware repo. `docs/user/install.md` and `releases.md` record our sender writing rc.2 and rc.3                                                                                      |
