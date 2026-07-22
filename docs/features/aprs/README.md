# APRS (digital)

Tier-1 hub for **digital APRS** in Codeplug Studio — vendor-neutral library entities, per-channel bindings, and a **singleton** global configuration. Wire column mapping lives in per-format tier-3 references; this doc describes internal semantics only.

**Tracking:** [#353](https://github.com/pskillen/codeplug-studio/issues/353) (persistence) · [#354](https://github.com/pskillen/codeplug-studio/issues/354) (UI) · [#248](https://github.com/pskillen/codeplug-studio/issues/248) (reconciliation) · Epic [#501](https://github.com/pskillen/codeplug-studio/issues/501) (supersedes M1 [#246](https://github.com/pskillen/codeplug-studio/issues/246))

**Outstanding:** [aprs-model-outstanding.md](aprs-model-outstanding.md)

**Components:** [AprsChannelSlotsEditor](../../../src/app/components/library/AprsChannelSlotsEditor.md) · [ChannelAprsBindingSection](../../../src/app/components/library/ChannelAprsBindingSection.md) · [AprsChannelAssignmentPanel](../../../src/app/components/library/AprsChannelAssignmentPanel.md)

---

## Scope

| In scope (this epic)                                                                                                          | Out of scope                                                             |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Digital DMR-over-APRS configuration and per-channel flags                                                                     | Analog (AX.25) APRS — not modelled; exporters emit off/default constants |
| Library `aprsConfiguration` (singleton) + `Channel.aprs?`                                                                     | OpenGD77 APRS (analog-only) — deferred                                   |
| Native YAML persistence + domain validation (schema v17)                                                                      | OpenGD77 APRS (analog-only) — deferred                                   |
| IndexedDB `aprsConfigurations` store (one row per project)                                                                    | OpenGD77 APRS (analog-only) — deferred                                   |
| Library settings page, channel APRS tab, bulk channel assignments, Channels list column                                       |                                                                          |
| Cross-format reconciliation doc                                                                                               |                                                                          |
| Anytone `APRS.CSV` + channel export ([#251](https://github.com/pskillen/codeplug-studio/issues/251))                          |                                                                          |
| DM32 channel APRS + `APRS.md` guide ([#250](https://github.com/pskillen/codeplug-studio/issues/250))                          |                                                                          |
| NeonPlug DM-32UV APRS globals + channel pair on merge-export ([#559](https://github.com/pskillen/codeplug-studio/issues/559)) |                                                                          |

**Analog-off export policy:** Anytone and DM32 **analog APRS** columns are not operator-editable (`Analog APRS PTT Mode` constant). Digital APRS on analog _channels_ is supported where the radio allows reporting via a digital path.

---

## Entities (summary)

| Entity               | Layer                       | Role                                                                                                                |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `AprsConfiguration`  | Library (singleton)         | Global digital APRS settings — beacon timing, position source, up to 8 channel slots (DMR, AM air, or FM broadcast) |
| `ChannelAprsBinding` | Library (on `Channel.aprs`) | Per-channel digital flags — receive, report type, PTT mode, `reportSlotIndex` (1-based)                             |

Deep field semantics: [data-model README](../data-model/README.md). Cross-format wire shapes: [cross-format-reconciliation.md](cross-format-reconciliation.md).

**No new build trait** — APRS does not change zone/scan/memory organisation.

**No radio caps in CRUD** — slot cardinality (e.g. 8 on AT-D890UV) is enforced at export with warnings only, matching `ScanList` patterns.

---

## Editing paths

| Path               | Route / location              | Purpose                                                                                                        |
| ------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **APRS settings**  | `/library/aprs-configuration` | Singleton config editor + **Channel assignments** tab (bulk binding; digital / analog / both and band filters) |
| **Channel editor** | Channel → APRS tab            | Per-channel binding (`ChannelAprsBindingSection`) — all channels (DMR and analog)                              |
| **Channels list**  | `/library/channels`           | Optional **APRS config** column (hidden by default) — summary via `formatAprsAssignmentSummary`                |

**Slots table:** default sort is slot number ascending (1-based). Slot 1 may be **Current Channel** (`channelRef: null`).

Redirects: `/library/aprs-configurations` → `/library/aprs-configuration`.

---

## Native YAML / Drive interchange

- Singleton `library.aprsConfiguration` is parsed for `studioSchemaVersion` **≥ 17** (not only the current schema). A v17 file with slots must not lose them when the app is on v18+.
- Out-of-range `Channel.aprs.reportSlotIndex` (including when `channelSlots` is empty) is a **soft warning** on import/preview — it must not hard-fail Drive save conflict assessment ([#430](https://github.com/pskillen/codeplug-studio/issues/430)).
- Current Channel slots remain valid; channels may reference them via `reportSlotIndex`.

---

## Implementation status

| Area                                                                   | Status                                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Tier-1 + reconciliation docs                                           | Shipped ([#248](https://github.com/pskillen/codeplug-studio/issues/248)) |
| Core types + schema v15                                                | Shipped ([#249](https://github.com/pskillen/codeplug-studio/issues/249)) |
| Domain normalize / validation                                          | Shipped                                                                  |
| `assemble()` APRS projection                                           | Shipped                                                                  |
| Native YAML round-trip                                                 | Shipped                                                                  |
| IndexedDB persistence (`aprsConfigurations`, schema v16)               | Shipped ([#353](https://github.com/pskillen/codeplug-studio/issues/353)) |
| Singleton model + schema v17 migration                                 | Shipped                                                                  |
| Library APRS UI (settings page, channel tab, assignments, list column) | Shipped ([#354](https://github.com/pskillen/codeplug-studio/issues/354)) |
| Anytone export (`APRS.CSV`, channel cols, `aprsDefaults.ts`)           | Shipped ([#251](https://github.com/pskillen/codeplug-studio/issues/251)) |
| Anytone APRS slots on analog channels (AM air / FM broadcast)          | Shipped ([#359](https://github.com/pskillen/codeplug-studio/issues/359)) |
| Native YAML v17 singleton parse + orphan slot soft-warn                | Shipped ([#430](https://github.com/pskillen/codeplug-studio/issues/430)) |
| DM32 per-channel APRS + `APRS.md` guide                                | Shipped ([#250](https://github.com/pskillen/codeplug-studio/issues/250)) |
| NeonPlug DM-32UV APRS → `radioSettings` (merge-export)                 | Shipped ([#559](https://github.com/pskillen/codeplug-studio/issues/559)) |

---

## Related

- [data-model](../data-model/README.md) — ER diagram and entity tables
- [Anytone APRS wire inventory](../../reference/formats/anytone/aprs.md) — tier 3
- [Anytone per-channel APRS](../../reference/formats/anytone/aprs-on-channels.md) — tier 3
- [DM32 APRS](../../reference/formats/dm32/aprs.md) — tier 3
- [NeonPlug APRS](../../reference/formats/neonplug/aprs.md) — tier 3
