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
| `Scan Mode`                             | Scan mode (`Off`, …)                   |
| `Priority Channel Select`               | Priority select mode                   |
| `Priority Channel 1` / `2`              | Priority channel names + freq columns  |
| `Revert Channel`                        | Revert behaviour                       |
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

## Observed wire values (operator CPS, July 2026)

Two scan lists in operator re-export; both used `Scan Mode` = `Off` and `Priority Channel Select` = `Off` with no priority channels set.

| Column                     | Values observed                   | Studio export default |
| -------------------------- | --------------------------------- | --------------------- |
| `Scan Mode`                | `Off`                             | `Off`                 |
| `Priority Channel Select`  | `Off`                             | `Off`                 |
| `Priority Channel 1` / `2` | `Off` (no priority channel)       | `Off`                 |
| `Revert Channel`           | `Selected + TalkBack`, `Selected` | `Selected + TalkBack` |
| `Look Back Time A[s]`      | `2.0`                             | `2.0`                 |
| `Look Back Time B[s]`      | `3.0`                             | `3.0`                 |
| `Dropout Delay Time[s]`    | `3.1`                             | `3.1`                 |
| `Dwell Time[s]`            | `3.1`                             | `1.0`                 |

**Gap:** Studio always exports `Dwell Time[s]` = `1.0` from `serialiseScanListsCsv()`; CPS sample uses `3.1` on both lists. Other scan modes (`Scan Mode` ≠ `Off`, priority channel enabled) still need CPS elicitation — [enum-verification.md](enum-verification.md).

## Related

- [channels.md](channels.md) — `Scan List` FK
- [zones.md](zones.md)
