# Baofeng UV-5R Mini — firmware

Facts the firmware flasher needs for the UV-5R Mini: the one stock firmware file Studio accepts, and the release patch
format that turns it into a modded build. Product rules: [DESIGN.md — Firmware flashing](../../../../../DESIGN.md#firmware-flashing).

**Code mirror:** [`src/core/radios/baofeng/uv-5r-mini/firmware.ts`](../../../../../src/core/radios/baofeng/uv-5r-mini/firmware.ts)
(`UV5RMINI_STOCK_FIRMWARE`, `UV5RMINI_FIRMWARE_ROLE_UFW`) and
[`src/core/firmware/patch/formats/baofeng-uv5rmini-firmware/`](../../../../../src/core/firmware/patch/formats/baofeng-uv5rmini-firmware/).
Keep them in step.

## Stock firmware pin

The firmware is one `.ufw` file, member role `ufw`. Studio never fetches, hosts or commits it, and no vendor download
is offered: the stock image is the radio's own, which the firmware project builds from a read of that radio. The
image is scrambled per radio, so Studio treats it as opaque bytes and cannot read anything out of it.

| Field     | Value                                                              |
| --------- | ------------------------------------------------------------------ |
| Version   | `v0.04 (NRFB)`                                                     |
| Role      | `ufw`                                                              |
| File name | `stock-nrfb-v0.04.ufw`                                             |
| Size      | 520,192 bytes                                                      |
| sha256    | `02419efb44081227faeccf1525bca0e6b0340c9d988ab80b2141c2ee48a7f74e` |

Studio does not flash stock (`stockFlashOffered: false`); the pin is the base a release patch is checked against.

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
image is prepared and again as the flash starts; each refusal says nothing was sent. Code:
`src/integrations/radio-io/radios/uv5r-mini/firmwareUpdate/` (`interlocks.ts`, `ufw.ts`, `constants.ts`).

| Check             | Refused unless                                                                                                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target            | The image is for the UV-5R Mini and the package is exactly one `ufw` file                                                                                                                             |
| Known build       | The image has a build name (the patch's `build.name`) and is not the plain stock image, which its own loader lists                                                                                    |
| Container         | The `.ufw` header CRC, file-table CRC and each file's data CRC are good; it holds exactly `flash.bin` (type 0) and `ota.bin` (type 100), both inside the file                                         |
| Loader            | `ota.bin` holds exactly one entry, `uart_user.bin`, attribute `0x41`, with good CRCs, and the SHA-256 of the packed loader is on the pinned list below                                                |
| Area              | `flash.bin` starts at SoC address `0x1000` and ends at or below the base's area end (`0x7C000` for `nrfb-v0.04`), never past `0x94000`                                                                |
| Stock bytes       | `flash.bin` has the stock's length and every byte equals the stock's at the same address, except inside the app windows (SoC, half-open): `[0x4000, 0x4004)`, `[0x4020, 0x4024)`, `[0x4100, 0x7BE1C)` |
| Not listed itself | The image's build name is not on its own loader's list: flashing it again, or after a cut update, would leave the radio stuck in its loader                                                           |

The stock comparison needs no key: the image is scrambled by an address-keyed XOR, so equal stored bytes at an address
are equal plain bytes. Studio never descrambles anything. The stock bytes come from the image's own verified stock
(`PreparedFirmwareImage.stockPackage`); an image without them is refused.

**Pinned loaders** (SHA-256 over the packed loader bytes, with the builds each one lists):

| Loader        | Packed SHA-256                                                     | Lists                                                      |
| ------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `stock`       | `5382ce4d20dfc7a57cb2a86c836dbbe8c46f6f02625f6f91675df88066e9acb4` | `nrfb-v0.04`                                               |
| `stock+c4`    | `87f53dec40c4335ec0c38734c7e3ee08af8847e795da15068f5c9ba876939867` | `nrfb-v0.04`, `mm9pdy-0.1.0-rc.1`                          |
| `stock+c4+w1` | `3ec9a37db41f98bcf9e2b2a75200fd3450ac48807860470f5ca11b08a11724e8` | `nrfb-v0.04`, `mm9pdy-0.1.0-rc.1`, `mm9pdy-pr125-g1c0a9df` |

The loader hash is computed synchronously (a small in-module SHA-256, checked against Web Crypto in its test) because
the updater's `checkImage` is synchronous.

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
| Loader `0x87` before the length, continued session     | "Stop and ask for help; don't retry."                                                                                                                                   |
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

Then `npx vitest run src/integrations/radio-io/radios/uv5r-mini/firmwareUpdate/uv5rMiniEmuBridge.test.ts`. A whole
session takes minutes (the emulated radio is kept in step with real time). The test port keeps the emulated clock
running while the port is closed, so a slow reopen would miss the loader's hello window as it would on a radio; but a
fake port reopens instantly, so the cost of a real adapter's close and open is not tested: time that with
`/debug/serial-reopen`. `__fixtures__/bridgeSerialPort.ts` is the test-only `SerialPortLike` that speaks the bridge's protocol.
