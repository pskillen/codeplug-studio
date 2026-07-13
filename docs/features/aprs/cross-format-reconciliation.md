# APRS cross-format reconciliation

How **digital APRS** wire shapes differ across CPS formats and how Codeplug Studio maps them to the vendor-neutral library model. Analog APRS is **not modelled** — exporters emit off/default constants. OpenGD77 is **deferred** (analog-only).

**Tracking:** [#248](https://github.com/pskillen/codeplug-studio/issues/248) · Model: [#249](https://github.com/pskillen/codeplug-studio/issues/249)

Tier-3 column inventories: [Anytone aprs.md](../../reference/anytone/aprs.md), [aprs-on-channels.md](../../reference/anytone/aprs-on-channels.md), [DM32 channels.md](../../reference/dm32/channels.md).

---

## Global vs per-channel

| Format | Global config | Per-channel (digital) | Studio mapping |
| ------ | ------------- | --------------------- | -------------- |
| **Anytone AT-D890UV** | Single `APRS.CSV` row (~184 cols) | `APRS RX`, `APRS Report Type`, `Digital APRS PTT Mode`, `Digital APRS Report Channel` on `Channel.CSV` | `AprsConfiguration` + `Channel.aprs`; build picks `activeAprsConfigurationId` |
| **DM32** | None in CPS export | `APRS Receive`, `APRS Report Type`, `APRS Report Channel` on channel rows | Same `Channel.aprs`; no global file — [#250](https://github.com/pskillen/codeplug-studio/issues/250) |
| **OpenGD77** | Multi-row `APRS.csv` (named configs) | `Channels.APRS` name FK | **Deferred** — analog-only |

---

## Library vs build scope

| Concern | Where it lives | Rationale |
| ------- | -------------- | --------- |
| Operator-curated APRS settings (timing, slots, position) | `Library.aprsConfigurations[]` | Curated once like contacts and scan lists |
| Which config exports as the single Anytone global row | `FormatBuild.activeAprsConfigurationId` | CPS allows one `APRS.CSV` row per codeplug |
| Per-channel receive/report/PTT | `Channel.aprs?` | Shared across Anytone digital + DM32 digital |

When multiple library configs exist and the build omits `activeAprsConfigurationId`, export should warn and fall back to the first config (export adapter — [#251](https://github.com/pskillen/codeplug-studio/issues/251)).

---

## Digital-only model decisions

| Wire concept | Studio decision |
| ------------ | --------------- |
| `APRS Report Type` = `Analog` (Anytone) | Import maps to `reportType: 'off'` with warning — not stored as analog |
| Analog PTT modes, digipeater path, RX filters, packet types | Not modelled — `aprsDefaults.ts` constants at export ([#251](https://github.com/pskillen/codeplug-studio/issues/251)) |
| `Aprs TgN` / `APRS TG` DMR IDs | Raw `number` on slot/config — need not exist as library contact |
| Slot channel binding (`channelN` wire) | `EntityRef` kind `channel`; `null` = current channel (wire `0`) |
| Report channel index | `reportChannelRef` → resolved to 1-based slot index via `resolveAprsSlotIndex` at export |

---

## Documented export loss (v1)

| Item | Reason |
| ---- | ------ |
| Anytone wire `Analog` report type on import | Normalized to `off` |
| ~150 unmodelled `APRS.CSV` columns | Fixture defaults — not operator-editable |
| CPS fixed beacons 2–8 | One `fixedLocation` in model; wire exports slot `1` when fixed |
| OpenGD77 `APRS.csv` | Deferred |
| DM32 analog report channel sentinel `256` | N/A — digital-only path |
| `all call` (Call Type = 2) | Deferred |

---

## Related

- [APRS hub](README.md)
- [data-model](../data-model/README.md)
