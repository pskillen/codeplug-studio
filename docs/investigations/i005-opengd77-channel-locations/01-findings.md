# Findings — what is true

**Append-only.** Every row cites a `03-ledger.md` id or an explicit evidence class. A finding that dies moves to `02-dead-ends.md` and is deleted from here, so nothing in this file is ever "superseded in place".

Nothing enters on inference alone. Where something is inference it says so in the row.

---

## The failure

| #   | Finding                                                                                                                                                                      | Evidence                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| F1  | Web Serial write on OpenGD77 / OpenUV380 has **never** written channel GPS. This is not a regression from a later commit.                                                    | `S/1233` (issue investigation); `S/codec`                                                                                |
| F2  | `encodeChannelRecord()` zero-fills the record then leaves latitude / TOT / longitude at `0`. Comment: "not modelled on write".                                               | `S/codec`                                                                                                                |
| F3  | Flags byte `0x26` is hardcoded `0`, so `useFixedLocation` / `USE_LOCATION` (bit 3, `0x08`) is never set.                                                                     | `S/codec`; `S/fw-struct`                                                                                                 |
| F4  | `RadioChannelDto` has no location / useLocation field. The omission starts at the DTO, not only the codec.                                                                   | `S/dto`                                                                                                                  |
| F5  | OpenGD77 assembled-channel projection (`openGd77AssembledChannelsToRadioDtos`) and `stampOpenGd77ChannelBehaviour` never copy `Channel.location` or `Channel.useLocation`.   | `S/projection`                                                                                                           |
| F6  | Write fully replaces occupied channel records (no RMW). A Studio write therefore **clears** locations previously programmed by official CPS.                                 | `S/codec`; committed [channel-record.md](../../../docs/reference/radios/opengd77/channel-record.md) write-defaults table |
| F7  | CSV export already writes `Latitude`, `Longitude`, and `Use Location` from `channel.location` / `channel.useLocation`. That is the path the operator used before Web Serial. | `S/csv`; committed [channels.md](../../../docs/reference/export-formats/opengd77/channels.md)                            |

## What the radio requires (operator-visible)

| #   | Finding                                                                                                                                                                                                  | Evidence      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| F8  | Distance-from-repeater / roaming / "Show dist" need **both** a channel location with Use Location enabled **and** a valid radio position (Location screen or GPS). Empty channel coords → nothing shown. | `S/userguide` |
| F9  | Channel Details stores lat as `DD.DDDD`, lon as `DDD.DDDD`, plus a separate Location (Use Location) yes/no. Long-press 8 shows bearing/distance when enabled.                                            | `S/userguide` |
| F10 | The library already models this as `Channel.location: GeoPoint \| null` and `Channel.useLocation: boolean`. No new library field is required for write.                                                  | `S/library`   |

## Wire layout (channel record)

| #   | Finding                                                                                                                                                             | Evidence                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| F11 | Shared OpenGD77Base / OpenUV380 channel record is 56 bytes (`0x38`). DM-1701 / RT-84 uses this layout (same `PLATFORM_RT84_DM1701` group as MD-9600 / MD-UV380).    | `S/fw-struct`; committed channel-record.md |
| F12 | Latitude is **not contiguous**: `locationLat0` @ `0x1a` (LS), TOT @ `0x1b`, `locationLat1` @ `0x1c`, `locationLat2` @ `0x1d` (MS).                                  | `S/fw-struct`; `S/qdmr-offsets`            |
| F13 | Longitude: `locationLon0` @ `0x1e` (LS), `locationLon1` @ `0x1f`, then RX/TX tones, `locationLon2` @ `0x24` (MS). Byte `0x25` is unused.                            | `S/fw-struct`; `S/qdmr-offsets`            |
| F14 | `LibreDMR_flag1` @ `0x26` bit 3 (`0x08`) is `CODEPLUG_CHANNEL_LIBREDMR_FLAG1_USE_LOCATION`. qDMR names the same bit `useFixedLocation`.                             | `S/fw-struct`; `S/qdmr-offsets`            |
| F15 | Assembling the three lat (resp. lon) bytes as `(b2 << 16) \| (b1 << 8) \| b0` yields the 24-bit angle code. Same as little-endian uint24, split around TOT / tones. | `S/qdmr-encode`; `S/fw-struct`             |

## Packed-angle formula (channel store)

| #   | Finding                                                                                                                                                                                                                                                             | Evidence                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| F16 | qDMR `encodeAngle` / `decodeAngle` pack a signed decimal angle into 24 bits: bit 23 = sign (1 = negative), bits 15–22 = integer degrees (0–255), bits 0–14 = truncated `abs(angle)` 4-decimal-place remainder (0–9999).                                             | `S/qdmr-encode`; worked examples `R/angle-2026-08-17`                                        |
| F17 | Four decimal places match the user-guide keypad format (`DD.DDDD` / `DDD.DDDD`) and fit in 15 bits (9999 < 32768).                                                                                                                                                  | inference from F9 + F16, high confidence                                                     |
| F18 | qDMR uses C++ `int(angle * 10000)` (truncate toward zero). Values that are not exact in IEEE-754 can drop 0.0001° (e.g. 51.5074 → 51.5073). Implementation should pick truncate-to-match-qdmr vs round-to-nearest explicitly; tests must use exact 0.0001 decimals. | `R/angle-2026-08-17`                                                                         |
| F19 | APRS config in the same firmware uses a **contiguous** `latitude[3]` / `longitude[3]` and the **same** qDMR `encodeAngle` (uint24 LE). Channel packing is the split form of that 24-bit code, not a different numeric format.                                       | `S/qdmr-aprs`; `S/fw-struct` (APRS struct)                                                   |
| F20 | The 2026-01-31 `latLon*` changelog ("15 fractional bits", `modf`) describes GPS/settings conversion in `uiUtilities.c`, not the channel-record 24-bit store. Do not substitute binary fixed-point for F16.                                                          | inference from `S/changelog` + F16 + F17, high confidence; `E2` would raise this to measured |

## What qDMR does on encode (do / don't copy)

| #   | Finding                                                                                                                                                                                                                                                       | Evidence                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| F21 | When an OpenGD77 channel extension exists, qDMR `ChannelElement::encode` calls `setFixedPosition(extension.location())` then `enableFixedPosition(location().isValid())`. Invalid/empty coordinate clears the flag and returns early from `setFixedPosition`. | `S/qdmr-encode-path`           |
| F22 | **Before** applying the extension, qDMR stamps the **global** GNSS fixed position onto every channel and enables the flag from the global setting. Studio must not copy this. Per-channel `useLocation` is the analogue of the CPS checkbox.                  | `S/qdmr-encode-path`           |
| F23 | `setFixedPosition` writes the three bytes but does **not** set the flag; `enableFixedPosition` is a separate bit. Coords without the flag are representable. Distance display requires the flag (F8).                                                         | `S/qdmr-encode`; `S/userguide` |

## Implementation seam (Studio)

| #   | Finding                                                                                                                                                                                                                            | Evidence                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| F24 | Encode/decode belongs in `src/integrations/radio-io/radios/opengd77/channelCodec.ts` (already cites qDMR ChannelElement, GPL-3 facts only). Packed-angle helpers stay there — not in `src/core/`.                                  | `S/codec`; vendor-boundaries  |
| F25 | `RadioChannelDto` should grow an optional location shaped like the library `GeoPoint` (`{ lat, lon }`) plus a `useLocation` (or equivalent) boolean, populated from the assembled library channel — same fields CSV already reads. | `S/dto`; `S/csv`; `S/library` |
| F26 | Projection must copy those fields in `openGd77AssembledChannelsToRadioDtos` (and keep `stampOpenGd77ChannelBehaviour` from wiping them). MxN expansion is not used on OpenGD77 radio-io egress.                                    | `S/projection`                |
| F27 | `decodeChannelRecord` currently drops lat/lon/flag. Encode tests will need decode; Read hydration of location into the library is a separate product decision (`O3`).                                                              | `S/codec`                     |

## Settled elsewhere — cite, do not restate

| Topic                                                                      | Where it lives now                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Channel record size, name, BCD freq, tones, power, squelch, scan-skip bits | `docs/reference/radios/opengd77/channel-record.md`                 |
| CSV `Latitude` / `Longitude` / `Use Location` column mapping               | `docs/reference/export-formats/opengd77/channels.md`               |
| Library `Channel.location` / `useLocation` / locator reconcile             | `src/core/domain/channelLocation.ts`, `src/core/models/library.ts` |
| Write replaces channel table (no RMW)                                      | channel-record.md "Write defaults"                                 |
