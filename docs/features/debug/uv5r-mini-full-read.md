# UV-5R Mini full read (`/debug/uv5r-mini`)

A read-only debug page for the Baofeng UV-5R Mini: one full clone read of `0x0000–0xFFFF` with a SHA-256 per span,
the reads of this tab with a "download all" zip, and a compare of two reads. It exists for checks that Backup can't
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

- **Link:** the codeplug session's: the Mini's cable (CH340 filter in the port picker), DTR and RTS raised after the
  open, 115200 baud and, when the handshake gets no answer, once more at 38400.
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

## Compare two reads

Two reads (the two newest until you pick) compared on the decoded bytes with the runbook windows:

- **Compared:** `0x0000–0x7FFF`, `0xA000–0xAFFF`, `0xC000–0xCFFF`, `0xE000–0xEFFF`.
- **Calibration:** `0xF000–0xFFFF`, on its own line.
- **Reported only:** the VFO frame `0x8000–0x803F` and the settings frame `0x9000–0x903F`. A difference there is shown
  but doesn't make the reads differ.
- **Skipped:** the firmware log sectors `0x8000–0x8FFF`, `0x9000–0x9FFF`, `0xB000–0xBFFF`, `0xD000–0xDFFF`.

Each line says "identical" or how many bytes differ and at which offsets (the first 32).

## Code anchors

| Layer        | Module                                                                                         |
| ------------ | ---------------------------------------------------------------------------------------------- |
| Integrations | `src/integrations/radio-io/radios/uv5r-mini/debugRead/` (allowlist, full read, spans, compare) |
| Service      | `src/app/services/uv5rMiniDebugRead.ts` (port, baud fallback, close)                           |
| Route        | `src/app/routes/debug/DebugUv5rMiniPage.tsx`, `uv5rMiniDebugReads.ts` (tab history, zip)       |

## Manual verify

On desktop Chrome with the Mini on its cable, open `/debug/uv5r-mini` (a pre-prod build, or prod with developer mode
on):

1. Take two full reads back to back.
2. The compare says identical on every compared span and on calibration.
3. **Download all**, and check the zip holds `raw.bin`, `decoded.bin` and `summary.txt` for each read.
4. The calibration span hash matches the hash from the radio's earlier reads.

On a prod build with developer mode off, `/debug/uv5r-mini` goes to the home page.

## Known gaps

- A calibration viewer and a channel-level diff of two reads ([#1651](https://github.com/pskillen/codeplug-studio/issues/1651)).

## Related

- [Debug](README.md)
- [UV-5R Mini protocol](../../reference/radios/baofeng/uv-5r-mini/protocol.md)
