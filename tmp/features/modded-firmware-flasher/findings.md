# Modded firmware flasher — findings

Research date: 2026-10-21. Sources: `../anytone-d890-firmware`, `../baofeng-dm32-firmware`, and this repo.
Claims marked **(verified)** were checked against source or the network in this session. The rest come from the
repos' own docs.

## 1. Shared shape (both radios)

Both firmware repos already release something a browser can apply:

- **A release is a JSON patch, not an image.** The assets are `<radio>-fw-<tag>.patch.json` + `SHA256SUMS`. Tags look
  like `X.Y.Z` / `X.Y.Z-rc.N`, with no `v` prefix. `-rc` tags are pre-releases.
- **Apply is pure and deterministic (verified).** You only need stock bytes, hex segments, and SHA-256 checks on the
  input and the output. No toolchain, compression, or crypto is involved, and no checksum is recomputed. Each port is
  about 20–40 lines of TypeScript plus `crypto.subtle.digest`.
- **The result hash is the safety gate.** The Python senders only accept non-stock images through a gate file
  (`gate-result.json` / `*.gate.json`). In Studio, `result.sha256` from a patch file we trust does the same job: the
  release workflow builds, makes the patch, re-applies it, and `cmp`s the output.
- **Stock firmware is pinned to one version per radio** by SHA-256 (zip and inner files). Both repos say the vendor
  firmware is never redistributed.
- **Neither vendor host sends CORS headers (verified):** a GET with `Origin: https://codeplug.mm9pdy.net` returned
  no `Access-Control-*`. The browser can't fetch the stock image directly. It needs a file picker or a proxy.
- **Both firmware repos are private today (verified):** `api.github.com/repos/pskillen/<repo>` returns 404 without
  auth. Studio can't fetch release assets at runtime until the repos are public, or until the patches are published
  somewhere else.
- **Both are GPL-3.0.** The patches contain our compiled code plus the hook bytes. A hook entry also carries the
  stock bytes it replaces (D890 `original`). Those are a few bytes per hook, used only as a check.

## 2. AnyTone AT-D890UV

| Item | Value |
|---|---|
| Stock | V1.05 (20260521): `D890UV_V1.05_20260521.CDD` / `.CDI` / `.spi` |
| Stock source | `https://anytoneusa.com/Files/D890UV%20V1.05%20DMR%20official%20release%20260521.zip`. This is a US dealer (12 Volt Power), not AnyTone. The zip is **44.5 MB** because it also holds the ICON pack. Zip sha256 `193a4c24…f731` |
| Stock hashes | `.CDD` `6d84926e…c96e` (1,675,272 B), `.CDI` `b24dd25a…70de` (278 B), `.spi` `85777140…c8a` (51 B) |
| Patch (`fw/make_patch.py`) | `stock{ext:{sha256,size}}`, `result{…}`, `hooks[{offset,original,hex}]` (same length, original bytes checked), `append{offset,hex}` |
| Apply | Check the three stock hashes → apply the hooks, checking the originals → append → patch the u32 LE length at `.CDI+0x104` and `.spi+6` → check the three result hashes |
| Bootloader entry | PTT+PF3 at power-on. The red LED blinks and the screen stays blank. Same USB ID as the app: CDC `0483:5740`. Ident byte 8: `00` = bootloader, `03` = app |
| Serial | 921600 8N1 (CDC ignores the rate). Studio already opens this radio at 921600 |
| Protocol (`tools/d890update.py`, 480 lines) | `UPDATE`→`06`; `02`→16-byte ident (model and version checked against `.spi`); then 40-byte frames `01 addr32LE data[32] sum16LE 06`, one `06` ACK each (`15` = NAK); end with `18`. The radio reboots and the port disappears, which counts as success |
| Volume | About 52,353 frames for stock. Our sender takes about 25 s; the CPS takes under a minute. **The browser does one request/response per frame, so expect 1–3 min.** Not measured |
| Safety interlocks to port | Address window `0x0800C000 ≤ a`, `a+32 ≤ 0x081E4000` (never the activation page or the bootloader). The first entry must load at `0x0800C000`. Sanity-check the vector table (SP in SRAM, odd reset vector inside the image). The first frame's timeout is 30 s (possible erase); later frames get 2 s; one resend, then abort |
| Verify | No read-back in the update protocol. The radio boots and shows the release name (Device Info > Version) |
| Recovery | Re-enter PTT+PF3 and re-flash. This is "likely" but **untested** after an interrupted write. Going back to stock is currently done with the official CPS. Writing stock with our own sender (runbook S4/S5) was dropped on 2026-10-20 as a test step, because the CPS already worked, not for a technical reason. Our sender has written modded images, and stock is the zero-change case of the same write |

## 3. Baofeng DM-32UV

| Item | Value |
|---|---|
| Stock | v1.01.048: `DM32_L01_048_20250821.bin`, 860,416 B, sha256 `fda860fe…0f8f` |
| Stock source | `https://baofeng.s3.amazonaws.com/Baofeng_DM-32UV_Firmware_v1.01.048.zip` (659 KB; zip sha256 `79ee0f41…336d`). An S3 object, not a versioned page |
| Patch | `stock{sha256,size}`, `result{…}`, `segments[{offset,hex}]` (overwrite, may extend), `neutral_sha256`, `version_slot{offset,len:24}` |
| Apply (verified) | Check the stock hash → write the segments (refuse a gap) → check the result hash. Every release so far is stock length, and docs say never to send any other length |
| Update mode | Radio off, cable out → hold SK1+PTT, power on (green LED) → **then** plug in the cable. Plugging the cable in first hangs the radio until it's power-cycled |
| Serial | CH340 `1a86:7523`, 115200 8N1, DTR/RTS raised. Same as Studio's DM-32 codeplug path |
| Protocol (`tools/flash/dm32_fw_send.py`) | Bootloader dialect of YMODEM-CRC: `52`→`06`, `4D 00 00 00 01`→`4D ?? LEN`, `06`→`BFUV32-V2` (must equal `file[0:9]`), `45 00 00 00 00`→`06`, `31`→`43`, `01`→`43`, block 0 (filename + size) → `06 43` **after an erase of about 13 s**, then STX 1 KiB / SOH 128 B blocks with CRC16-XMODEM, then `04`. The 0x100-byte file header is never sent |
| Volume | About 840 blocks. Seconds, not minutes |
| Retry | None: any wrong reply aborts, and you restart from update mode |
| Verify | Optional: after a power cycle, read the app flash back over the normal PC link (`47`) and compare |
| Recovery | Re-enter update mode and resend. Others report this works; the project hasn't had a failed write. **The sender has written stock 048 to a real radio**, so Studio could also offer "flash stock" as recovery |
| Gap | Issue #39: the Python sender refuses patch-rebuilt images (policy gate only). In Studio, the patch hashes replace that gate |

## 4. Studio today

- **Transport:** `BytePipe` (`src/integrations/radio-io/types.ts:17`), `webSerialPipe.ts`, and `capacitorSerialPipe.ts`
  can be reused as-is. Progress, abort, and errors follow the `kit/` conventions (`ProgressFn`, `AbortSignal`,
  `RadioIoError` subclasses).
- **No firmware seam exists.** `CloneImageRadio` is codeplug-shaped (memory map in, memory map out). A sibling interface
  is needed.
- **Port picking has no VID/PID filter** (`webSerialPipe.ts:217–220` reuses `getPorts()[0]`). Android takes
  `devices[0]`. A firmware flow has to make the user pick the port again after the radio enters its bootloader. Both
  radios keep their USB ID in the bootloader, so the protocol ident step is the only way to know which mode the radio
  is in.
- **Gating:** `radioWriteEnvGate.ts` turns writes off on prod web. A flasher should follow the same gate (or a stricter
  one).
- **Hosting:** `functions/api/*` already has stateless streaming CORS bridges with an origin allowlist
  (`functions/lib/codeplugOrigin.ts`). A fixed-URL `functions/api/firmware/<radio>-stock.ts` would follow that pattern.
  There is no CSP or `_headers`.
- **Libraries:** `fflate` is already a dependency for unzipping. SHA-256 via `crypto.subtle` already exists.
- **DESIGN.md** says nothing about firmware flashing. It describes "no backend" (the functions are CORS bridges) and
  "does not replace vendor CPS". A flasher is a new scope, and DESIGN.md should get a section for it.
- The MM9PDY codeplug targets already exist (`docs/features/radio-read-write/README.md:11`, `mm9pdyStepKeys.ts`, zone
  scan export). A flasher closes the loop: flash the mod, then write a codeplug that uses it.

## 5. Unknowns / risks

1. **Bootloader robustness on both radios.** Whether a bad image is checked before boot, the erase extent, and whether
   recovery works after an interrupted write are untested on both radios. That makes a browser flash with a flaky USB
   hub or a sleeping laptop the main brick risk.
2. **D890 timing over Web Serial.** 52k round trips with one ACK each. Browser latency is unmeasured, and the
   per-frame timeout is 2 s.
3. **D890 end-of-session.** The port disappears on success. Web Serial will throw on read, and that has to count as
   success (the Python sender does the same).
4. **Vendor URL stability.** Neither URL is versioned or official-first-party. The AnyTone zip comes from a dealer.
5. **Redistribution through a proxy.** A streaming proxy doesn't store the vendor file, but it does relay it from our
   domain. That is arguably a weaker position than "the user downloads it". Owner's call.
6. **Linux + CH340 + Web Serial** behaviour in DM-32 update mode hasn't been tried. Neither has a modded D890 release
   written through the vendor CPS.
7. **Repo visibility.** Both firmware repos are private, which rules out runtime GitHub fetches.
8. **Activation:** the D890 has an "activation page" at `0x0800A000`, which our address window must never touch.
   Keep that interlock as a hard-coded refusal, not something configurable.
