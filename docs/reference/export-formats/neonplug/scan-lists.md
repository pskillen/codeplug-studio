# NeonPlug scan lists

Wire shape for `codeplug.json` → `scanLists[]`.

**Ground truth:** [NeonPlug `ScanList.ts`](https://github.com/infamy/NeonPlug/blob/main/src/models/ScanList.ts)

## Fields

| Field                 | Type       | Notes                                           |
| --------------------- | ---------- | ----------------------------------------------- |
| `name`                | string     | Max **10** chars (11 bytes with null on radio)  |
| `channels`            | `number[]` | Up to **15** channel numbers                    |
| `channelCount`        | number?    | Optional; NeonPlug may auto-calculate           |
| `ctcScanMode`         | number     | 0–3                                             |
| `scanTxMode`          | number     | 0–2                                             |
| `hangTime`            | number?    | Tenths of seconds (1–255)                       |
| `priority1Type`       | number?    | 0=None, 1=Current, 2=Specific                   |
| `priority2Type`       | number?    | same                                            |
| `priorityChannel1`    | number?    | Channel id 1–999                                |
| `priorityChannel2`    | number?    | Encoded with −2 convention in NeonPlug comments |
| `designatedTxChannel` | number?    | Encoded with −2 convention                      |

## FK rules

- Member channels are **numbers** into `channels[]`.
- Priority / designated TX channel fields also use channel numbers (with NeonPlug encoding quirks for “None” / “Current”).
- Channel `scanListId`: `0` = none; else **1-based** index into `scanLists[]`. Channel wire field is 4 bits (0–15), so at most **15** referenceable lists.

## Studio export mapping (shipped #540 / #553 / #562)

DM32 CSV synthesises `Scan.csv` from **zone-derived** scan lists (with synthetic carriers). NeonPlug stores **first-class** scan list objects and the same carrier pattern as Analog channels in `channels[]`.

| Behaviour             | Studio export                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Source                | Zone grouping `exportScanList` + scan membership helpers                                                                                  |
| Empty layout          | When `zoneGrouping` is missing or has no zone entries and the scan master is on, each assembled zone is treated as `exportScanList: true` |
| Members               | Channel **numbers**, fanned out after m×n expansion, then truncated to 15 (scan-eligible zone members only — not the carrier)             |
| Synthetic carriers    | `{zoneName} Scan` Analog/FM simplex rows in `channels[]`; prepended as first zone member; carrier `scanListId` bound to the list          |
| Designated TX         | `designatedTxChannel` = carrier channel number                                                                                            |
| Carrier frequency     | Layout `scanCarrierFrequencyHz` when present; else **145.500 MHz** (`DEFAULT_SCAN_CARRIER_HZ`)                                            |
| Priority / hang / CTC | Lossy defaults: `ctcScanMode`/`scanTxMode` = `0`; omit rest                                                                               |
| Cap                   | Min of profile `maxScanLists` and **15**                                                                                                  |

All expanded channel objects for a source library channel inherit the same `scanListId`. Carriers use synthetic source id `scan-carrier:{zoneId}` (export-only — not library channels).

Member channels that map into a derived list also receive that list’s `scanListId` (NeonPlug keeps member FK binding; this is **not** DM32’s carrier-only Scan List column policy).

### Empty-list floor (DM32UV — #564)

Baofeng DM-32 / NeonPlug write paths expect **at least one** scan list. NeonPlug’s write path also **strips** lists with `channels.length === 0`, so a memberless dummy is dropped before radio write.

When zone-derived projection would leave `scanLists: []` and the export has ≥1 channel, Studio emits one floor list with the **first exported channel number** as a member (interop workaround only):

```json
{
  "name": "Scan list 1",
  "channels": [1],
  "channelCount": 1,
  "ctcScanMode": 0,
  "scanTxMode": 0
}
```

- Channel `scanListId` stays `0` (unbound) — the member exists so NeonPlug retains the list; it is not “assigned scan” for operators.
- Zero-channel exports keep a memberless floor (`channels: []`) — nothing useful to write.
- True empty-list / radio “Current channel” semantics remain blocked until NeonPlug stops stripping empty lists and pads scan blocks ([#558](https://github.com/pskillen/codeplug-studio/issues/558)).
- This floor is a **minimum** when derivation still yields nothing after empty-layout / `exportScanList` rules ([#562](https://github.com/pskillen/codeplug-studio/issues/562)).
- Radio encode truncates names to **10** chars (`Scan list 1` is 11 in JSON).

UV5R-Mini leaves `scanLists` empty; per-channel `scanAdd` on [channels](channels.md) carries scan intent.
