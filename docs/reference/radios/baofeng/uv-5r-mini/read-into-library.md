# UV-5R Mini read into library

This page describes how a Read of this radio is decoded for the library; product behaviour is in `docs/features/radio-read-write/read-into-library.md`.

The adapter hook is available to the read workflow; the library and UI integration is still pending.

## Firmware detection

| Signal            | Address  | Meaning                                                 |
| ----------------- | -------- | ------------------------------------------------------- |
| Radio report      | `0xEFC0` | `MM9R`, format 2; stock answers with erased `FF` bytes. |
| Zone table header | `0xC000` | `MMZ1`, version 1; erased on stock.                     |

A valid report identifies MM9PDY firmware. An MM9PDY build from before the report frame is recognised by the zone table header. With neither signal the radio is treated as stock. A report with an unknown format or layout, or an invalid report, is refused rather than treated as stock.

Detection reads only the two frames at `0xC000` and `0xEFC0`; it never writes. It runs in the same session straight after the clone read, because the radio ends the session about two seconds after the last byte. These probes are covered by fakes only and have not yet been confirmed on a stock radio.

## Reading zones

After detecting MM9PDY firmware, the zone table sector `0xC000`–`0xCFFF` can be read in 64 frames. Zone list order follows the table. Valid MMZO data (firmware 1.1.0 and later) supplies each zone's member order; otherwise members are in ascending channel number. Valid MMZS data supplies each zone's scan set; without it no scan set is read. A table rejected by the radio's reader is treated as no zones, not an error. A valid table can have an empty zone list.

## What a read carries and drops

| Radio field       | Carried to              | Note                                                                                                            |
| ----------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| RX / TX frequency | Channel frequencies     | TX all FF means receive-only.                                                                                   |
| RX / TX tone      | Channel tones           | Includes reverse DCS.                                                                                           |
| Power             | Channel power on create | High 5 W and low 1 W map to 100% and 20%.                                                                       |
| Bandwidth         | Channel bandwidth       | The NFM bit is inverted compared with classic UV-5R.                                                            |
| Scan              | Scan inclusion          | Per-channel flag.                                                                                               |
| Name              | Channel name            | Up to 12 ASCII characters; no callsign.                                                                         |
| Mode              | Channel mode            | FM, or AM when RX is 108–135.999999 MHz. The clone has no AM bit; like CHIRP, Read infers it from RX frequency. |

Dropped fields (see [channel record offsets](channel-record.md)): DTMF signal code `scode` (12), PTT ID `pttid` (13), voice scramble (14 bits 5–4), RX DTMF (15 bits 5–4), busy channel lockout (15 bit 3), frequency hopping (15 bit 0), unnamed bits (14 bits 7–6 and 3–2, 15 bits 7 and 1), and reserved bytes (16–19). Busy channel lockout is dropped even though the library models it, because Mini Write does not encode it.
