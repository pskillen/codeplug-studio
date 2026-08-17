# E1 — CPS-written OpenGD77 channel record with known location

**Status:** draft
**Assignee:** operator (hardware + official OpenGD77 CPS)
**Dispatched:** _(not yet)_ **Returned:**
**Code state:** n/a (radio + CPS, not Studio)
**Blocks / blocked by:** does not block the implementation plan; blocks calling F16 "measured against CPS"

## Mission

Answer: **does official OpenGD77 CPS write the same 24-bit decimal packing qDMR `encodeAngle` uses**, in the split lat/lon bytes of one channel record?

## Context you need

Studio Web Serial write currently zeros channel GPS. qDMR and firmware `CodeplugChannel_t` agree on **where** the bytes live. They have not been checked against a file or radio image produced by official CPS.

Target radio: Baofeng DM-1701 / Retevis RT-84 (OpenGD77), or any OpenUV380-class radio sharing this channel struct (MD-UV380, MD-9600). Same 56-byte channel element.

Pick **one** channel. Write down the exact decimal lat/lon typed into CPS (four decimal places, including signs) and whether **Use Location** is Yes.

Channel record size is 56 bytes (`0x38`). Offsets inside that record:

| Bytes         | Meaning                              |
| ------------- | ------------------------------------ |
| `0x1a`        | lat LS                               |
| `0x1b`        | TOT (ignore)                         |
| `0x1c` `0x1d` | lat mid / MS                         |
| `0x1e` `0x1f` | lon LS / mid                         |
| `0x20`–`0x23` | tones (ignore)                       |
| `0x24`        | lon MS                               |
| `0x26`        | flags; bit 3 (`0x08`) = Use Location |

Do **not** use Studio to write the channel. Use official CPS (or a `.g77` saved after CPS programmed that channel). If capturing from the radio, read with a tool that dumps raw channel memory (qdmr read, or Studio Read **if** you save the raw image before any Write).

## Work items

1. Program one channel in official CPS with a documented lat/lon and Use Location = Yes.
2. Capture the 56-byte channel record (file offset or hex dump). Prefer the whole record so `0x1a`–`0x26` can be checked in context.
3. Record CPS version, firmware version string, radio model, and the typed coordinates.
4. Optional second channel: same coords, Use Location = No — to see whether CPS still writes the six bytes.

## Deliverable

- Hex of bytes `0x1a`–`0x26` (or the full 56 bytes).
- Typed lat, lon, Use Location.
- CPS and firmware versions.

## Success criteria

- **Match:** assembling `(b2<<16)|(b1<<8)|b0` for lat and lon equals qDMR `encodeAngle` of the typed values (allow 0.0001° truncation). Flag `0x26` has bit 3 set when Use Location is Yes. That **confirms** F16 against CPS.
- **Mismatch:** the bytes are a different packing. That is still the answer — report the raw bytes and do not "fix" them to qDMR. Encoding is then reopened.
- **Could not capture:** say so. Do not substitute a qDMR write as if it were CPS.

---

## Report

<!-- written by the assignee; the brief above is immutable once dispatched -->

## Coordinator review

<!-- what was accepted, what was folded where, what is still open -->
