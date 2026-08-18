# radio-memory-dump

Read-only serial memory dump CLI for radio protocol investigation. Captures
named memory regions over USB serial, writes `.bin` files plus `manifest.json`,
and prints a 16-byte-row hex dump to stdout so investigation notes can paste
hex without opening binaries.

Built for the MD-9600 ident/read investigation ([#1244](https://github.com/pskillen/codeplug-studio/issues/1244)):
compare FLASH vs EEPROM at the same offset (e.g. channel-bank base `0x3780`) to
see whether ident/read is hitting the wrong mem code.

Framing matches Studio `opengd77Serial.ts` and
[`docs/reference/radios/opengd77/protocol.md`](../../docs/reference/radios/opengd77/protocol.md)
(facts only; no GPL qdmr copy). **Read-only v1** — never sends OpenGD77 `'W'`
or `'X'` write frames.

Protocol plugins live under `protocols/` so a second radio family (e.g.
Anytone) can be added without rewriting the CLI.

## Why Python, why a venv here

Same rationale as sibling `dev-tools/*` tools: occasional serial
reverse-engineering fits a small Python script better than the app's TypeScript
stack. The venv is scoped to this directory.

## Setup

Requires `python3.14` (or any Python ≥ 3.12).

```bash
cd dev-tools/radio-memory-dump
python3.14 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
```

## Usage

List serial ports:

```bash
source .venv/bin/activate
python -m radio_memory_dump --list-ports
```

**Close Codeplug Studio Web Serial first** — the OS grants exclusive access to
one process per serial device.

E1 MD-9600 probe (FLASH vs EEPROM at channel-bank offset):

```bash
python -m radio_memory_dump --protocol opengd77 --port <port> \
  --ident --show-cps \
  --region flash:0x3780:32 \
  --region eeprom:0x3780:32 \
  --out /tmp/e1-md9600-probe
```

Options:

| Flag                       | Meaning                                                      |
| -------------------------- | ------------------------------------------------------------ |
| `--protocol opengd77`      | Protocol plugin (only shipped plugin today)                  |
| `--port PATH`              | Serial device (required for dump)                            |
| `--baud N`                 | Baud rate (default 115200 for OpenGD77)                      |
| `--ident`                  | Read FirmwareInfo (`'R'` mem `09h`, 46 bytes) before regions |
| `--show-cps`               | Send SHOW_CPS (`'C'` `00h`) before region reads              |
| `--close-cps`              | Send CLOSE_CPS (`'C'` `05h`) after dump                      |
| `--region MEM:ADDR:LENGTH` | Repeatable named region read                                 |
| `--out DIR`                | Output directory for `.bin` files and `manifest.json`        |
| `--list-ports`             | Print serial devices and exit                                |

If `--show-cps` ran, CLOSE_CPS is sent on exit by default (even without
`--close-cps`).

Write/program flags (`--write`, `--program`, `-w`, …) are **refused**.

### `--region` mem names (OpenGD77)

Format: `mem:addr:length` — `addr` and `length` accept decimal or hex (`0x3780`).

| `mem` token                    | `'R'` code | Region                   |
| ------------------------------ | ---------- | ------------------------ |
| `flash`, `01`, `0x01`          | `01h`      | Flash                    |
| `eeprom`, `02`, `0x02`         | `02h`      | EEPROM                   |
| `mcu-rom`, `05`, `0x05`        | `05h`      | MCU ROM                  |
| `display`, `06`, `0x06`        | `06h`      | Display buffer           |
| `wav`, `07`, `0x07`            | `07h`      | WAV buffer               |
| `ambe`, `08`, `0x08`           | `08h`      | AMBE buffer              |
| `firmware-info`, `09`, `0x09`  | `09h`      | FirmwareInfo             |
| `flash-security`, `0a`, `0x0a` | `0ah`      | FLASH security registers |

Long regions are chunked to the protocol block size (OpenGD77: 32-byte `'R'`
payload max) and concatenated.

### Output

`--out DIR` writes:

- `manifest.json` — protocol, port, baud, `capturedAt` (UTC), firmware/radioType
  when ident ran, and per-region mem/addr/length/path
- one `.bin` per `--region`
- stdout hex dump (16-byte rows) for each region

## Tests

```bash
python -m pytest -q
```

Uses mocked byte pipes — no live radio or serial hardware required in CI.
