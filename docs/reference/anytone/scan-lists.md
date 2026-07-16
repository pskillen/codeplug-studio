# Anytone — ScanList.CSV

Dedicated scan lists for AT-D890UV — separate from zones (contrast OpenGD77 zone-as-scan pattern).

**Fixture:** [`test-data/anytone/at-d890uv/ScanList.CSV`](../../../test-data/anytone/at-d890uv/ScanList.CSV) (two rows: minimal + revert-channel variant).

## Headers

| Header                                  | Purpose                                |
| --------------------------------------- | -------------------------------------- |
| `No.`                                   | Scan list index                        |
| `Scan List Name`                        | Wire name; FK from `Channel.Scan List` |
| `Scan Channel Member`                   | Pipe-separated channel names           |
| `Scan Channel Member RX Frequency`      | Pipe-separated RX MHz                  |
| `Scan Channel Member TX Frequency`      | Pipe-separated TX MHz                  |
| `Scan Mode`                             | Scan resume mode (`Off`, `TO`, `CO`, `SE`, …) |
| `Priority Channel Select`               | Priority select mode                   |
| `Priority Channel 1` / `2`              | Priority channel names + freq columns  |
| `Revert Channel`                        | Revert / PTT behaviour                 |
| `Look Back Time A[s]` … `Dwell Time[s]` | Timing parameters                      |

## Internal mapping

| Wire             | Internal (target)                                  |
| ---------------- | -------------------------------------------------- |
| `Scan List Name` | Library `ScanList` (wire name from build override) |
| Member names     | Ordered channel refs via UUID at boundary          |
| Timing columns   | Build scan list metadata (TBD)                     |

### Zone-derived (optional export)

When **Export zone-derived scan lists** is enabled on the build Export page and a zone has **Export as scan list** on `/builds/:id/zones`, export appends additional `ScanList.CSV` rows (zone wire name) and synthesises a **carrier channel** (`{zoneName} Scan`) prepended in `DMRZone.CSV` with `Scan List` FK and **Auto Scan** enabled. Library `ScanList` rows export first. Member channels are listed in the scan list but do not receive the zone-derived FK. See [zone-derived-scan-lists.md](../../zone-derived-scan-lists.md).

**Carrier cross-file naming:** The zone scan carrier is a neutral FM channel (no template callsign). Its `Channel.CSV` **Channel Name** must match the **first** `Zone Channel Member` in `DMRZone.CSV` exactly — Anytone CPS resolves zone members by exact channel name ([#370](https://github.com/pskillen/codeplug-studio/issues/370)). Export derives both from the same wire context; do not prefix the carrier with a repeater callsign from another library channel.

**Scan list members:** `ScanList.CSV` references `Channel.CSV` names only — AMAir/FM receive-bank channels are omitted from zone-derived scan lists even when present in the zone.

**Provisional caps (AT-D890UV):** 100 scan lists, 100 members per list — adjust when CPS-confirmed.

## AnyTone scan settings — terminology map

Anytone CPS uses vendor-specific labels. Map to industry terms when documenting library concepts (wire strings stay here).

| AnyTone CPS / CSV term   | Industry term              | Practice meaning                                                                                                                                                                                                                                                                                                                                          | Confidence        |
| ------------------------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `Scan Mode`              | Scan resume mode           | Rule for how/when the radio leaves an active channel                                                                                                                                                                                                                                                                                                      | High              |
| `Scan Mode` → `TO`       | Time-operated resume       | Linger ~5–6 s typical then resume scanning even if signal remains                                                                                                                                                                                                                                                                                         | High              |
| `Scan Mode` → `CO`       | Carrier-operated resume    | Stay while signal present; resume after drop                                                                                                                                                                                                                                                                                                              | High              |
| `Scan Mode` → `SE`       | Search / stop-on-signal    | Stop on found channel; scanning paused until user restarts (Scan key / channel change)                                                                                                                                                                                                                                                                    | High              |
| `Look Back Time A`       | Priority sample interval 1 | How often Priority Channel 1 is re-checked while scanning others                                                                                                                                                                                                                                                                                          | High              |
| `Look Back Time B`       | Priority sample interval 2 | Commonly Priority Channel 2 sample interval; AnyTone notes sometimes describe a narrower “busy but tone mismatch” case                                                                                                                                                                                                                                    | Medium            |
| `Dropout Delay Time`     | Post-reply hang time       | Per AnyTone CPS docs: after you reply to a received signal (PTT), scanning resumes after this delay. Community sources sometimes treat it as generic post-signal hang — **contested**                                                                                                                                                                      | Low / contested   |
| `Dwell Time`             | Post-transmit hang time    | Per AnyTone CPS docs: after you PTT on an idle/scanning channel (not in reply), scanning resumes after this delay. Some community sources invert this with Dropout Delay — **contested**                                                                                                                                                                   | Low / contested   |

### Field bounds (D878 memory map / same radio family)

| Column                  | Bound      |
| ----------------------- | ---------- |
| `Look Back Time A/B`    | 0.5–5.0 s  |
| `Dropout Delay Time`    | 0.1–5.0 s  |
| `Dwell Time`            | 0.1–5.0 s  |

## Observed wire values (operator CPS + elicitation, July 2026)

| Column                     | Values observed / confirmed                                                         | Studio export default |
| -------------------------- | ----------------------------------------------------------------------------------- | --------------------- |
| `Scan Mode`                | `Off`; resume modes `TO`, `CO`, `SE`                                                | `Off`                 |
| `Priority Channel Select`  | `Off` (+ enabled when priority used)                                                | `Off`                 |
| `Priority Channel 1` / `2` | `Off` or channel name                                                               | `Off`                 |
| `Revert Channel`           | `Selected` — PTT on selected (scan carrier); `Selected + TalkBack` — PTT on selected if no signal, else on signal channel; `Last Called`; `Last Used` | `Selected + TalkBack` |
| `Look Back Time A[s]`      | Priority sample A                                                                   | `2.0`                 |
| `Look Back Time B[s]`      | Priority sample B                                                                   | `3.0`                 |
| `Dropout Delay Time[s]`    | 0.1–5.0 s                                                                           | `3.1`                 |
| `Dwell Time[s]`            | 0.1–5.0 s                                                                           | `1.0`                 |

**Gap:** Studio always exports `Dwell Time[s]` = `1.0` from `serialiseScanListsCsv()`; CPS samples also use `3.1`. Timing defaults and Scan Mode modelling are follow-up work — [enum-verification.md](enum-verification.md).

## Related

- [channels.md](channels.md) — `Scan List` FK
- [zones.md](zones.md)
- [Library scan lists](../../features/library/scan-lists.md) — vendor-neutral concepts
