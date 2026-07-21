# NeonPlug — Baofeng UV5R-Mini

Profile notes for analogue NeonPlug exports targeting UV5R-Mini.

**Studio ids:** format `neonplug`, profile `neonplug-uv5rmini` (`src/core/import-export/formats/neonplug/profiles.ts`)

**NeonPlug ground truth:** [`src/radios/uv5rmini/`](https://github.com/infamy/NeonPlug/tree/main/src/radios/uv5rmini) — especially [`channelMapping.ts`](https://github.com/infamy/NeonPlug/blob/main/src/radios/uv5rmini/channelMapping.ts) and [`BAOFENG_CHANNEL_COUNT`](https://github.com/infamy/NeonPlug/blob/main/src/radios/uv5rmini/constants.ts)

## Expected `CodeplugData` surface

| Array / field              | Typical use                                               |
| -------------------------- | --------------------------------------------------------- |
| `channels`                 | Analogue-only Channel objects (`mode: 'Analog'`)          |
| `zones`                    | Usually `[]`                                              |
| `scanLists`                | Usually `[]` — use channel `scanAdd`                      |
| `contacts` / RX / radioIds | Usually `[]`                                              |
| `radioInfo.model`          | `"UV5R-Mini"` (confirm against a live export)             |
| `radioSettings`            | May include UV5R-specific `radioSpecific` bag — **lossy** |
| `radioInfo.memoryLayout`   | Present on radio-read exports (config byte range)         |

## NeonPlug settings (read-only)

Build → **NeonPlug settings** decodes donor `radioSettings.radioSpecific` into labelled sections
(Basic, Display & Channel, PTT & Roger, …) using the same option indexes as NeonPlug
[`settingsProfile.ts`](https://github.com/infamy/NeonPlug/blob/main/src/radios/uv5rmini/settingsProfile.ts).
Values are display-only — Studio does not edit or greenfield-write these leaves; merge retains the
opaque bag. DM32 builds keep the shallow leaf-key preview and are unaffected.

## Fields that matter on write (NeonPlug mapping)

When NeonPlug writes UV5R-Mini, it projects NeonPlug Channel → raw memory using mainly:

- `number`, `name`
- `rxFrequency` / `txFrequency` (MHz)
- `rxCtcssDcs` / `txCtcssDcs`
- `power` (`Low` vs other → High)
- `bandwidth` (`25kHz` → FM wide, else NFM)

Other Channel fields are filled with defaults on read-back into the shared model.

## Trait alignment (Studio)

Same idea as CHIRP UV-5R (traits only):

- Flat memory list — Build → Channels uses the shared flat-memory Channels page
- Per-channel scan flag (`scanAdd` ↔ `scanInclusion`)

**Analogue-only:** flat-memory packing and UV5R NeonPlug serialise emit FM/AM channels only; digital-only library channels are skipped (with an export warning on serialise).

## Export caps (Studio profile)

NeonPlug **binary** pathway — same UV-5R Mini memory/name caps as CHIRP CSV; delivery differs:

| Cap                         | NeonPlug `neonplug-uv5rmini` | CHIRP `chirp-uv5r` (sibling) |
| --------------------------- | ---------------------------- | ---------------------------- |
| Memory / channels           | **999**                      | **999**                      |
| Channel name                | **12**                       | **12**                       |
| Zone / digital organisation | N/A                          | N/A                          |

Export warnings use these Studio radio profile constants — not hard-coded in library UI.

## Related

- Sibling CSV pathway: [CHIRP UV-5R](../../chirp/radios/chirp-uv5r.md)
- [channels.md](../channels.md)
