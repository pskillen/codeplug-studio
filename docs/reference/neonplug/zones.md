# NeonPlug zones

Wire shape for `codeplug.json` → `zones[]`.

**Ground truth:** [NeonPlug `Zone.ts`](https://github.com/infamy/NeonPlug/blob/main/src/models/Zone.ts)

## Fields

| Field      | Type       | Notes                                                      |
| ---------- | ---------- | ---------------------------------------------------------- |
| `id`       | string     | UI id (generated in NeonPlug if missing on import)         |
| `name`     | string     | Zone name — NeonPlug comments: **max 10** chars on radio   |
| `channels` | `number[]` | Member **channel numbers** (see [channels.md](channels.md)) |

## FK rules

- Membership is by **channel number**, not channel name and not Studio UUID.
- Empty `channels` array is valid.
- Duplicate channel numbers in one zone: treat as NeonPlug behaviour; Studio export should emit a unique ordered list.

## Studio mapping sketch

| NeonPlug              | Studio                                                |
| --------------------- | ----------------------------------------------------- |
| Zone row              | Build **zone grouping** trait layout + library `Zone` |
| `channels` numbers    | Resolve to `memberChannelIds` UUIDs on import         |
| `name`                | Library zone name / build `zoneOverrides.wireName`    |
| `id`                  | Discard — allocate Studio UUID                        |

UV5R-Mini / analogue-only pathways typically leave `zones` empty.
