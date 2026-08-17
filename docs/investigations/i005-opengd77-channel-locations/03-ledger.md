# Evidence ledger

**Rows are immutable.** Once a row is written it is never edited. If a verdict turns out to be wrong, add a **new** row referencing the old id and stating what changed. Threading corrections through prose is what made earlier radio-io notes untrustworthy.

| Prefix | Kind |
| ------ | ---- |
| `S/` | source read (code, docs, issue text) |
| `R/` | computed / harness run |
| `C/` | capture (radio dump, CPS file) — none yet |
| `E/` | errand (see `errands/`) |

Clocks: dates in this file are local `Europe/London` (BST, UTC+1) on the day the row was added, matching the session timestamp. Commit dates cited from git are UTC as recorded by git.

---

## Source reads

| id | Artefact | Config | Result as reported | What it actually established |
| -- | -------- | ------ | ------------------ | ---------------------------- |
| `S/1233` | GitHub issue [#1233](https://github.com/pskillen/codeplug-studio/issues/1233) | opened 2026-08-16, no comments | Operator: DM-1701/RT-84 Web Serial write used to populate distance-from-repeater; now nothing. Issue body concludes never-implemented, not regression. | Symptom is operator report (not independently confirmed on hardware). The "never modelled" conclusion is a source read of Studio git/code, not a hardware capture. |
| `S/codec` | `src/integrations/radio-io/radios/opengd77/channelCodec.ts` | workspace 2026-08-17 | `encodeChannelRecord` comment at lat/timeout/lon; `out[0x26] = 0`; decode returns no location | Write zeros those offsets. Decode never inspects them. |
| `S/dto` | `src/integrations/radio-io/radioChannelDto.ts` | workspace 2026-08-17 | No lat/lon/useLocation on `RadioChannelDto` | DTO cannot carry the field today. |
| `S/projection` | `src/app/services/radioIoChannelMap.ts` (`openGd77AssembledChannelsToRadioDtos`), `radioIoWriteProjection.ts` (`stampOpenGd77ChannelBehaviour`) | workspace 2026-08-17 | DTO built from freq/tones/power/mode/scan/rxOnly only | Location is not dropped later — it is never copied in. |
| `S/csv` | `src/core/import-export/formats/opengd77/serialise.ts` + `columns.ts` | workspace 2026-08-17 | Writes `Latitude` / `Longitude` / `Use Location` from library channel | CSV path already has the model fields Web Serial lacks. |
| `S/library` | `src/core/models/library.ts` `Channel` | workspace 2026-08-17 | `location: GeoPoint \| null`, `useLocation: boolean`, `maidenheadLocator` | Internal model is sufficient; locator is display/reconcile, not a radio field. |
| `S/qdmr-encode` | `qdmr/lib/opengd77base_codeplug.cc` `encodeAngle` / `decodeAngle` / `setFixedPosition` | local qdmr checkout | 24-bit sign\|degrees\|10000ths; split byte writes | Formula and split packing qDMR uses when writing this record. |
| `S/qdmr-offsets` | `qdmr/lib/opengd77base_codeplug.hh` `ChannelElement::Offset` | local qdmr checkout | lat0=`0x1a`, tot=`0x1b`, lat1=`0x1c`, lat2=`0x1d`, lon0=`0x1e`, lon1=`0x1f`, lon2=`0x24`, `useFixedLocation` bit `{0x26, 3}` | Offset table Studio's channel-record.md already cites. |
| `S/qdmr-encode-path` | `qdmr/lib/opengd77base_codeplug.cc` `ChannelElement::encode` ~649–716 | local qdmr checkout | Global GNSS stamped first; extension location overwrites; flag from `location().isValid()` | qDMR encode policy. Not Studio policy. |
| `S/qdmr-aprs` | same `.cc` `APRSSettingsElement::setFixedPosition` | local qdmr checkout | `setUInt24_le` + same `encodeAngle` | Same 24-bit code, contiguous bytes, for APRS config — not the channel split. |
| `S/fw-struct` | Telectroboy archive `OPENGD77_MD9600_20260131/.../codeplug.h` `CodeplugChannel_t` | firmware dated 2026-01-31; `PLATFORM_RT84_DM1701` shares the header | `locationLat0/1/2`, `locationLon0/1/2` split around tot/tones; `USE_LOCATION 0x08` | Firmware in-memory channel struct matches qDMR offsets and flag bit. Does **not** by itself prove the 24-bit numeric formula (that is `encodeAngle` / `E2`). |
| `S/changelog` | Telectroboy `README.md` derived changelog 20240908 → 20260131 | archive of official MD-9600 source | Claims `latLongDoubleToFixed24` used `intPart << 23` and was fixed to 15 fractional bits via `modf` in `uiUtilities.c` | A conversion function changed. Not a channel-record layout change. |
| `S/userguide` | LibreDMR `OpenGD77_User_Guide.md` (Roaming, Show dist, Channel Details Location/Lat/Lon) | fetched 2026-08-17 | Use Location must be ticked; lat `DD.DDDD`, lon `DDD.DDDD`; radio position also required | Operator-visible contract. Not a bit layout. |
| `S/stale-txt` | `qdmr/doc/code/opengd77_channel.txt` | local qdmr checkout | `0x1a` "Unused, set to 0"; no lat/lon | Historical GD-77 dump. Not current OpenGD77 channel map. |

## Runs

| id | Artefact | Config | Result as reported | What it actually established |
| -- | -------- | ------ | ------------------ | ---------------------------- |
| `R/angle-2026-08-17` | `harness/encode_angle.py` (inline Python matching qDMR) | CPython 3, formula copied from `S/qdmr-encode` | Round-trips exact 0.0001 decimals; `51.5074` encoded as `51.5073` because `int(51.5074 * 10000)` truncated | The formula as written, including the truncation trap. **Did not** compare to a radio or to CPS. |

## Captures / dumps

| id | Artefact | Source | Why it matters |
| -- | -------- | ------ | -------------- |
| _(none)_ | | | A CPS-written 56-byte channel record with known lat/lon is the discriminator for F16 vs any competing packing. See `E1`. |

---

## Reproducing the comparison

```bash
python3 tmp/investigations/opengd77-channel-locations/harness/encode_angle.py
```

Trap: this prints **qDMR's** packing. Agreement with the script is not agreement with the radio.
