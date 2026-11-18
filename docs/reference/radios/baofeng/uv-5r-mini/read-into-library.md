# UV-5R Mini read into library

This page describes how a Read of this radio is decoded for the library; product behaviour is in `docs/features/radio-read-write/read-into-library.md`.

The detection method is available to the read workflow; integration into that workflow is still pending.

## Firmware detection

| Signal            | Address  | Meaning                                                 |
| ----------------- | -------- | ------------------------------------------------------- |
| Radio report      | `0xEFC0` | `MM9R`, format 2; stock answers with erased `FF` bytes. |
| Zone table header | `0xC000` | `MMZ1`, version 1; erased on stock.                     |

A valid report identifies MM9PDY firmware. An MM9PDY build from before the report frame is recognised by the zone table header. With neither signal the radio is treated as stock. A report with an unknown format or layout, or an invalid report, is refused rather than treated as stock.

Detection reads only the two frames at `0xC000` and `0xEFC0`; it never writes. It runs in the same session straight after the clone read, because the radio ends the session about two seconds after the last byte. These probes are covered by fakes only and have not yet been confirmed on a stock radio.
