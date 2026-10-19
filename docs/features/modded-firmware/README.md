# MM9PDY modded firmware

Operators who run the **MM9PDY** firmware want one channel per repeater and the zone as the scan sequence. Stock Anytone and DM-32 targets keep m×n channel expansion and dedicated or zone-derived scan lists. Pick the radio target whose label says **MM9PDY modded firmware**.

The library stays vendor-neutral. `RxGroupListMember.timeSlotOverride` is already a library field. These targets write that hint on the radio only where the MM9PDY firmware has a store for it. They do not clone contacts or suffix talk-group names with `TS1` / `TS2`.

Wire layouts stay in the stock radio docs: [AT-D890UV](../../reference/radios/anytone/at-d890uv/README.md) and [DM-32UV](../../reference/radios/baofeng/dm-32uv/README.md).

**Tracking:** [codeplug-studio#1312](https://github.com/pskillen/codeplug-studio/issues/1312)

## Implementation status

| Area                               | Status      | Notes                                                                                                                                                                                                                                       |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AT-D890UV MM9PDY radio target      | Shipped     | `anytone-at-d890uv-mm9pdy`, Web Serial profile `radio-io-at-d890uv-mm9pdy`. Traits: zone grouping, zone as scan list, multi talk group per channel. No Anytone CSV egress. [#1315](https://github.com/pskillen/codeplug-studio/issues/1315) |
| AT-D890UV one channel per repeater | Shipped     | One digital channel per repeater; its RX group is the talk-group list. No scan-list bank. Optional-settings `+0x200` is left as read. [#1316](https://github.com/pskillen/codeplug-studio/issues/1316)                                      |
| AT-D890UV per-member timeslot byte | In progress | [#1317](https://github.com/pskillen/codeplug-studio/issues/1317)                                                                                                                                                                            |
| AT-D890UV optional TG step keys    | In progress | [#1318](https://github.com/pskillen/codeplug-studio/issues/1318)                                                                                                                                                                            |
| DM-32UV MM9PDY radio target        | Deferred    | [#1319](https://github.com/pskillen/codeplug-studio/issues/1319)                                                                                                                                                                            |
| DM-32UV zone-scan write            | Deferred    | [#1320](https://github.com/pskillen/codeplug-studio/issues/1320)                                                                                                                                                                            |
| DM-32UV timeslot and step keys     | Deferred    | [#1321](https://github.com/pskillen/codeplug-studio/issues/1321) — waits on DM-32 C2 firmware                                                                                                                                               |

## Documentation map

| Doc                                                              | Topic                               |
| ---------------------------------------------------------------- | ----------------------------------- |
| [modded-firmware-progress.md](modded-firmware-progress.md)       | What has landed on the branch       |
| [modded-firmware-outstanding.md](modded-firmware-outstanding.md) | Debt found while shipping           |
| [builds](../builds/README.md)                                    | Radio targets, nav, export settings |
| [radio-read-write](../radio-read-write/README.md)                | Web Serial write path               |

## Write rules

1. **One channel per repeater.** The channel's RX group is the talk-group list. The channel contact is the first selection. Studio does not expand one repeater into a channel per talk group.
2. **The zone is the scan.** There is no parallel scan-list inventory. Build nav hides Scan lists.
3. **Timeslot is per RX-group member** on the AT-D890UV MM9PDY target, stored from `timeSlotOverride`. Omitted members stay unset. The stock AT-D890UV write fills that tail with the unset sentinel.

Assigning TG previous / TG next on the AT-D890UV is an optional export setting, off unless the operator turns it on. Official CPS shows those functions as item 15 Record (TG next) and item 14 Record Switch (TG previous). The radio's own key menu shows the MM9PDY names.

## Targets

| Radio target                | Egress                                 | Traits                                                         |
| --------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| `anytone-at-d890uv-mm9pdy`  | Web Serial `radio-io-at-d890uv-mm9pdy` | Zone grouping, zone as scan list, multi talk group per channel |
| `anytone-at-d890uv` (stock) | Web Serial and Anytone CSV             | Unchanged: dedicated scan lists and m×n                        |
