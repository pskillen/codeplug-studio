# NeonPlug zones

Wire shape for `codeplug.json` → `zones[]`.

**Ground truth:** [NeonPlug `Zone.ts`](https://github.com/infamy/NeonPlug/blob/main/src/models/Zone.ts)

## Fields

| Field      | Type       | Notes                                                                                                                                                                     |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`       | string     | UI id (generated in NeonPlug if missing on import)                                                                                                                        |
| `name`     | string     | Zone name — NeonPlug source comments say **max 10** on radio; Studio DM32UV / NeonPlug DM32UV **profiles** use `nameLimit` **16** (radio-confirmed, shared with DM32 CPS) |
| `channels` | `number[]` | Member **channel numbers** (see [channels.md](channels.md))                                                                                                               |

## FK rules

- Membership is by **channel number**, not channel name and not Studio UUID.
- Empty `channels` array is valid.
- Duplicate channel numbers in one zone: Studio export emits a unique ordered list.

## Studio export mapping (shipped #540)

| NeonPlug           | Studio                                                  |
| ------------------ | ------------------------------------------------------- |
| Zone row           | Build **zone grouping** trait layout + library `Zone`   |
| `channels` numbers | From assemble `memberChannelIds` via channel number map |
| `name`             | Assemble zone `wireName` (profile name limit)           |
| `id`               | Studio zone UUID (NeonPlug UI id)                       |

UV5R-Mini / analogue-only pathways leave `zones` empty.
