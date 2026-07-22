# APRS cross-format reconciliation

How **digital APRS** wire shapes differ across CPS formats and how Codeplug Studio maps them to the vendor-neutral library model. Analog APRS is **not modelled** — exporters emit off/default constants. OpenGD77 is **deferred** (analog-only).

**Tracking:** [#248](https://github.com/pskillen/codeplug-studio/issues/248) · Model: [#249](https://github.com/pskillen/codeplug-studio/issues/249)

Tier-3 column inventories: [Anytone aprs.md](../../reference/formats/anytone/aprs.md), [aprs-on-channels.md](../../reference/formats/anytone/aprs-on-channels.md), [DM32 channels.md](../../reference/formats/dm32/channels.md), [NeonPlug aprs.md](../../reference/formats/neonplug/aprs.md).

---

## Global vs per-channel

| Format                | Global config                                                                 | Per-channel (digital)                                                                                  | Studio mapping                                                                                                                                                                                |
| --------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Anytone AT-D890UV** | Single `APRS.CSV` row (~184 cols)                                             | `APRS RX`, `APRS Report Type`, `Digital APRS PTT Mode`, `Digital APRS Report Channel` on `Channel.CSV` | Singleton `AprsConfiguration` + `Channel.aprs`                                                                                                                                                |
| **DM32**              | None — Studio emits `APRS.md` guide                                           | `APRS Receive`, `APRS Report Type`, `APRS Report Channel`, Digital PTT on channel rows                 | Same `Channel.aprs`; global settings via guide ([#250](https://github.com/pskillen/codeplug-studio/issues/250))                                                                               |
| **NeonPlug DM-32UV**  | `radioSettings` APRS fields (slots 1–8 + scheduled send, beacon, call/upload) | `aprsReceive`, `aprsReportMode` on `channels[]`                                                        | Same library model; merge-export patches donor settings ([#559](https://github.com/pskillen/codeplug-studio/issues/559)) — wire: [neonplug/aprs.md](../../reference/formats/neonplug/aprs.md) |
| **OpenGD77**          | Multi-row `APRS.csv` (named configs)                                          | `Channels.APRS` name FK                                                                                | **Deferred** — analog-only                                                                                                                                                                    |

---

## Library scope

| Concern                                                  | Where it lives              | Rationale                                    |
| -------------------------------------------------------- | --------------------------- | -------------------------------------------- |
| Operator-curated APRS settings (timing, slots, position) | `Library.aprsConfiguration` | One global config per project                |
| Per-channel receive/report/PTT                           | `Channel.aprs?`             | Shared across Anytone digital + DM32 digital |

Export adapters read the singleton library config when serialising the Anytone `APRS.CSV` row ([#251](https://github.com/pskillen/codeplug-studio/issues/251)).

---

## Digital-only model decisions

| Wire concept                                                | Studio decision                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APRS Report Type` = `Analog` (Anytone)                     | Import maps to `reportType: 'off'` with warning — not stored as analog                                                                                                                                                                                                                                                                 |
| Analog PTT modes, digipeater path, RX filters, packet types | Not modelled — `aprsDefaults.ts` constants at export ([#251](https://github.com/pskillen/codeplug-studio/issues/251))                                                                                                                                                                                                                  |
| `Aprs TgN` / `APRS TG` DMR IDs                              | Raw `number` on slot — need not exist as a library contact                                                                                                                                                                                                                                                                             |
| `manualTxIntervalSec` / `autoTxIntervalSec`                 | Seconds in library. Manual exports as plain wire seconds. **Anytone auto** exports as wire byte `k` (`encode`: `k = trunc(s/15) − 3`; `decode`: `s = (k+3)×15`; e.g. wire `9` = 180 s) — [timing wire](../../reference/formats/anytone/aprs.md#timing-wire-export-v1) ([#366](https://github.com/pskillen/codeplug-studio/issues/366)) |
| Slot channel binding (`channelN` wire)                      | `EntityRef` kind `channel`; `null` = current channel (wire `0`). Anytone export resolves `channelN` to `No.` in `Channel.CSV`, `AMAir.CSV`, or `FM.CSV` ([#359](https://github.com/pskillen/codeplug-studio/issues/359)). Non-Anytone formats may not honour analog-bound slots.                                                       |
| Report channel index                                        | `ChannelAprsBinding.reportSlotIndex` — 1-based index into `AprsConfiguration.channelSlots`                                                                                                                                                                                                                                             |

---

## Documented export loss (v1)

| Item                                                | Reason                                                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anytone wire `Analog` report type on import         | Normalized to `off`                                                                                                                               |
| ~150 unmodelled `APRS.CSV` columns                  | Fixture defaults — not operator-editable                                                                                                          |
| CPS fixed beacons 2–8                               | One `fixedLocation` in model; wire exports slot `1` when fixed                                                                                    |
| OpenGD77 `APRS.csv`                                 | Deferred                                                                                                                                          |
| DM32 analog report channel sentinel `256`           | Off-placeholder on analog rows without digital reporting                                                                                          |
| Analog-bound APRS slot `channelRef` on DM32 / CHIRP | Wire names listed in `APRS.md` for DM32; Anytone uses `APRS.CSV` ([#359](https://github.com/pskillen/codeplug-studio/issues/359))                 |
| DM32 single CPS call type / upload number           | Library keeps per-slot values; export warns + guide uses first contributing slot ([#250](https://github.com/pskillen/codeplug-studio/issues/250)) |
| NeonPlug single call type / upload ID               | Same consensus as DM32 guide; patched onto donor `radioSettings` ([#559](https://github.com/pskillen/codeplug-studio/issues/559))                 |
| NeonPlug greenfield APRS globals                    | Omitted (`radioSettings: null`); merge-into-base required                                                                                         |
| `all call` (Call Type = 2)                          | Deferred                                                                                                                                          |

---

## Related

- [APRS hub](README.md)
- [data-model](../data-model/README.md)
