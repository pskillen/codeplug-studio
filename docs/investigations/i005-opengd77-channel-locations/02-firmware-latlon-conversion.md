# E2 — Firmware latLon conversion vs channel 24-bit store

**Status:** draft
**Assignee:** agent with network (GitHub was 429 on 2026-08-17)
**Dispatched:** _(not yet)_  **Returned:**
**Code state:** Telectroboy/opengd77 `OPENGD77_MD9600_20260131` (official MD-9600 2026-01-31 source archive)
**Blocks / blocked by:** only needed if `E1` disagrees with qDMR, or to raise F20 from inference to source read

## Mission

Answer: **when firmware computes distance-to-repeater, does it decode channel `locationLat*` / `locationLon*` with qDMR's sign\|degrees\|10000ths formula, or with the `latLon*` binary-fixed-point helpers?**

## Context you need

`CodeplugChannel_t` (already read) has split `locationLat0/1/2` and `locationLon0/1/2` and `CODEPLUG_CHANNEL_LIBREDMR_FLAG1_USE_LOCATION` (`0x08`).

A derived changelog claims `latLongDoubleToFixed24` was buggy (`intPart << 23`) and was replaced by `latLon*` using `modf` and 15 fractional bits in `application/source/user_interface/uiUtilities.c`. That function family is also used for GPS/settings. It may or may not be how **channel** bytes are interpreted.

qDMR `encodeAngle`:

```
sign << 23 | degrees << 15 | (abs(trunc(angle * 10000)) % 10000)
```

Files to read (archive):

- `OPENGD77_MD9600_20260131/MD9600_firmware/application/source/user_interface/uiUtilities.c` — `latLon*` / `latLong*` / `distanceToLocation` / `distanceBetweenTwoCoords`
- `.../application/include/user_interface/uiUtilities.h` — declarations and `LOCATION_DECIMAL_*` constants
- Callers that read `locationLat0` (likely `codeplug.c`, channel UI, roaming sort)

Do not clone into the Studio repo. Quote the conversion functions in the report.

## Work items

1. Extract the 24-bit (and 32-bit if present) encode/decode functions verbatim.
2. Note every caller of channel `locationLat*` / `locationLon*`.
3. State whether channel bytes are passed through `latLon*` or decoded as decimal 10000ths (or a third way).
4. If the two encodings differ, give one numeric example (`51.5`) in both.

## Deliverable

Quoted functions + a one-sentence verdict: channel store **is** / **is not** qDMR `encodeAngle`.

## Success criteria

- Finding the functions is success even if they only apply to settings GPS.
- "Channel distance uses decode X" is the load-bearing sentence.
- Negative: no channel-byte decoder in tree — say so; then `E1` is the only discriminator.

---

## Report
<!-- written by the assignee; the brief above is immutable once dispatched -->

## Coordinator review
<!-- what was accepted, what was folded where, what is still open -->
