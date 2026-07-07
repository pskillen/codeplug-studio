# Anytone — ScanList.CSV

Dedicated scan lists for AT-D890UV — separate from zones (contrast OpenGD77 zone-as-scan pattern).

**Fixture:** [`test-data/anytone/at-d890uv/ScanList.CSV`](../../../test-data/anytone/at-d890uv/ScanList.CSV)

## Headers

| Header                                  | Purpose                                       |
| --------------------------------------- | --------------------------------------------- |
| `No.`                                   | Scan list index                               |
| `Scan List Name`                        | Wire name; FK from `Channel.Scan List`        |
| `Scan Channel Member`                   | Pipe-separated channel names                  |
| `Scan Channel Member RX Frequency`      | Pipe-separated RX MHz                         |
| `Scan Channel Member TX Frequency`      | Pipe-separated TX MHz                         |
| `Scan Mode`                             | Scan mode (`Off`, …)                          |
| `Priority Channel Select`               | Priority select mode                          |
| `Priority Channel 1` / `2`              | Priority channel names + freq columns         |
| `Revert Channel`                        | Revert behaviour (e.g. `Selected + TalkBack`) |
| `Look Back Time A[s]` … `Dwell Time[s]` | Timing parameters                             |

## Internal mapping

| Wire             | Internal (target)                         |
| ---------------- | ----------------------------------------- |
| `Scan List Name` | Build scan list entry                     |
| Member names     | Ordered channel refs via UUID at boundary |
| Timing columns   | Build scan list metadata (TBD)            |

## Related

- [channels.md](channels.md) — `Scan List` FK
- [zones.md](zones.md)
