# Baofeng UV-5R Mini — firmware

Facts the firmware flasher needs for the UV-5R Mini: the stock firmware files Studio accepts (one per stock base), and the release patch
format that turns it into a modded build. Product rules: [DESIGN.md — Firmware flashing](../../../../../DESIGN.md#firmware-flashing).

**Code mirror:** [`src/core/radios/baofeng/uv-5r-mini/firmware.ts`](../../../../../src/core/radios/baofeng/uv-5r-mini/firmware.ts)
(`UV5RMINI_STOCK_FIRMWARE`, `UV5RMINI_FIRMWARE_ROLE_UFW`), the base table in
[`firmwareUpdate/constants.ts`](../../../../../src/integrations/radio-io/radios/uv5r-mini/firmwareUpdate/constants.ts) (`UV5RMINI_BASES`) and
[`src/core/firmware/patch/formats/baofeng-uv5rmini-firmware/`](../../../../../src/core/firmware/patch/formats/baofeng-uv5rmini-firmware/).
Keep them in step.

## Stock firmware pin

A stock base is one `.ufw` file, member role `ufw`; Studio accepts two bases. Studio never fetches, hosts or commits it, and no vendor download
is offered: the stock image is the radio's own, which the firmware project builds from a read of that radio. The
image is scrambled per radio, so Studio treats it as opaque bytes and cannot read anything out of it.

| Base         | Version        | File name              | Size          | sha256                                                             |
| ------------ | -------------- | ---------------------- | ------------- | ------------------------------------------------------------------ |
| `nrfb-v0.04` | `v0.04 (NRFB)` | `stock-nrfb-v0.04.ufw` | 520,192 bytes | `02419efb44081227faeccf1525bca0e6b0340c9d988ab80b2141c2ee48a7f74e` |
| `nrf-v0.27`  | `v0.27 (NRF)`  | `stock-nrf-v0.27.ufw`  | 504,832 bytes | `811b4b37253e0685c7efbd3ff0a24aac2bcad223e5453d95b5bfc3f42c089128` |

Studio does not flash the plain stock file (`stockFlashOffered: false`); the pins are the bases a release patch is
checked against. The way back to stock is a to-stock patch (below). Each base's name is on the descriptor
(`baseName`), matching the base table's keys.
The patch's `stock` hashes decide which file is the stock, never a user choice, and a patch's `base` must name the
base whose file hashes to it. The descriptor carries `nrfb-v0.04` as its primary version and `nrf-v0.27` as
`alsoAccepts`.

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

| Check             | Refused unless                                                                                                                                                                                                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target            | The image is for the UV-5R Mini and the package is exactly one `ufw` file                                                                                                                                                                                                                                 |
| Known build       | The image has a build name (the patch's `build.name`) and is not the plain stock image, which its own loader lists                                                                                                                                                                                        |
| Container         | The `.ufw` header CRC, file-table CRC and each file's data CRC are good; it holds exactly `flash.bin` (type 0) and `ota.bin` (type 100), both inside the file                                                                                                                                             |
| Loader            | `ota.bin` holds exactly one entry, `uart_user.bin`, attribute `0x41`, with good CRCs, and the SHA-256 of the packed loader is on the pinned list below                                                                                                                                                    |
| Base              | The patch's `base` names a base in the table below, and the verified stock hashes to that base's stock file                                                                                                                                                                                               |
| Area              | `flash.bin` starts at SoC address `0x1000` and ends at or below the base's area end (`0x7C000` for both bases), never past the base's own hard limit (the start of its first per-unit record sector)                                                                                                      |
| Stock bytes       | `flash.bin` has the stock's length and every byte equals the stock's at the same address, except inside the base's app windows (SoC, half-open), from the table below                                                                                                                                     |
| Layout            | For a layout loader (`L1`, `L2`): Studio knows the radio's hardware layout and it is the loader's. Checked before anything is sent                                                                                                                                                                        |
| Not listed itself | For a list-carrying loader only: the image's build name is not on its loader's list. Flashing it again, or after a cut update, would leave the radio stuck in its loader                                                                                                                                  |
| To stock          | For a to-stock image (build name is a base's own name): see [Back to stock](#back-to-stock). Its loader and stock-byte rules replace the general ones above, never loosen them                                                                                                                            |
| Already installed | Checked last. For a list-carrying loader: the build name typed on Prepare ("Radio Info: MM9PDY build (if shown)"), trimmed and compared ignoring case, is not the image's own. For a layout loader this is a warning with an explicit confirm, not a refusal: see [Already installed](#already-installed) |

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

**List-carrying loaders.** These keep their pin, and an image built with one still gets the "already installed" refusal.

| Loader        | Packed SHA-256                                                     | Lists                                                      |
| ------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `stock`       | `5382ce4d20dfc7a57cb2a86c836dbbe8c46f6f02625f6f91675df88066e9acb4` | `nrfb-v0.04`                                               |
| `stock+c4`    | `87f53dec40c4335ec0c38734c7e3ee08af8847e795da15068f5c9ba876939867` | `nrfb-v0.04`, `mm9pdy-0.1.0-rc.1`                          |
| `stock+c4+w1` | `3ec9a37db41f98bcf9e2b2a75200fd3450ac48807860470f5ca11b08a11724e8` | `nrfb-v0.04`, `mm9pdy-0.1.0-rc.1`, `mm9pdy-pr125-g1c0a9df` |

**Layout match.** The radio's stock app runs the first stage of an update ("UPDATE..."), before any loader. Sent a
file for the other layout, that stage already loses some of the radio's settings (its FM presets and volume) before
the loader can refuse. So Studio checks the layout itself, before it sends anything. For an image whose loader is `L1`
or `L2`, the radio's layout must be on the prepared image (`PreparedFirmwareImage.radioLayout`, passed to
`prepareFirmwareImage` as `radioLayout`; the wizard asks for it, below):

- the layouts differ: "This file is for the other hardware layout; nothing was sent."
- no layout given: refused, because Studio can't check the file is for this radio.

A list-carrying loader's image ignores the layout.

**Radio Info.** On the Prepare step, before the image is built, the wizard asks for the two lines of the radio's Radio
Info screen, `Firmware` and `Hardware` (case, spaces and a missing `V` are ignored). Only the proven pairs map to a
layout:

| Firmware | Hardware | Layout |
| -------- | -------- | ------ |
| `V0.04`  | `V1.7`   | `L1`   |
| `V0.27`  | `V1.7`   | `L2`   |

Any other pair stops the wizard: "Studio doesn't recognise this radio's Radio Info; nothing was sent." A radio moved
from V0.04 to V0.27 by an MM9PDY update shows the `L2` pair but keeps layout 1, so the step has an explicit choice, "My
radio is layout 1 (it was moved to v0.27)", which makes a proven pair `L1`. A wrong choice reaches the radio: its
loader refuses it with `0x8F` and erases no firmware, but the FM presets and volume are reset.

**MM9PDY build name.** A radio running an MM9PDY build keeps the vendor's `Firmware` line and shows the build's name
on Radio Info's fourth, unlabelled line (the whole name: at most 21 characters, never cut). The step asks for it as an
optional third line, "Radio Info: MM9PDY build (if shown)". When it is given, the pair must still be a proven one, and
the name decides the layout. The match ignores case (the LCD's text and a phone's capitals both work) and drops surrounding spaces; every other
character counts:

| Name                                                                                                            | Layout |
| --------------------------------------------------------------------------------------------------------------- | ------ |
| `mm9pdy-L1-X.Y.Z[-rc.N]`, `mm9pdy-L1-pr<N>-g<hex>`, `mm9pdy-L1-g<hex>[-dirty]`                                  | `L1`   |
| `mm9pdy-L2-X.Y.Z[-rc.N]`, `mm9pdy-L2-pr<N>-g<hex>`, `mm9pdy-L2-g<hex>[-dirty]`                                  | `L2`   |
| Untagged, from before the layout tag: `mm9pdy-X.Y.Z[-rc.N]`, `mm9pdy-pr<N>[-g<hex>]`, `mm9pdy-g<7 hex>[-dirty]` | `L1`   |

`<hex>` is 4–7 hex digits and `<N>` a PR number without leading zeros. Untagged builds were only ever made
for V0.04. Refused with the same text: any other name (the bare unstamped `mm9pdy` among them), an `L2` name with
Firmware V0.04, an untagged name with V0.27, and an `L2` name with the layout-1 choice ticked. An `L1` name on V0.27
needs no choice. The answers live in the wizard's memory only. Code: `src/core/radios/baofeng/uv-5r-mini/radioInfo.ts`,
rendered by the Prepare step from `StockFirmwareDescriptor.radioLayout`.

**Not listed itself** applies only to list-carrying loaders. A layout loader has no list, and the patch's own
`loader.list` (now written as `[]`) is descriptive: the check follows the pinned loader, never the patch.

The loader hash is computed synchronously (a small in-module SHA-256, checked against Web Crypto in its test) because
the updater's `checkImage` is synchronous.

### Already installed

Studio can't read which app the radio holds, so the only evidence is what the operator typed from the radio's own Radio
Info. The radio is taken to run the image's build when:

- the typed build name equals the image's build name (the patch's `build.name`, trimmed, ignoring case); or
- the image is a to-stock image, Radio Info was given (the layout is known), and the build line was left empty: the
  wizard asks for it to be left empty on stock firmware, so the radio looks to be on that stock.

The check runs last, after every refusal above, so a refused image never reaches it. What happens depends on the
loader:

- **Layout loader (`L1`, `L2`): a warning with an explicit confirm.** The loader always writes, so writing the same
  build again is a repair, with the usual power-cut risk. Prepare shows the warning, "This radio already runs <build>.
  Writing it again rewrites the same firmware; use this to repair a radio. The usual power-cut risk applies." (for
  stock onto stock: "Radio Info shows no MM9PDY build, so this radio may already run the stock <base>. …"; the Firmware line is not compared with the stock's
  version, so it says only "may"), and a tick
  box, "Write it again anyway". Until it is ticked no image is prepared, the wizard can't move on, and nothing is sent.
  The interlock throws `RadioConfirmRequiredError` (error code `needsConfirm`), not an interlock error.
- **List-carrying loader: refused.** That loader writes nothing for the build it is given again. "Radio Info says this
  radio already runs <build>. This firmware is already installed; nothing was sent. Flash a different build."

The typed name and the confirm travel on the prepared image (`PreparedFirmwareImage.radioBuild` and
`reinstallConfirmed`), so the check runs again as the flash starts, and an image without the confirm is stopped there
before the first frame. Changing any Radio Info answer, the stock or the firmware choice clears the confirm. Studio
can't catch a same-build flash when the build line is left out on a modded radio; with the layout loaders that just
rewrites the same firmware.

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
| Layout match      | As for any layout loader: the radio's layout (from Radio Info) is the loader's, checked before anything is sent    |

Studio knows only these two bases, so a layout-1 radio moved to v0.27 goes back with the `nrfb-v0.04` file; an
`nrf-v0.27` to-stock file carries `L2` and the layout match refuses it for that radio.

Studio can't read the installed app, so "already on stock" comes from Radio Info: a to-stock image for a radio whose
build line was left empty gets the same warning and confirm as any same-build write (see
[Already installed](#already-installed)). The layout loader then rewrites the stock.

**In the wizard.** The Firmware step offers **Back to stock** (`StockFirmwareDescriptor.stockReturn`), with one line on
where the file comes from. It asks for the to-stock file through the same file picker as a patch from disk, and refuses
any other patch there ("This file isn't a to-stock patch…"). A recognised file needs no "I understand" tick: the
checks above pin everything it installs. Radio Info, and the build-name line, are asked on Prepare as for any image.
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

| Result                                                 | Wording                                                                                                                                                                 |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loader `0`                                             | "The radio restarts by itself. Check the power-on screen shows `<build name>`." With a length of 0: "The radio already had this firmware." first                        |
| App `0x01`, `0x86`, `0x8A`, `0x83`                     | "Nothing was written to the firmware. Switch the radio off and on." `0x01` adds that the image is not for this radio's key; `0x8A` that it is for another stock version |
| Loader `0x86` before the length, fresh session         | "This firmware is already on the radio, or the radio holds firmware this image can't replace. Nothing was erased."                                                      |
| Loader `0x86` before the length, continued session     | "The interrupted update had already finished. The radio restarts into the new firmware. Check the name; if it is missing, the radio needs a case-open repair."          |
| Loader `0x8F` before the length                        | "The file is for the other hardware layout; the radio refused it. Its FM presets and volume may have been reset; nothing else changed."                                 |
| Loader `0x87` before the length, fresh session         | "Nothing was written; the radio boots the installed app."                                                                                                               |
| Loader `0x87` before the length, continued session     | The same, plus: don't send this file again (it can only end the same way); if the radio doesn't reach its normal screen, it needs a case-open repair                    |
| Loader non-zero after the length, or no frame for 60 s | The recover text below                                                                                                                                                  |

The summary always says to check the power-on name: a torn last page also ends in `0`.

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
