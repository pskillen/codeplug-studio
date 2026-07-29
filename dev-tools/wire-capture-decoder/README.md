# wire-capture-decoder

Decodes a USBPcap capture (via Wireshark) of a radio CPS's USB-serial (CDC
ACM) wire protocol into a structured report: every distinct frame shape
seen, a count, and — the actual point of this tool — every byte range
that does **not** match a known frame shape, in full hex, with context.

Built for the AT-D890UV investigation in
[`tmp/anytone-airband/d890-cps-wire-capture-brief.md`](../../tmp/anytone-airband/d890-cps-wire-capture-brief.md):
we know our own read/write block protocol, but the official CPS does
something extra (probably a commit/erase command) that makes writes
actually stick. This tool turns a raw capture into something a human can
scan for that "something extra" without reading tens of thousands of
frames by hand.

The frame-shape knowledge (`PROGRAM`/ident-probe/`END`/read/write) is
specific to the AT-D890UV today, but the pipeline — tshark extraction →
stream reassembly → structural framing → anomaly report — is generic.
Adapting to another radio's protocol means changing `parser.py`, not the
rest of the tool.

## Why Python, why a venv here

This is exploratory, one-off protocol reverse-engineering — a better fit
for a small dependency-free Python script than for the app's TypeScript
stack. The venv is scoped to this directory (not shared with other
`dev-tools/*` tools) so it can be deleted and rebuilt without touching
anything else.

## Setup

Requires `python3.14` and `tshark` (Wireshark's CLI, not the full GUI
app) on `PATH`.

```bash
brew install wireshark   # CLI formula — installs tshark, not the GUI app
```

```bash
cd dev-tools/wire-capture-decoder
python3.14 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
```

## Usage

```bash
source .venv/bin/activate
python -m wire_capture_decoder decode "/path/to/capture.pcapng" --out report.md
```

Optional flags:

- `--json frames.json` — also dump every decoded frame as JSON (for
  further scripted analysis, or re-decoding without re-running tshark's
  slower JSON path).
- Omit `--out` to print the report to stdout.

Run the test suite (synthetic captures, no tshark/hardware needed):

```bash
python -m pytest -q
```

## How it works

1. **`tshark_extract.py`** shells out to `tshark -T fields` to pull
   `usbcom.data.out_payload` (host→radio) and `usbcom.data.in_payload`
   (radio→host) for every USB bulk transfer, in capture order. We
   delegate USBPcap/URB/CDC dissection entirely to Wireshark rather than
   hand-parsing pcapng ourselves — that dissection is already correct
   and well-tested; reimplementing it is exactly where a subtle bug
   could make us silently miss the frame we're hunting for.

2. **`model.py` / `parser.py`** concatenate each direction's chunks into
   one continuous byte stream (`Stream`), because USB splits a single
   protocol frame across multiple bulk transfers at the max-packet-size
   boundary — framing has to happen on the reassembled stream, not per
   USB packet. A `Stream` also keeps an offset→tshark-frame-number index
   so every decoded frame can be traced back to where it came from in
   the original capture.

   The protocol is half-duplex request/response, so parsing walks the
   host stream command-by-command and, for each command, consumes the
   matching number of bytes from the radio stream (`correlate()` in
   `parser.py`). Anything that doesn't match a known shape at the
   expected position triggers a resync scan and gets emitted as an
   `UNKNOWN_HOST` / `UNKNOWN_RADIO` frame — never silently dropped or
   guessed at. Frames that _do_ match a known shape but fail their
   checksum or come back with a mismatched address/length are still
   flagged (via `checksum_ok` / `note`), not swept into "looks fine."

3. **`report.py`** renders the decoded frame list into the deliverable
   shape from the capture brief: a frame-shape inventory table, full hex
   - context for every unknown/anomalous frame, the exact session
     open/close byte sequences, whether the known "skipped address" quirk
     (`0x02FA0010`) is ever written, and any reads issued mid-write-phase.

## Known protocol shapes (AT-D890UV)

See the capture brief for the authoritative spec. Summary:

| Frame              | Direction  | Shape                                                       |
| ------------------ | ---------- | ----------------------------------------------------------- |
| `PROGRAM`          | host→radio | ASCII, 7 bytes, no terminator                               |
| program-mode reply | radio→host | `51 58 06` (or a lone `0x00`, tolerated quirk)              |
| ident probe        | host→radio | single byte `0x02`                                          |
| ident reply        | radio→host | model+version, terminated by `0x06`                         |
| `END`              | host→radio | ASCII, 3 bytes                                              |
| read command       | host→radio | `52` + addr(4, BE) + len(1)                                 |
| read reply         | radio→host | `57` + addr(4) + len(1) + data + checksum(1) + `06`         |
| write command      | host→radio | `57` + addr(4) + len=`0x10` + data(16) + checksum(1) + `06` |
| write ack          | radio→host | single byte `0x06`                                          |

Checksum is an 8-bit sum of all body bytes after the opcode, truncated to
one byte. The write command's trailing `06` is a fixed terminator baked
into the same frame/USB transfer as the command itself — confirmed from
a real capture, where it arrives as the last byte of the same
`usbcom.data.out_payload` chunk as the write command. It is separate
from (and in addition to) the radio's own single-byte `06` ack that
follows afterward. Easy to misread from the brief's condensed table
notation as "the radio's ack, just shown inline" — it isn't.

## Extending this for a different capture/radio

- New frame shapes: add a matcher in `parser.py` (`try_match_host` /
  the `match_*` reply functions) and wire it into `correlate()`.
- Different report needs: `report.py` is independent of extraction/
  parsing — it only consumes `ProtocolFrame` objects.
