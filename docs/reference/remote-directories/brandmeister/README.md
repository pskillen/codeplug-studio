# BrandMeister API (v2)

Tier-3 wire reference for the **BrandMeister Halligan API v2** as used by Codeplug Studio for repeater directory search, verify, and talk group import.

**Base URL:** `https://api.brandmeister.network/v2`

**Studio clients:** `src/integrations/repeaters/brandmeisterClient.ts`, `brandmeisterTalkGroups.ts`

## Endpoints used

| Endpoint                         | Method | Purpose                                            |
| -------------------------------- | ------ | -------------------------------------------------- |
| `/device/byCall?callsign={call}` | GET    | Lookup device(s) by callsign                       |
| `/device/{id}/talkgroup`         | GET    | Static talk groups configured on a device          |
| `/talkgroup/{id}`                | GET    | Resolve one talk group name by DMR ID              |
| `/talkgroup`                     | GET    | Bulk catalogue `id → name` map (fallback resolver) |

Browser `fetch` with CORS. Device lookup returns a single object or an array. Static talk groups return an array of `{ talkgroup, slot, repeaterid }`.

`GET /device/{id}/action/getRepeater` requires authentication — **not used** by Studio.

## Device field mapping

BrandMeister `tx` / `rx` are **MHz strings**. Studio inverts to match repeater convention (same as ETCC):

| API field               | `RepeaterListing` | Notes                                     |
| ----------------------- | ----------------- | ----------------------------------------- |
| `id`                    | `remoteId`        | stringified                               |
| `callsign`              | `callsign`        |                                           |
| `tx`                    | `rxFrequencyHz`   | repeater output (radio RX)                |
| `rx`                    | `txFrequencyHz`   | repeater input (radio TX)                 |
| `colorcode`             | `colourCode`      | DMR colour code                           |
| `lat`, `lng`            | `location`        | `{ lat, lon }`; locator derived on import |
| `city`                  | `name`            | channel display name                      |
| `statusText` / `status` | `status`          | prefers `statusText`                      |
| `lastKnownMaster`       | _(filter only)_   | see [Retired devices](#retired-devices)   |

All BrandMeister listings normalise to `modes: ['dmr']` at the boundary.

### Retired devices

BrandMeister can return a **200** with a former device that still has an `id` and `callsign`, but is no longer usable on the network. Studio treats a row as retired when **both**:

- `tx` and `rx` are missing or ≤ 0 MHz (after parse), **and**
- `lastKnownMaster` is `9999`

Do **not** use API `status` / `statusText` for this — retired rows can still report values such as status `3` / “Both Slots Linked”.

When every returned device is retired, `searchBrandmeisterByCallsign` throws `RepeaterDirectoryError` with:

> BrandMeister has no active device for {callsign}. It may have left the network.

That message surfaces on **Add from BrandMeister**, channel **Identity → Check BrandMeister repeater**, and **DMR settings → Check BrandMeister talk groups & RX list**. Mixed results drop retired stubs and keep active devices.

## Static talk group mapping

| API field        | Internal target                       | Notes                                                                             |
| ---------------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| `talkgroup`      | `TalkGroup.digitalId`                 | parse as integer; dedupe in library by `digitalId`                                |
| `slot`           | `RxGroupListMember.timeSlotOverride`  | `"1"` or `"2"` → `DMRTimeSlot`; invalid → `null`                                  |
| (resolved name)  | `TalkGroup.name`                      | via `/talkgroup/{id}` then bulk `/talkgroup` map; synthetic `TG {id}` last resort |
| (generated list) | `RxGroupList`                         | default name `{callsign} - BrandMeister`; members in API order                    |
| (channel wire)   | `ChannelModeProfileDMR.rxGroupListId` | UUID FK on imported/verified channel                                              |

Some static talk group IDs return **404** on `/talkgroup/{id}` (slot-encoded or regional variants). Studio falls back to the bulk catalogue, then a synthetic name.

## Import behaviour

- `comment` is **not** populated on channel import (operator may add notes manually).
- Band wire field is empty; band pills infer from frequency in the UI.
- Talk group + RX list import is **optional** (checkbox, default on). On API failure, channel-only import continues with a warning.

## Known limits vs ukrepeater.net

| Capability                      | BrandMeister                   | ukrepeater.net (ETCC)     |
| ------------------------------- | ------------------------------ | ------------------------- |
| Callsign search                 | yes                            | yes                       |
| Locator / band / town search    | no public v2 endpoint          | yes (`searchUkRepeaters`) |
| Use my location                 | not supported                  | geolocation → locator     |
| Multi-mode profiles             | DMR only                       | FM, DMR, D-STAR, YSF, …   |
| Static talk groups per repeater | yes (`/device/{id}/talkgroup`) | no                        |

Full API documentation: [api.brandmeister.network/docs](https://api.brandmeister.network/docs/)

## Related

- [repeater-directories feature doc](../../../features/repeater-directories/README.md)
- [ukrepeater reference](../ukrepeater/README.md)
