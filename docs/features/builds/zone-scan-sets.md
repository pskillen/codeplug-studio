# Zone scan sets (zones over a flat channel list)

## Purpose

On radios whose zones come from the MM9PDY firmware over a flat channel list (the **Retevis RT95** and the **Baofeng UV-5R Mini**), each zone has its own **scan set**: which of its channels Scan visits while that zone is selected. It is separate from the stock per-channel scan flag, which the radio uses in All channels. The user-facing spec is pskillen/firmware-mods#13 (`features/zone-scan.md`, _Radios without stock zones_).

**Status:** In progress · **Tracking:** [#1755](https://github.com/pskillen/codeplug-studio/issues/1755)

**Code:** `BuildCapabilityTrait.ZoneScanSet`, `src/core/import-export/zoneScanSets/`, `ZoneScanOverrideSection` (`variant="scanSet"`), `BuildFlatMemoryScanListPage`

## Two scan settings

| Setting                  | Belongs to                                                         | Used when the radio is in | Where in Studio                                                      |
| ------------------------ | ------------------------------------------------------------------ | ------------------------- | -------------------------------------------------------------------- |
| **Scan in All channels** | Each channel: the stock scan flag (`Channel.scanInclusion`)        | All channels              | **Scan in All channels** page (`/builds/:id/scan-list`), per channel |
| **Scan in this zone**    | Each member of a zone: the zone member's include/skip in that zone | A zone                    | **Zones** page, a zone's **Scan** tab                                |

- A channel can be scanned in one zone, skipped in another, and set separately again for All channels.
- **Every member of a zone is in its scan set by default.** The library zone default (_Zone defaults_), a member's own include/skip on the zone editor, the build's default, and this build's per-zone choice on the Zones page resolve in that order (a later layer wins), the same cascade the DM-32UV and AT-D890UV zone-derived scan lists use.
- The per-channel flag plays no part in a zone's scan set, and a zone's scan set plays no part in All channels.

## Operator workflow

1. Build zones as for any zone build ([zone-grouping.md](zone-grouping.md)).
2. On **Export for radio → Zones**, open a zone and go to its **Scan** tab. Each member has a **Scan in this zone** switch. The badge counts what Write sends: the zone's channels in this build (excluded, ineligible and over-the-cap members left out) and how many of them are on. Choices are saved on this build's zone projection, not on the library zone.
3. A zone with fewer than two channels set to Scan in this zone shows an orange note: the radio gives its stock "cannot scan" response for such a zone.
4. Set the All channels flag on **Scan in All channels** (the same page stock flat-memory builds call **Scan list**). That page has no memory column on these builds, because Write numbers channels in zone order.

## Projection

`resolveZoneScanSets(assembled, library, context)` resolves one scan set per assembled zone, once, in core: the zone's exported members (in member export order) whose cascade resolves to include. Members outside the build are never in a set.

The Web Serial Write projection attaches each set to its zone as `RadioZoneDto.scanChannelNumbers`: the zone's own channel numbers that belong to a channel in the set, kept to the members the radio keeps (after the radio drops channels it can't hold; both targets keep zone order). Only targets with the zone scan set trait carry the field. A radio writer encodes it as it stands and does not resolve it again.

## Warnings

Three warning types, all of which warn and none of which refuses (`ExportWarning` kind `zone_scan_set`):

| Issue              | When                                          | Says                                                                  |
| ------------------ | --------------------------------------------- | --------------------------------------------------------------------- |
| `too-few`          | A zone's scan set has fewer than two channels | The zone won't scan on the radio                                      |
| `firmware-too-old` | Firmware support is too old or unknown        | The sets were not written; the radio says how it knows                |
| `room-exceeded`    | The radio's room for scan sets is exceeded    | What it needs and holds, and what happens to the zones that don't fit |

`checkZoneScanSets(sets, checks, warnings)` runs them. The too-few check is common. A radio supplies the rest through `ZoneScanSetRadioChecks`: `firmwareTooOld()` (how it knows) and `roomExceeded(sets)` (its limit and the consequence). The hook's too-old result means the sets aren't written and the per-zone checks are skipped. The Mini always writes the sets and checks their effective membership and capacity. When an effective set skips a member, Studio shows an informational note explaining that firmware before 1.1.0 uses the All channels scan setting instead. A fallback zone scans all members and does not trigger the note. A zone that cannot fit falls back to scanning all members, and the room warning names it; later zones are still tried. See [the Mini reference](../../reference/radios/baofeng/uv-5r-mini/mm9pdy-data.md).

## Not done

- OpenGD77's separate Zone Skip / All Skip columns are still both written from the per-channel flag; a possible follow-up, not part of this work.
- DM-32UV and AT-D890UV behaviour is unchanged.

## Related

- [zone-grouping.md](zone-grouping.md): zone layout, member order and the zone override modal
- [ZoneScanExportControls](../../../src/app/components/builds/ZoneScanExportControls.md): the per-member control both variants share
- [modded firmware](../modded-firmware/README.md): the MM9PDY targets
- [DESIGN.md: Build capability traits](../../../DESIGN.md#build-capability-traits)
