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

| Loader     | Packed SHA-256                                                     | Lists                             |
| ---------- | ------------------------------------------------------------------ | --------------------------------- |
| `stock`    | `5382ce4d20dfc7a57cb2a86c836dbbe8c46f6f02625f6f91675df88066e9acb4` | `nrfb-v0.04`                      |
| `stock+c4` | `87f53dec40c4335ec0c38734c7e3ee08af8847e795da15068f5c9ba876939867` | `nrfb-v0.04`, `mm9pdy-0.1.0-rc.1` |

The loader hash is computed synchronously (a small in-module SHA-256, checked against Web Crypto in its test) because
the updater's `checkImage` is synchronous.
