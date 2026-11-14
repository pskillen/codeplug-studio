# UV-5R Mini full read (`/debug/uv5r-mini`)

A read-only debug page for the Baofeng UV-5R Mini: one full clone read of `0x0000–0xFFFF` with a SHA-256 per span,
the reads of this tab with a "download all" zip, a compare of two reads with a channel-level diff, and a read-only calibration viewer. It exists for checks that Backup can't
make (Backup reads only the clone ranges up to `0xA1BF`): calibration unchanged, a round trip identical, back to stock.

**Tracking:** [#1651](https://github.com/pskillen/codeplug-studio/issues/1651)

**On prod:** the page is hidden unless [developer mode](../developer-mode/README.md) is on for the device. Its route
is in `debugRoutes`, under `DebugGate`, like every other Debug page.

## Read only

The page never writes to the radio and never offers a restore or write from a read. A read carries the radio's
calibration (`0xF000–0xFFFF`), which must never be written.

This is enforced in code, not by the page's buttons. Every frame of the read goes through `Uv5rMiniReadOnlyPipe`,
whose `write` refuses anything outside an allowlist before the transport sees it:

| Frame                    | Bytes                                               |
| ------------------------ | --------------------------------------------------- |
| Ident                    | `PROGRAMCOLORPROU`                                  |
| Frequency ranges         | `F`                                                 |
| Model                    | `M`                                                 |
| Read cipher-select frame | the `SEND` frame with the read trailer (`0x00`)     |
| Read                     | `R` + address (u16 BE) + `0x40`, exactly four bytes |
| End                      | `E`                                                 |

Everything else is refused with `Uv5rMiniDebugFrameRefusedError`: `W`, `D`, `UPDATE`, the `AA 55` update frames, the
upload cipher-select frame, an `R` of another length. Tests pin the exact frame sequence of a full read and drive a
Write through the pipe to show no `W` reaches the radio (`debugRead/fullRead.test.ts`).

## Full read

- **Link:** the codeplug session's, and the flasher's radio report read's (`UV5RMINI_RADIO_REPORT_LINK`): the Mini's
  cable (CH340, `1a86:7523`), 115200 baud 8N1, DTR and RTS raised after the open and, when the handshake gets no
  answer, once more at 38400. In a browser the port picker is narrowed to the cable; in the Android app the one
  attached device matching it is used, through the flasher's seam (`grantFirmwareLinkPort`, `openFirmwareLinkPipe`).
  Raising DTR and RTS is the normal-mode line handling the codeplug Read uses on the Mini's cable without keying the
  radio; nothing in the read can key it, since the sender allows no frame but the clone handshake, `R` and `E`.
- **Session:** the codeplug Read's handshake (`Uv5rMiniProtocol.connect`: settle, ident, `F`, `M` with the model
  check, the read cipher-select frame), then a 64-byte `R` at every address `0x0000–0xFFC0` (1024 reads), then `E`.
- **Ident:** the `F` (16 bytes) and `M` (15 bytes) answers, shown as hex.
- **Raw and decoded:** the clone read XORs everything below `0xF000` and sends `0xF000` and up plain, so the decoded
  image undoes the XOR below `0xF000` only.
- **Span hashes** (SHA-256 of the decoded bytes):

| Span            | Name            |
| --------------- | --------------- |
| `0x0000–0x7FFF` | Codeplug        |
| `0xA000–0xAFFF` | DTMF and extras |
| `0xC000–0xCFFF` | MM9PDY data     |
| `0xE000–0xEFFF` | Reserved        |
| `0xF000–0xFFFF` | Calibration     |

## Reads in this tab

Reads are held in memory for the tab only, labelled A, B, C… with their time. In-app navigation keeps them; closing or
reloading the tab loses them, and the browser asks first while any read is not yet in a downloaded zip. Nothing is
written to browser storage.

**Download all** saves one zip with, per read, `<label>/raw.bin`, `<label>/decoded.bin` and `<label>/summary.txt`
(time, ident, span hashes). The page says where the zip is offered that it contains the radio's calibration.

**In the Android app** there is no download. The app's activity is Capacitor's `BridgeActivity` with no download
listener, so a `blob:` link with `download` does nothing in its web view (known from the code, not tried on a phone;
the flasher's summary `.txt` download goes the same way). The page shows a notice in place of **Download all**, and does
not warn on leaving. The reads, the compare and the calibration view work as in a browser.

## Compare two reads

Two reads (the two newest until you pick) compared on the decoded bytes with the runbook windows:

- **Compared:** `0x0000–0x7FFF`, `0xA000–0xAFFF`, `0xC000–0xCFFF`, `0xE000–0xEFFF`.
- **Calibration:** `0xF000–0xFFFF`, on its own line.
- **Reported only:** the VFO frame `0x8000–0x803F` and the settings frame `0x9000–0x903F`. A difference there is shown
  but doesn't make the reads differ.
- **Skipped:** the firmware log sectors `0x8000–0x8FFF`, `0x9000–0x9FFF`, `0xB000–0xBFFF`, `0xD000–0xDFFF`.

Each line says "identical" or how many bytes differ and at which offsets (the first 32).

### Channels

Under the compare lines, a **Channels** view diffs the channel span (`0x0000–0x7CDF`, 999 slots of 32 bytes) of the
same two reads, slot by slot (`debugRead/channelDiff.ts`, `diffUv5rMiniChannels`):

- **Changed slot**, live in both reads: the fields that differ, from the
  [channel record](../../reference/radios/baofeng/uv-5r-mini/channel-record.md) (RX and TX frequency, both tones,
  `scode`, PTT ID, power, scramble, wide, RX DTMF, BCL, scan, FHSS, name), with byte or bit ranges for unnamed ones
  (`+0x0E bits 7–6/3–2`, `+0x0F bits 7/1`, `bytes +0x10..+0x13`; no label holds a comma, so the list reads cleanly). When none of the unmodelled bytes and bits of
  `+0x0C..+0x13` changed, the line says so, since that is what an unchanged Write keeps. Power, wide and scan also sit
  in that range and are named when they change. For example: `Slot 2 "TEST Z" (was "TEST B"): TX tone, name changed;
unmodelled bytes and bits of +0x0C..+0x13 unchanged`.
- **Filled** or **emptied**: the slot's first byte went from or to `0xFF`, with the name it gained or lost.
- **Empty in both reads** but with different bytes: the fields those bytes fall in.
- **Unchanged** slots are only counted. The first 200 changed slots are listed.
- **Slots 248 and 249** (`0x1EE0–0x1F1F`) are listed on their own: they are channel data, but CHIRP's
  firmware-version offset `0x1EF0` falls in slot 248 ([memory layout](../../reference/radios/baofeng/uv-5r-mini/memory-layout.md)).
  They are never listed as channels: each has its own line, labelled "channel data kept apart", that says
  "identical" or lists the offsets inside the slot that differ.

## Calibration viewer

A **Calibration** section shows `0xF000–0xFFFF` of one read from the tab's history (the newest until you pick), with
an optional **overlay** of a second read, to spot a bad point or compare two radios. It only shows bytes: it has no
button or link, nothing that exports, copies or sends calibration, and it doesn't touch the sender. The zip above stays
the page's only download.

The layout is shape only (`debugRead/calibrationLayout.ts`, decoded by `decodeUv5rMiniCalibration`):

| Range                            | What                                                            | Shown as                                                                                                        |
| -------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `0xF000–0xF0BF`                  | PA bias: 4 frequency segments × 3 power levels × 16 points, 1 B | one line chart per segment, x = MHz, y = the byte, one line per power level                                     |
| `0xF0C0–0xF0FF`                  | partly traced                                                   | hex                                                                                                             |
| `0xF100–0xF10F`, `0xF110–0xF11F` | squelch rows, one byte per frequency segment                    | bars by index, labelled "partly traced"                                                                         |
| `0xF200–0xF205`                  | battery thresholds (six)                                        | a ladder of six steps; "blank" when all six read `0xFF`; "built-in defaults" only when `0xF000` reads as erased |
| `0xF211`, `0xF212`               | CTCSS and DCS TX level                                          | values                                                                                                          |
| `0xF213`, `0xF214`               | AF gain                                                         | values                                                                                                          |
| `0xF216`                         | frequency trim index 0–16 (±4 ppm)                              | ppm, and a centre-zero gauge in ppm                                                                             |
| `0xF21B–0xF21E`                  | audio filter set picks (bits 2:0)                               | values, with the set                                                                                            |
| `0xF230–0xF244`                  | band limits (21 B)                                              | text (printable ASCII) and hex                                                                                  |
| `0xF250–0xF255`                  | model suffix (6 B)                                              | text and hex                                                                                                    |
| `0xF255`                         | region byte (the suffix's last byte)                            | value                                                                                                           |
| everything else to `0xFFFF`      | untraced                                                        | hex                                                                                                             |

- **PA bias MHz** per point index `i`: segment 1 `130 + 3i`, segment 2 `200 + 5i`, segment 3 `350 + 5i`, segment 4
  `400 + 10i`.
- **Assumed:** the PA bias rows are **segment-major** (row = segment × 3 + power level); nothing in Studio's references
  gives the order. The page says so.
- **Trim:** the byte is an index 0–16 into a 17-entry table: 8 is 0 ppm and each step is 0.5 ppm, so ppm =
  (index − 8) × 0.5, ±4 ppm at the ends. The firmware uses index 8 (0 ppm) for any value above 16; the page says so.
- **Battery:** the page describes the six bytes ("blank" when all read `0xFF`). It says the firmware uses built-in
  thresholds only when `0xF000` reads as erased, the condition under which the firmware's defaults run.
- If `0xF000` reads `0xFF`, the section says the firmware treats calibration as absent.
- **Overlay:** the second read's PA lines are dashed in the same power-level colour, its squelch bars outlined, its
  values in their own column (red where they differ), and each hex and text range says how many bytes differ.
- Hex rows end on 16-byte boundaries; a run of rows that all hold one byte value collapses to one line.
- The charts use [LineChart](../../../src/app/components/LineChart/LineChart.md): hover for a crosshair and values,
  or open its **Table**.

## Code anchors

| Layer        | Module                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Integrations | `src/integrations/radio-io/radios/uv5r-mini/debugRead/` (allowlist, full read, spans, compare, channel diff, calibration layout) |
| Service      | `src/app/services/uv5rMiniDebugRead.ts` (port through `firmwarePort.ts`, baud fallback, close)                                   |
| Route        | `src/app/routes/debug/DebugUv5rMiniPage.tsx`, `uv5rMiniDebugReads.ts` (tab history, zip), `Uv5rMiniCalibrationSection.tsx`       |
| Component    | `src/app/components/LineChart/` ([sidecar](../../../src/app/components/LineChart/LineChart.md))                                  |

## Manual verify

On desktop Chrome with the Mini on its cable, open `/debug/uv5r-mini` (a pre-prod build, or prod with developer mode
on):

1. Take two full reads back to back.
2. The compare says identical on every compared span and on calibration, and the Channels view says no channel slot
   changed, with slots 248 and 249 identical.
3. **Download all**, and check the zip holds `raw.bin`, `decoded.bin` and `summary.txt` for each read.
4. The calibration span hash matches the hash from the radio's earlier reads.
5. The **Calibration** section shows the newest read: four PA bias charts, two squelch rows, the battery ladder, the
   values, the trim gauge, the text and the hex. Pick the other read as the overlay: the dashed lines and the second
   column appear. The section has no button or link.

In the Android app, with only the Mini's cable on the phone: take two reads, check the compare and the calibration
view, and that the page offers no download.

On a prod build with developer mode off, `/debug/uv5r-mini` goes to the home page.

## Known gaps

- The PA bias row order is assumed (see [Calibration viewer](#calibration-viewer)).
- The Android app can't save the reads as a file. The read in the app has not been tried on a phone with a radio.

## Related

- [Debug](README.md)
- [UV-5R Mini protocol](../../reference/radios/baofeng/uv-5r-mini/protocol.md)
