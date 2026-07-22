# NeonPlug profile — `neonplug-uv5rmini`

Thin adapter stub. **Radio home (caps, power, protocol):** [Baofeng UV-5R Mini](../../../../radios/baofeng/uv-5r-mini/README.md).

| | |
| --- | --- |
| **Studio ids** | format `neonplug`, profile `neonplug-uv5rmini` (`src/core/import-export/formats/neonplug/profiles.ts`) |
| **Ground truth** | NeonPlug [`src/radios/uv5rmini/`](https://github.com/infamy/NeonPlug/tree/main/src/radios/uv5rmini) |

## Adapter-only notes

**Expected `CodeplugData` surface:** analogue `channels` (`mode: 'Analog'`); `zones` / `scanLists` / contacts usually `[]`; `radioInfo.model` typically `"UV5R-Mini"`; `radioSettings` may include a UV5R-specific `radioSpecific` bag (**lossy**); `radioInfo.memoryLayout` present on radio-read exports.

**NeonPlug settings (read-only):** Build → NeonPlug settings decodes donor `radioSettings.radioSpecific` via NeonPlug [`settingsProfile.ts`](https://github.com/infamy/NeonPlug/blob/main/src/radios/uv5rmini/settingsProfile.ts). Display-only — Studio does not edit or greenfield-write these leaves; merge retains the opaque bag.

Channel wire mapping: [channels.md](../channels.md). Sibling CHIRP CSV path: [chirp-uv5r.md](../../chirp/radios/chirp-uv5r.md).
