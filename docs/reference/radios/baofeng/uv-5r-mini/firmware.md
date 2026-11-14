# Baofeng UV-5R Mini — firmware

Facts the firmware flasher needs for the UV-5R Mini: the stock firmware files Studio accepts (one per stock base), and the release patch
format that turns it into a modded build. Product rules: [DESIGN.md — Firmware flashing](../../../../../DESIGN.md#firmware-flashing).

**Code mirror:** [`src/core/radios/baofeng/uv-5r-mini/firmware.ts`](../../../../../src/core/radios/baofeng/uv-5r-mini/firmware.ts)
(`UV5RMINI_STOCK_FIRMWARE`, `UV5RMINI_FIRMWARE_ROLE_UFW`), the base table in
[`firmwareUpdate/constants.ts`](../../../../../src/integrations/radio-io/radios/uv5r-mini/firmwareUpdate/constants.ts) (`UV5RMINI_BASES`) and
[`src/core/firmware/patch/formats/baofeng-uv5rmini-firmware/`](../../../../../src/core/firmware/patch/formats/baofeng-uv5rmini-firmware/).
Keep them in step.

## Stock firmware pin

A stock base is one `.ufw` file, member role `ufw`; Studio accepts two bases. The pinned hash, not the user, decides
whether a file is accepted, and a radio whose key doesn't match the file refuses it before anything is written.

| Base         | Version        | File name              | Size          | sha256                                                             |
| ------------ | -------------- | ---------------------- | ------------- | ------------------------------------------------------------------ |
| `nrf-v0.27`  | `v0.27 (NRF)`  | `stock-nrf-v0.27.ufw`  | 504,832 bytes | `811b4b37253e0685c7efbd3ff0a24aac2bcad223e5453d95b5bfc3f42c089128` |
| `nrfb-v0.04` | `v0.04 (NRFB)` | `stock-nrfb-v0.04.ufw` | 520,192 bytes | `02419efb44081227faeccf1525bca0e6b0340c9d988ab80b2141c2ee48a7f74e` |

**Where the file comes from.** Baofeng publishes no stock firmware for the Mini. The Stock firmware step lists, in
order:

1. **Your own copy:** "If you already have the stock file for your radio's firmware, drop it below. Studio checks it
   against the pinned hash and refuses any other file."
2. **Unofficial copy shared by a third party, stock v0.27 (NRF):** a link to `stock-nrf-v0.27.ufw` on mega.nz.
3. **Unofficial copy shared by a third party, stock v0.04 (NRFB):** a link to `stock-nrfb-v0.04.ufw` on mega.nz.

Each unofficial link is marked "Unofficial, not run by the vendor. Studio checks every file against the pinned hashes
before using it." and says that Studio only links to it and never downloads it. The host decrypts the file in the
browser, so there is no direct URL Studio could fetch; Studio never fetches, hosts, mirrors or commits a stock file.
The links live in one constant, `UV5RMINI_UNOFFICIAL_STOCK_COPIES` in `firmware.ts`: a dead link is a one-line change
there, and a test checks that no other source file holds them. A download source names the file its link gives
(`fileName`), so each link reads as its own stock file.

The pre-flight asks for a full battery and a dummy load only; there is no "built from this radio" check, since the
pin decides the file.

Studio does not flash the plain stock file (`stockFlashOffered: false`); the pins are the bases a release patch is
checked against. The way back to stock is a to-stock patch (below). Each base's name is on the descriptor
(`baseName`), matching the base table's keys.
The patch's `stock` hashes decide which file is the stock, never a user choice, and a patch's `base` must name the
base whose file hashes to it. The descriptor carries `nrf-v0.27` (the stock of the MM9PDY firmware's 1.0.0 release)
as its primary version, so the wizard names it first, and `nrfb-v0.04` as `alsoAccepts`.

**One stock per base.** A radio's code base never changes, so a release's `L1` file is built on `nrfb-v0.04` and its
`L2` file on `nrf-v0.27`. The descriptor sets `severalStocks`: the Stock firmware step takes either file or both at
once, each verified against its own pin (`VerifiedStockFirmware.others` holds the second). Prepare builds each patch
on the stock its own `base` names (`verifiedStockForBase`), so a retry's same-suffix file (see Retry partner below)
is built on its own stock, not the first file's. A file whose base wasn't supplied is refused before anything is
built: "This file is built on stock v0.27 (NRF), which wasn't supplied. Add stock-nrf-v0.27.ufw at the Stock firmware
step."

The `nrf-v0.27` file carries **no loader** (`ota.bin` is `0x200` bytes of `0xFF`), by design. A file is accepted as a
stock base with no loader only when `ota.bin` is blank; anything else in `ota.bin` must still be a well-formed loader
entry. An image to flash never gets this allowance: it must carry a pinned loader (see Loader below).

## Release patch format

A release is a JSON patch (`uv5rmini-fw-<name>.patch.json`) over the stock `.ufw`: ordered in-place edits, a cut and
appended bytes, with SHA-256s pinning the stock and the result. It carries no original bytes: the stock hash pins them.
Source of truth: the firmware project's `docs/reference/patch-format.md` and `tools/make_patch.py`, and its synthetic
conformance vector, which Studio's tests apply (`__fixtures__/conformanceVector.json`) so both reach the same bytes.
Studio's port is `src/core/firmware/patch/formats/baofeng-uv5rmini-firmware/`.

```json
{
  "name": "baofeng-uv5rmini-firmware",
  "format": 1,
  "version": "mm9pdy-pr112-g1a2b3c4",
  "base": "nrfb-v0.04",
  "stock": { ".ufw": { "sha256": "<64 lowercase hex>", "size": 0 } },
  "result": { ".ufw": { "sha256": "<64 lowercase hex>", "size": 0 } },
  "build": { "name": "mm9pdy-pr112-g1a2b3c4", "appSize": "0x77d1c", "appCrc": "0x55e1" },
  "loader": { "sha256": "<64 lowercase hex>", "list": ["nrfb-v0.04", "mm9pdy-0.1.0-rc.1"] },
  "edits": [{ "offset": 0, "hex": "00" }],
  "truncate": 0,
  "append": ""
}
```

| Field      | Type                                    | Meaning                                                                                      |
| ---------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `format`   | `1`                                     | Anything else is refused as an unknown format                                                |
| `name`     | `"baofeng-uv5rmini-firmware"`           | Selects this format module                                                                   |
| `version`  | text                                    | The release label; display only                                                              |
| `base`     | text                                    | The stock base's name. Descriptive                                                           |
| `stock`    | `{ ".ufw": { sha256, size } }`          | The stock file the patch was made from. Exactly the one key `.ufw`, which maps to role `ufw` |
| `result`   | same shape as `stock`                   | The file the patch must produce                                                              |
| `build`    | `{ name, appSize, appCrc }`             | The image's version slot and app directory entry. Descriptive                                |
| `loader`   | `{ sha256, list }`                      | The packed loader the image carries and the builds its list names. Descriptive               |
| `edits`    | list of `{ offset, hex }`               | In-place writes, ascending, non-empty, non-overlapping, each inside `[0, truncate)`          |
| `truncate` | whole number                            | Length the copy is cut to, at most the stock size                                            |
| `append`   | lowercase even-length hex, may be empty | Bytes added after the cut                                                                    |

**Apply** (pure: the input is never changed, and nothing comes out unless every check passes):

1. Check the stock file's size and SHA-256 against `stock`.
2. Copy it.
3. Write each edit in place.
4. Cut to `truncate`.
5. Append `append`.
6. Check the result's size and SHA-256 against `result`.

With the same loader the usual patch cuts at the stock size and appends nothing. When the loader changes, the patch cuts
earlier and appends the replacement.

**Caps:** the result is at most 1 MiB (1,048,576 bytes) and a patch has at most 4096 edits. Hex is lowercase; so are
all hashes.

**Refusals** (`patch-malformed` unless noted):

- `name` or `format` wrong (an unknown name or format number is `patch-unknown-format`).
- `stock` or `result` not exactly the one key `.ufw`; a missing or mistyped field.
- Bad hex (odd length, non-hex characters, uppercase); an uppercase hash.
- An empty edit; an edit outside `[0, truncate)`; edits out of order or overlapping.
- `truncate` longer than the stock size; a result over 1 MiB; more than 4096 edits.
- `build.name` not 1 to 21 printable ASCII characters with no space; `appSize` or `appCrc` not a `0x` hex number;
  `loader.sha256` not 64 lowercase hex characters; `loader.list` not a list of such names.
- The stock file's size or hash differs, or the package holds anything but the one `ufw` file: `patch-wrong-stock`.
- The result's size or hash differs from the recorded one: `patch-result-mismatch`.

`build`, `loader` and `base` are checked for shape only. They are exposed on the parsed patch for the image checks that
come later, and are never used to relax any check above.

`readVersionStamp` returns `build.name`: the image's version slot is scrambled per radio, so Studio cannot read it back
from the result.

## What Studio checks

- **Patch format (above):** everything in the refusal list, in the parser and in `apply`.
- **Image checks (below):** the checks on the built image itself, which are not part of the format.

## What Studio checks before flashing

Hard interlocks on the image, in code, with no setting, flag or patch field that turns one off. They run when the
image is prepared and again as the flash starts; each refusal says nothing was sent. The one exception is the
"already installed" warning for a layout loader, which the operator passes with an explicit confirm (below). Code:
`src/integrations/radio-io/radios/uv5r-mini/firmwareUpdate/` (`interlocks.ts`, `ufw.ts`, `constants.ts`).

| Check             | Refused unless                                                                                                                                                                                                                                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target            | The image is for the UV-5R Mini and the package is exactly one `ufw` file                                                                                                                                                                                                                                                                                |
| Known build       | The image has a build name (the patch's `build.name`) and is not the plain stock image, which its own loader lists                                                                                                                                                                                                                                       |
| Container         | The `.ufw` header CRC, file-table CRC and each file's data CRC are good; it holds exactly `flash.bin` (type 0) and `ota.bin` (type 100), both inside the file                                                                                                                                                                                            |
| Loader            | `ota.bin` holds exactly one entry, `uart_user.bin`, attribute `0x41`, with good CRCs, and the SHA-256 of the packed loader is on the pinned list below                                                                                                                                                                                                   |
| Base              | The patch's `base` names a base in the table below, and the verified stock hashes to that base's stock file                                                                                                                                                                                                                                              |
| Area              | `flash.bin` starts at SoC address `0x1000` and ends at or below the base's area end (`0x7C000` for both bases), never past the base's own hard limit (the start of its first per-unit record sector)                                                                                                                                                     |
| Stock bytes       | `flash.bin` has the stock's length and every byte equals the stock's at the same address, except inside the base's app windows (SoC, half-open), from the table below                                                                                                                                                                                    |
| Layout            | For a layout loader (`L1`, `L2`): Studio knows the radio's flash layout and it is the loader's. Checked before anything is sent                                                                                                                                                                                                                          |
| Code base         | The image's `base` is the radio's own code base: the one its [radio report](#the-radio-report) names (`radioCodeBase`), or without a report the base whose stock runs on the radio's layout (`L1` is `nrfb-v0.04`, `L2` is `nrf-v0.27`). Studio never changes a radio's code base. When Studio knows neither, the image is refused. Checked after Layout |
| Not listed itself | For a list-carrying loader only: the image's build name is not on its loader's list. Flashing it again, or after a cut update, would leave the radio stuck in its loader                                                                                                                                                                                 |
| To stock          | For a to-stock image (build name is a base's own name): see [Back to stock](#back-to-stock). Its loader and stock-byte rules replace the general ones above, never loosen them                                                                                                                                                                           |
| Already installed | Checked last. For a list-carrying loader: the build name the radio gives in its [radio report](#the-radio-report), trimmed and compared ignoring case, is not the image's own. For a layout loader this is a warning with an explicit confirm, not a refusal: see [Already installed](#already-installed)                                                |

**Bases** (keyed by the patch's `base`; the windows are SoC half-open ranges, both also hold `[0x4000, 0x4004)` and `[0x4020, 0x4024)`):

| Base         | App window          | Hard limit (record sector) |
| ------------ | ------------------- | -------------------------- |
| `nrfb-v0.04` | `[0x4100, 0x7BE1C)` | `0x94000`                  |
| `nrf-v0.27`  | `[0x4100, 0x7BBC8)` | `0x93000`                  |

The hard limit comes from each base's flash layout, never from one shared constant. A base built on another (a stock
file plus a small layout patch) is one more row, with its own stock hash, windows and limit.

The stock comparison needs no key: the image is scrambled by an address-keyed XOR, so equal stored bytes at an address
are equal plain bytes. Studio never descrambles anything. The stock bytes come from the image's own verified stock
(`PreparedFirmwareImage.stockPackage`); an image without them is refused.

**Pinned loaders** (SHA-256 over the packed loader bytes). Two kinds:

- **Layout loaders**, one per flash layout. They carry no list of builds. Before it erases the firmware area, each one
  checks the radio's installed VM, PRCT and BTIF directory entries against its own 16-byte layout record, and refuses a
  radio of the other layout with result `0x8F`. By then the stock app's update stage has already reset the FM presets
  and volume (below). Each loader always builds to the same bytes, so its packed hash is its pin.
- They **always write**: every install erases and rewrites the firmware area from `0x4000` to the end of the image, even
  when the radio already holds the same build, is on the same stock, or has a damaged app. So the image's length is
  what bounds the erase, and the Area and Stock bytes checks keep every image the stock's length, ending at or below the layout's area end
  (`0x7C000`): a longer image is refused, and so is one of any other length than the stock's.
- **List-carrying loaders**: the older loaders, each with a list of the builds it may install. They stay pinned so that
  images already built on them still pass the checks.

| Loader | Packed SHA-256                                                     | Raw / packed size   | Layout record: VM offset, VM size, VM / PRCT / BTIF header CRCs |
| ------ | ------------------------------------------------------------------ | ------------------- | --------------------------------------------------------------- |
| `L1`   | `b314ace5106ed3b5ec67846b38d7bf8e65415824343b24650622efb8bdc604dd` | 17,904 B / 15,648 B | `0x95000`, `0x68000`, `0x06D9` / `0xD9BB` / `0xF13A`            |
| `L2`   | `1e6c3e0d563a50f38caa2972c773ccdff99aa875c1e9098cc923be1cb5b6193e` | 17,904 B / 15,648 B | `0x94000`, `0x6A000`, `0x2074` / `0x48F9` / `0xF13A`            |

**Retired loaders.** The first layout loaders wrote nothing when the radio already held the image's build, and with
Studio's short images that ended in a read past the file. Studio no longer sends them. An image built with one is
refused: "This image was built with an older loader that Studio no longer sends. Use a newer build of this firmware.
Nothing was sent." (`UV5RMINI_RETIRED_LOADERS`)

| Loader         | Packed SHA-256                                                     |
| -------------- | ------------------------------------------------------------------ |
| `L1-nolist-v1` | `b748e39af6caa7968a7eb74099e35dce0714876a0949a70d9279adc870ed7e09` |
| `L2-nolist-v1` | `2f1b8999ea6dcc858ef076b20564e0339c1fb665add46efdafc4bd40222aadae` |

**List-carrying loaders.** These keep their pin. An image built with one gets the "already installed" refusal only on a
radio whose [radio report](#the-radio-report) names the image's build. A radio with no report (every build on these
lists is from before the report) names no build, so that refusal can't fire; the runtime `alreadyInstalled` stop
(`RadioAlreadyInstalledError`, below) is then what stops a same-build flash.

| Loader        | Packed SHA-256                                                     | Lists                                                      |
| ------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `stock`       | `5382ce4d20dfc7a57cb2a86c836dbbe8c46f6f02625f6f91675df88066e9acb4` | `nrfb-v0.04`                                               |
| `stock+c4`    | `87f53dec40c4335ec0c38734c7e3ee08af8847e795da15068f5c9ba876939867` | `nrfb-v0.04`, `mm9pdy-0.1.0-rc.1`                          |
| `stock+c4+w1` | `3ec9a37db41f98bcf9e2b2a75200fd3450ac48807860470f5ca11b08a11724e8` | `nrfb-v0.04`, `mm9pdy-0.1.0-rc.1`, `mm9pdy-pr125-g1c0a9df` |

**Layout match.** `L1` and `L2` are the factory firmware's flash packing, not the board: firmware version and board
variant are separate things. The radio's stock app runs the first stage of an update ("UPDATE..."), before any
loader. Sent a file for the other layout, that stage already loses some of the radio's settings (its FM presets and
volume) before the loader can refuse. So Studio checks the layout itself, before it sends anything. For an image whose
loader is `L1` or `L2`, the radio's layout must be on the prepared image (`PreparedFirmwareImage.radioLayout`, passed
to `prepareFirmwareImage` as `radioLayout`; from the radio report or Radio Info, below):

- the layouts differ: "This file is for the other flash layout; nothing was sent."
- no layout given: refused, because Studio can't check the file is for this radio.

A list-carrying loader's image ignores the layout, but not the code base the layout implies.

**Code base.** A radio's code base never changes: every build goes on the code base its radio shipped with, so an
`L1` radio gets a v0.04 file and an `L2` radio a v0.27 file. Studio refuses any image that would move a radio between
them: "This file is built on nrfb-v0.04, but this radio runs the nrf-v0.27 code. Studio never changes a radio's code
base. Nothing was sent." With a report, its suffix and Firmware strings decide the radio's code base; without one, its
layout does. There is
no override in Studio.

**One file per layout.** A release ships an `L1` file built on v0.04 and an `L2` file built on v0.27, with build names
`mm9pdy-L1-<version>` and `mm9pdy-L2-<version>`; a release may ship only one of them. The release index lists them as
rows of one version, each with its `layout`
([releases](../../../../features/firmware-flashing/releases.md#uv-5r-mini-rows-one-per-flash-layout)), and the
patch-file dropzone takes both files at once. Prepare picks the file for the radio's layout and base (`pickPatchForLayout`).
A release with no file for the radio's base stops Prepare before anything is built: "Not available in this release:
there is no MM9PDY build for this radio (nrfb-v0.04) yet. This release has a file only for nrf-v0.27." `V4` (`mm9pdy-V4-…`) is
retired: never a release row, and refused from disk. The build-name rule is `uv5rMiniLayoutFromBuildName` in
`src/core/radios/baofeng/uv-5r-mini/firmware.ts`.

### The radio report

An MM9PDY build that carries the radio report answers one clone read with its own facts. It is the firmware
project's interface, read-only: one 64-byte `R` at clone address `0xEFC0`, decoded with the clone XOR rule Studio uses
for every read below `0xF000`. Studio never writes there (the clone write interlock refuses everything from `0xE000`
up). Studio reads format 2 only; no radio carries format 1. Integers are little-endian:

| Offset | Size | Field      | Value                                                                                                           |
| ------ | ---- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| `0x00` | 4    | magic      | `MM9R`                                                                                                          |
| `0x04` | 1    | format     | `2`. The magic, format and CRC keep their places in every later format                                          |
| `0x05` | 1    | flags      | Bit 0: set exactly when the strings below read `NRFB` / `V0.04` / `V1.7`, a cross-check. Bits 1–7 reserved, `0` |
| `0x06` | 2    | reserved   | `0`                                                                                                             |
| `0x08` | 4    | `vm_start` | Start of the radio's `VM` entry: `0x95000` on `L1`, `0x94000` on `L2`                                           |
| `0x0C` | 4    | `vm_size`  | Size of the `VM` entry: `0x68000` on `L1`, `0x6A000` on `L2`                                                    |
| `0x10` | 4    | `vm_bank0` | Where the app's settings store put its first bank; equal to `vm_start` on a sane store                          |
| `0x14` | 2    | `rf0`      | The RF chip's register 0                                                                                        |
| `0x16` | 2    | reserved   | `0`                                                                                                             |
| `0x18` | 24   | `name`     | The build name, ASCII, at most 21 characters, NUL-padded                                                        |
| `0x30` | 4    | suffix     | The suffix the hold-8 start-up screen shows after `5RMINI` (`NRF`, `NRFB`), NUL-padded                          |
| `0x34` | 5    | version    | Radio Info's Firmware line (`V0.27`, `V0.04`), NUL-padded                                                       |
| `0x39` | 5    | hardware   | Radio Info's Hardware line as the stock firmware stores it (`V1.7 `, with its trailing space), NUL-padded       |
| `0x3E` | 2    | `crc`      | CRC-16/XMODEM (poly `0x1021`, init `0`) of bytes `0x00–0x3D`                                                    |

The build reads the three strings from the stock firmware's own text, so they are what that radio's stock screens
show. Each is read as its bytes with trailing NULs and spaces removed; what is left must be at least one character,
all printable ASCII, and is compared exactly, case included.

What Studio concludes (`decodeUv5rMiniRadioReport`, then `uv5rMiniLayoutFromReport`, in
`src/core/radios/baofeng/uv-5r-mini/radioReport.ts`), rule by rule in this order:

| The 64 bytes                                                                      | Studio                                                                                                        |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Not 64 bytes                                                                      | Refused: "This radio's MM9PDY report doesn't read right: …. Nothing was sent."                                |
| No `MM9R`, or a bad CRC                                                           | No report: a stock radio, or an MM9PDY build from before the report. Radio Info is asked                      |
| A format other than `2` (`1` included)                                            | Refused by name: "…answers in report format N, which this version of Studio doesn't know…"                    |
| A reserved flags bit set                                                          | Refused: "…doesn't read right: a reserved flags bit is set…"                                                  |
| A string empty or not printable                                                   | Refused, naming it: "…doesn't read right: its Hardware string is unreadable…"                                 |
| Bit 0 set and the strings aren't `NRFB` / `V0.04` / `V1.7`, or clear and they are | Refused: "…doesn't read right: its NRFB V0.04 flag disagrees with its suffix, Firmware and Hardware strings…" |
| `(vm_start, vm_size)` neither `(0x95000, 0x68000)` nor `(0x94000, 0x6A000)`       | Refused as unsupported: "This radio reports a flash layout Studio doesn't support…"; nothing sent             |
| `(0x95000, 0x68000)` / `(0x94000, 0x6A000)`                                       | `L1` / `L2`, then the strings pick the stock base (below)                                                     |

**The stock base.** The strings are looked up in the same table the [Radio Info](#radio-info) answers use
(`src/core/radios/baofeng/uv-5r-mini/stockBases.ts`), with the same refusals: a Hardware string not proven (today only
`V1.7`) gets "Studio hasn't been proven on this radio's Hardware version; nothing was sent.", and a suffix and Firmware
pair with no base gets "There is no MM9PDY build for this radio (NRFB V0.27) yet; nothing was sent." `NRF` / `V0.27`
is `nrf-v0.27` and `NRFB` / `V0.04` is `nrfb-v0.04`. Bit 0 never picks the base: it is only the cross-check above.

With a report, Studio asks no question. The build name, the three strings (`Suffix:`, `Firmware:`, `Hardware:`), the
layout, the code base (`Code base: nrf-v0.27`) and `rf0` (hex) are shown as information; nothing gates on `rf0`. The
layout stays the report's and the code base goes to the prepared image as `radioCodeBase`: Prepare matches a release
file on both, and offers nothing for a combination with no file, never the nearest one. A `vm_bank0` different from
`vm_start` is shown too, and the layout is still decided on the pair. The build name decides
[Already installed](#already-installed).

**In the wizard.** Prepare starts with **Read the radio**: the radio switched on normally (not in update mode), the
programming cable in, and a fresh pick of its port. Studio opens the clone link exactly as the codeplug session does:
115200 baud, DTR and RTS raised after the open, and the handshake's own settle. That is the normal-mode line handling
proven on the Mini's cable without keying the radio. It then runs the ordinary clone handshake (ident, then the read
magics with the model check), sends the one `R` at `0xEFC0` and closes the port. As in the session, a handshake that
gets no answer at 115200 is tried once more at 38400 (`openWithBaudFallback` in `src/app/services/serialBaudFallback.ts`,
which both use). Nothing else is sent, and no `W` frame can be: the read calls only the clone protocol's handshake
and block read (`readUv5rMiniRadioReport` in `src/integrations/radio-io/radios/uv5r-mini/radioReportRead.ts`, reached
through the updater descriptor's `radioReport`). Until the radio is read, nothing is asked and nothing is prepared.

- A report: no question. The build name, the three strings, layout, code base and `rf0` are listed. A report Studio
  refuses (above) stops Prepare there; Radio Info is not asked instead.
- No report: "Studio found no MM9PDY radio report: the radio runs stock firmware, or an MM9PDY build from before the
  report." Then the [Radio Info](#radio-info) question.
- A read that fails (no answer, wrong port, a radio in update mode): the reason, and the Radio Info question as a
  fallback, so a radio that can't answer can still be updated. **Read the radio again** stays offered.

Reading again drops the prepared image and the "Write it again anyway" confirm. The read's result lives in the wizard's
memory only.

No file moves a radio between code bases, so there is no "one-way" warning: the code base is information, and the
code-base check refuses a file on the other base.

### Radio Info

With no radio report, the wizard asks three things on one screen, as dropdowns of the supported values. Studio can't
read any of them over the K-plug, so nothing is pre-filled for a stock radio.

- **Firmware** (`V0.04`, `V0.27`, `Other`) and **Hardware** (`V1.7`, `Other`): "From Radio Info (MENU → Radio Info)."
- **Suffix** (`NRF`, `NRFB`, `Other`): not on Radio Info. Its help says: switch the radio off, then hold `8` while
  switching it on: for about a second it shows `5RMINI NRF` or `5RMINI NRFB`, then boots normally; repeat it, or film
  the screen with your phone, if you miss it.

NRF and NRFB radios get separate builds, so the suffix and the Firmware version together name the radio's stock base,
and with it the flash layout. The Hardware line is the board version, asked only to refuse a board an update hasn't
been proven on:

| Firmware | Suffix  | Hardware | Result                                                                                   |
| -------- | ------- | -------- | ---------------------------------------------------------------------------------------- |
| `V0.04`  | `NRFB`  | `V1.7`   | `nrfb-v0.04`, `L1`                                                                       |
| `V0.27`  | `NRF`   | `V1.7`   | `nrf-v0.27`, `L2`                                                                        |
| `V0.04`  | `NRF`   | `V1.7`   | Refused: "There is no MM9PDY build for this radio (NRF V0.04) yet; nothing was sent."    |
| `V0.27`  | `NRFB`  | `V1.7`   | Refused the same way: no build for `NRFB V0.27`                                          |
| `Other`  | Any     | `V1.7`   | Refused: "Studio doesn't support this radio's Firmware version; nothing was sent."       |
| Listed   | `Other` | `V1.7`   | Refused: "Studio doesn't support this radio's suffix; nothing was sent."                 |
| Any      | Any     | `Other`  | Refused: "Studio hasn't been proven on this radio's Hardware version; nothing was sent." |

A release row is identified by its whole base (its stock version, and the optional row `base`), not by `layout` alone.
Prepare picks the file on the radio's base and layout and never offers the nearest build: a base the chosen release
has no file for shows "Not available in this release: there is no MM9PDY build for this radio (…) yet." and stops
before anything is prepared. In 1.0.0 only `NRF` + `V0.27` + `V1.7` gets a file.

Above the dropdowns, a warning: "Pick exactly what the radio shows. If the Firmware or suffix you pick is wrong,
Studio or the radio refuses the file and nothing is installed, though the radio's FM presets and volume may be reset.
If the Hardware line is wrong, nothing stops the update, and a radio Studio doesn't know yet may not be caught
either." For the two bases Studio knows, a wrong Firmware or suffix pick is caught: a combination with no base is
refused by Studio, and one that names the other base names the other flash layout, which the loader refuses with
`0x8F` and erases no firmware, though the stock update stage has already reset the FM presets and volume. A wrong
Hardware pick is not caught: the file's layout and code base match, so the loader installs it on a board it was never
proven on. Nor is a suffix mis-pick on a radio of an unknown variant whose version matches a known base. The answers
live in the wizard's memory only.

**Retry partner.** After a refusal before anything was installed, the retry goes only to a file of the same suffix
(`releaseLayouts.variantOfBase`). Today's `L1` file is NRFB and the `L2` file NRF, so the retry always crosses the
suffix and no partner is offered.
Code: `src/core/radios/baofeng/uv-5r-mini/radioInfo.ts`, rendered by the Prepare step from
`StockFirmwareDescriptor.radioLayout`.

**Not listed itself** applies only to list-carrying loaders. A layout loader has no list, and the patch's own
`loader.list` (now written as `[]`) is descriptive: the check follows the pinned loader, never the patch.

The loader hash is computed synchronously (a small in-module SHA-256, checked against Web Crypto in its test) because
the updater's `checkImage` is synchronous.

### Already installed

Studio can't read which app the radio holds, so the only evidence is what the radio says about itself. The radio is
taken to run the image's build when:

- the build name in its [radio report](#the-radio-report) equals the image's build name (the patch's `build.name`,
  trimmed, ignoring case); or
- the image is a to-stock image, the layout is known, and the radio named no MM9PDY build (no report: stock, or an
  MM9PDY build from before the report).

The check runs last, after every refusal above, so a refused image never reaches it. What happens depends on the
loader:

- **Layout loader (`L1`, `L2`): a warning with an explicit confirm.** The loader always writes, so writing the same
  build again is a repair, with the usual power-cut risk. Prepare shows the warning, "This radio already runs <build>.
  Writing it again rewrites the same firmware; use this to repair a radio. The usual power-cut risk applies." (for
  stock onto stock: "Studio sees no MM9PDY build on this radio, so it may already run the stock <base>. …"; Studio
  doesn't compare the radio's stock version with the file's, so it says only "may"), and a tick box, "Write it again
  anyway". Until it is ticked no image is prepared, the wizard can't move on, and nothing is sent. The interlock throws
  `RadioConfirmRequiredError` (error code `needsConfirm`), not an interlock error.
- **List-carrying loader: refused.** That loader writes nothing for the build it is given again. "This radio already
  runs <build>. This firmware is already installed; nothing was sent. Flash a different build."

The radio's build name, whether it reported at all, and the confirm travel on the prepared image
(`PreparedFirmwareImage.radioBuild`, `radioReported` and `reinstallConfirmed`), so the check runs again as the flash
starts, and an image without the confirm is stopped there before the first frame. A radio that reports runs an MM9PDY
build even when the report names none, so it never gets the stock-onto-stock warning. A new answer, the stock or the
firmware choice clears the confirm.

On a radio with no report (an MM9PDY build from before the report), Studio has no build name, so neither the warning
nor the list-carrying refusal can fire before the flash. With a layout loader that just rewrites the same firmware.
With a list-carrying loader, the runtime `alreadyInstalled` stop below (`RadioAlreadyInstalledError`) is then what stops
it.

A loader that writes nothing would read past the end of the image before announcing any length. Studio refuses that
read and sends nothing more, but names it: error code `alreadyInstalled` (`RadioAlreadyInstalledError`), "This
firmware is already installed… Nothing was written to the firmware". The layout loaders always plan the whole area, so
this can't happen with them; it is kept as a defensive classification. The loader then times out with nothing erased
or written, and the radio boots its installed app.

## Back to stock

Studio can't flash the plain stock file. The way back is the firmware project's **to-stock patch**,
`uv5rmini-fw-to-stock-<base>.patch.json`, one in each release artifact: `nrfb-v0.04` for a layout-1 radio,
`nrf-v0.27` for a layout-2 radio. It is an ordinary format-1 patch with no extra field. Its result is the radio's own
stock with the layout's loader appended: `flash.bin` equals the stock's byte for byte, so the result differs from the
stock file only in `ota.bin`.

| Field                           | To-stock value                                         |
| ------------------------------- | ------------------------------------------------------ |
| `base`, `build.name`            | The same: the stock base's name                        |
| `build.appSize`, `build.appCrc` | The stock app's own pair                               |
| `loader.sha256`, `loader.list`  | The base's layout loader (`L1` or `L2`, exactly), `[]` |

**Recognised by the build name.** An image whose build name is a base's own name is a to-stock image; no patch field
can say otherwise. For one, the interlocks also require:

| Check             | Refused unless                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Own base          | The build name is the patch's own `base`: a to-stock file for one base built on the other is refused               |
| Exact loader      | The loader is a layout loader, never a list-carrying one                                                           |
| The base's layout | The loader's layout is the base's: `nrfb-v0.04` takes `L1`, `nrf-v0.27` takes `L2` (`UV5RMINI_BASES.loaderLayout`) |
| Stock bytes       | `flash.bin` equals the stock's at **every** address, app windows included                                          |
| Layout match      | As for any layout loader: the radio's layout is the loader's, checked before anything is sent                      |

Studio knows only these two bases, and a to-stock file is held to the code-base check like any other: a layout-1
radio gets the `nrfb-v0.04` file and a layout-2 radio the `nrf-v0.27` file. A layout-1 radio whose report says it runs
the v0.27 code is refused the `nrfb-v0.04` file (that would change its code base), and an `nrf-v0.27` to-stock file
carries `L2`, which the layout match refuses for it.

Studio can't read the installed app, so "already on stock" means the radio named no MM9PDY build: a to-stock image
for such a radio gets the same warning and confirm as any same-build write (see
[Already installed](#already-installed)). The layout loader then rewrites the stock.

**In the wizard.** The Firmware step offers **Back to stock** (`StockFirmwareDescriptor.stockReturn`), with one line on
where the file comes from. It asks for the to-stock file through the same file picker as a patch from disk, and refuses
any other patch there ("This file isn't a to-stock patch…"). A recognised file needs no "I understand" tick: the
checks above pin everything it installs. Prepare finds the radio's layout as for any image.
The image reads as the stock ("stock firmware v0.04 (NRFB)") with the stock's verify hint; the flash summary's
`Firmware:` line starts "back to stock", and the loader's closing note says the radio restarts back to stock.

## Update mode

Hold PTT-A and `=`, then switch the radio on. Release the keys when the computer icon and `UPDATE...` appear. If the red
TX LED lights or the normal screen appears, switch off at once. The update cable is the USB serial cable (CH340,
USB id `1a86:7523`). Studio opens it at 9600 baud with DTR and RTS low after every open.

After an update that was cut, switch on with no keys: the screen stays dark and the radio's loader restarts from where
it was. Studio continues that write when you press **Connect and flash** again.

## The update session

The radio drives the update: its stock app and then its loader ask for slices of the image, and Studio answers each one
from the checked image. Studio never originates a length, a result or an address; it only repeats the radio's.
Frames are `AA 55`, a length, a command, data and a CRC-16/XMODEM. Code: `session.ts` (the rules, no I/O),
`outgoing.ts` (what may be written), `updater.ts` (the clock, the link and the wording).

1. **Listen** 2 s, sending nothing. A good rate frame (command 1) heard here means the loader is already running from an
   earlier, cut update: Studio continues it ("Your radio was part-way through an update. Studio is continuing it").
2. **Ping** (command 6, empty) once a second for up to 30 s. An empty command 1 back is the stock app in update mode.
   Studio stops pinging at the first answer; answers to earlier pings are absorbed for 300 ms so one is not mistaken for
   the hand-over below. No answer: "No radio in update mode answered. Nothing was sent that the radio acted on."
3. **App stage** at 9600. Studio asks for the same rate, then answers the app's reads (about 21 s). The radio is not
   touched yet: a stop here leaves the stock app.
4. **Hand-over.** The app resets into the loader, which says hello at 9600. Studio replies `{38400}` at 9600, then
   reopens the link at 38400 (`BytePipe.reopen`). The loader repeats its hello at the new rate for about 700 ms and then
   resets back to 9600, keeping its record, so the reopen must fit well inside that. The radio counts as touched from
   this hello.
5. **Loader stage** at 38400. Studio answers the loader's reads, echoes its length (command 4, the size of the area it
   is about to erase: "The radio is erasing its firmware area"), serves the area, and echoes its result (command 3).
6. **Idle limit:** 60 s with no frame once the radio has answered (the loader erases first).

Every frame written passes `checkUv5rMiniOutgoing`: a ping, the two rates, a read reply that is exactly the image bytes
the radio asked for (at most 0x1000, inside the image), and an echo of the radio's own last result or length.

## Results

| Result                                                            | Wording                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loader `0`                                                        | "The radio restarts by itself. Check the power-on screen shows `<build name>`." With a length of 0: "The radio already had this firmware." first                                                                                                        |
| App `0x83`, no cmd 4 heard in the session (ignored ones included) | "Nothing was written to the firmware: the radio refused this file before installing anything, most likely because it is for the other flash layout. Its FM presets and volume may have been reset; nothing else changed." **Nothing installed** (below) |
| App `0x01`, `0x86`, `0x8A`, `0x83` after a cmd 4                  | "Nothing was written to the firmware. Switch the radio off and on." `0x01` adds that the image is not for this radio's key; `0x8A` that it is for another stock version                                                                                 |
| Loader `0x86` before the length, fresh session                    | "This firmware is already on the radio, or the radio holds firmware this image can't replace. Nothing was erased."                                                                                                                                      |
| Loader `0x86` before the length, continued session                | "The interrupted update had already finished. The radio restarts into the new firmware. Check the name; if it is missing, the radio needs a case-open repair."                                                                                          |
| Loader `0x8F` before the length                                   | "The file is for the other flash layout; the radio refused it. Its FM presets and volume may have been reset; nothing else changed." **Nothing installed** (below)                                                                                      |
| Loader `0x87` before the length, fresh session                    | "Nothing was written; the radio boots the installed app."                                                                                                                                                                                               |
| Loader `0x87` before the length, continued session                | The same, plus: don't send this file again (it can only end the same way); if the radio doesn't reach its normal screen, it needs a case-open repair                                                                                                    |
| Loader non-zero after the length, or no frame for 60 s            | The recover text below                                                                                                                                                                                                                                  |

The summary always says to check the power-on name: a torn last page also ends in `0`.

**Nothing installed, and the retry.** The two rows marked above say the file is for the other flash layout and that
nothing was installed. The updater throws `RadioNothingInstalledError` (code `nothingInstalled`) for them, so the
wizard shows **Nothing was installed** rather than **Recover the radio**, although after a `0x8F` the loader has run.
A loader `0x83` after cmd 4 stays the recover text; every other result keeps its words. When the release has a file
for the other layout **of the same suffix** (NRF or NRFB, `releaseLayouts.variantOfBase`), the wizard offers it once:
it prepares that file with the radio's layout set to the file's (the refusal is the evidence Studio's layout was wrong,
so the layout check passes by construction; every other interlock runs again, at Prepare and at the start of
`flash()`), keeps the preflight ticks, probe and safety backup, drops the reinstall confirm, and returns to update
mode. The file is picked and built on its own stock base: for a radio without a report, the partner's base is taken as
the radio's (the answers were wrong); a reported code base stands, so the code-base check refuses a retry that would
change it. The operator re-enters UPDATE... and presses Connect; Studio never resends by itself. With no such file,
or after one retry, nothing more is offered. Today's two bases (`L1` NRFB, `L2` NRF) cross the suffix, so no retry is
offered for them. A crossed pick
costs the FM presets and volume each time, until the firmware keeps them across a refused update.

## Recovery

If the flash stops after the loader started, the radio is touched. Leave the cable in, switch the radio off and on with
no keys held, then press **Connect and flash** again with the same files. The loader keeps its record, so Studio hears
it talk first and continues. A power cut in the last moment of the write can leave the radio needing a case-open repair:
keep the battery charged and the cable in until the radio restarts.

The real-time waits are in `UV5RMINI_FW_TIMEOUT_MS` (`constants.ts`): listen 2 s, ping every 1 s for 30 s, pong settle
300 ms, idle 60 s.

## Testing against the emulator

`uv5rMiniEmuBridge.test.ts` (in `firmwareUpdate/`) runs Studio's real pipeline against an emulated radio: stock
resolution, `prepareFirmwareImage` with a release patch, `checkImage`, `openWebSerialPipe` at 9600 with DTR and RTS low,
then the updater's `identify` and `flash`, including the reopen at 38400. The radio is the firmware project's emulator,
reached through its local TCP serial bridge, so no serial device is opened. Two cases: a clean update that ends with
result 0, and a power cut part-way through the loader's write followed by a continued session that ends with result 0.
Both check that the emulated flash changed only inside the update area (`0x4000` to `0x7C000`) and matches the firmware
project's predicted result.

It is local-only and skipped in CI: it needs the firmware project's bridge, the operator's own stock image and a release
patch for it. Start one bridge per case (a bridge serves one client, then exits), then set:

| Variable                  | Meaning                                                                   |
| ------------------------- | ------------------------------------------------------------------------- |
| `UV5RMINI_STOCK_UFW`      | The stock `.ufw` (`nrfb-v0.04`), outside the repository                   |
| `UV5RMINI_PATCH`          | A release patch for that stock                                            |
| `UV5RMINI_EMU_BRIDGE`     | `127.0.0.1:<port>` of a fresh bridge, for the clean case                  |
| `UV5RMINI_EMU_BRIDGE_CUT` | `127.0.0.1:<port>` of another fresh bridge, for the cut-and-continue case |
| `UV5RMINI_EMU_CUT_AFTER`  | Loader erase and program count the power is cut after (default 100)       |
| `UV5RMINI_RADIO_LAYOUT`   | The emulated radio's layout, `L1` or `L2`, when the patch's loader is one |

Then `npx vitest run src/integrations/radio-io/radios/uv5r-mini/firmwareUpdate/uv5rMiniEmuBridge.test.ts`. A whole
session takes minutes (the emulated radio is kept in step with real time). The test port keeps the emulated clock
running while the port is closed, so a slow reopen would miss the loader's hello window as it would on a radio; but a
fake port reopens instantly, so the cost of a real adapter's close and open is not tested: time that with
`/debug/serial-reopen`. `__fixtures__/bridgeSerialPort.ts` is the test-only `SerialPortLike` that speaks the bridge's protocol.
