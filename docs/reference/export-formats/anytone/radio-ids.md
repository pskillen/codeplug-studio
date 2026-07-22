# Anytone — RadioIDList.CSV

DMR radio ID labels referenced from `Channel.CSV` (`Radio ID` column).

**Fixture:** [`test-data/anytone/at-d890uv/RadioIDList.CSV`](../../../../test-data/anytone/at-d890uv/RadioIDList.CSV)

## Headers

| Header     | Purpose                         |
| ---------- | ------------------------------- |
| `No.`      | Index                           |
| `Radio ID` | Numeric DMR ID (e.g. `1234567`) |
| `Name`     | Label referenced by channels    |

## Internal mapping

| Wire       | Internal (target)                                      |
| ---------- | ------------------------------------------------------ |
| `Radio ID` | `ChannelModeProfileDMR.dmrId` or build/profile default |
| `Name`     | Wire label; resolved by name on import                 |

Accepted pattern: multiple channels share one radio ID row.

## Export status ([#302](https://github.com/pskillen/codeplug-studio/issues/302))

**Omitted from Studio export** until radio IDs are modelled as operator data.

Previously export always wrote a single profile-placeholder row (`defaultRadioId` / `defaultRadioIdLabel`, e.g. `1234567` / `TEST01`). On CPS import that file **overwrites** existing radio ID rows on the radio/codeplug. Prefer omitting the file entirely so CPS leaves operator IDs intact.

- Not listed in `ANYTONE_EXPORT_FILE_NAMES` → absent from ZIP / per-file downloads
- Absent from generated `.LST` when not in the exported member set (canonical index `1` remains in [lst-manifest.md](lst-manifest.md) for when export resumes)
- `Channel.CSV` may still write the profile `defaultRadioIdLabel` into the per-channel `Radio ID` column — same placeholder gap; follow-up when IDs are modelled

Import classification (`detectKind` → `radioIds`) is unchanged for Phase 7b.

## Related

- [channels.md](channels.md)
